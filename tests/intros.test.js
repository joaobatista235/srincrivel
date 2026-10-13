import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import PlayAudioHandler from '../src/controllers/PlayAudioHandler.js';

function setup(isMusicActive = () => false) {
  const connections = [];
  const players = [];
  const audio = {
    AudioPlayerStatus: { Idle: 'idle' },
    VoiceConnectionStatus: { Ready: 'ready', Destroyed: 'destroyed', Disconnected: 'disconnected' },
    getVoiceConnection: () => undefined,
    createAudioResource: file => ({ file }),
    entersState: async connection => connection,
    createAudioPlayer: () => {
      const player = new EventEmitter();
      player.play = resource => { player.resource = resource; };
      player.stop = () => player.emit('idle');
      players.push(player);
      return player;
    },
    joinVoiceChannel: options => {
      const connection = new EventEmitter();
      connection.state = { status: 'ready' };
      connection.options = options;
      connection.subscribe = () => {};
      connection.destroy = () => { connection.state.status = 'destroyed'; };
      connections.push(connection);
      return connection;
    },
  };
  const intros = new PlayAudioHandler({ client: { user: { id: 'bot' } }, users: { user: { audio: 'intro.mp3' } }, isMusicActive, audio });
  const state = guild => ({ id: 'user', channelId: 'voice', guild: { id: guild, voiceAdapterCreator: {} }, member: { user: { bot: false } } });
  return { audio, intros, connections, players, state };
}

test('intros de servidores diferentes não compartilham um bloqueio global', async () => {
  const { intros, state, connections } = setup();
  await Promise.all([intros.execute({}, state('one')), intros.execute({}, state('two'))]);
  assert.equal(connections.length, 2);
  intros.destroy();
  assert.ok(connections.every(connection => connection.state.status === 'destroyed'));
});

test('uma intro termina e libera imediatamente a conexão para música', async () => {
  const { intros, state, connections, players } = setup();
  await intros.execute({}, state('guild'));
  players[0].emit('idle');
  assert.equal(intros.isActive('guild'), false);
  assert.equal(connections[0].state.status, 'destroyed');
});

test('eventos antigos não destroem uma intro nova no mesmo servidor', async () => {
  const { intros, state, players } = setup();
  await intros.execute({}, state('guild'));
  const old = intros.sessions.get('guild');
  players[0].emit('idle');
  await intros.execute({}, state('guild'));
  intros.stop('guild', old);
  assert.equal(intros.isActive('guild'), true);
  intros.destroy();
});

test('uma fila de música ativa ou carregando impede a intro', async () => {
  const { intros, state, connections } = setup(() => true);
  await intros.execute({}, state('guild'));
  assert.equal(connections.length, 0);
});

test('mudar somente mute/deaf não toca a intro novamente', async () => {
  const { intros, state, connections } = setup();
  await intros.execute({ channelId: 'voice' }, state('guild'));
  assert.equal(connections.length, 0);
});

test('falha de conexão limpa sessão e player sem deixar o servidor bloqueado', async () => {
  const { intros, state, audio, connections } = setup();
  audio.entersState = async () => { throw new Error('timeout'); };
  await assert.rejects(intros.execute({}, state('guild')), /timeout/);
  assert.equal(intros.isActive('guild'), false);
  assert.equal(connections[0].state.status, 'destroyed');
});
