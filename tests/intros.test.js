import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import IntroAudioPlayer from '../src/adapters/audio/IntroAudioPlayer.js';
import IntroActions from '../src/application/intros/IntroActions.js';
import VoiceSessionCoordinator from '../src/application/audio/VoiceSessionCoordinator.js';
import VoiceStateListener from '../src/adapters/discord/VoiceStateListener.js';

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
  const client = { guilds: { cache: { get: () => ({ voiceAdapterCreator: {} }) } } };
  const intros = new IntroAudioPlayer({ client, audio });
  const coordinator = new VoiceSessionCoordinator(id => isMusicActive(id) ? { channelId: 'voice', hasQueue: true, paused: true } : null);
  const actions = new IntroActions({ users: { user: { audio: 'intro.mp3' } }, player: intros, coordinator });
  const listener = new VoiceStateListener(actions);
  const state = guild => ({ id: 'user', channelId: 'voice', guild: { id: guild, voiceAdapterCreator: {} }, member: { user: { bot: false } } });
  return { audio, intros, connections, players, state, listener, coordinator };
}

test('intros de servidores diferentes não compartilham um bloqueio global', async () => {
  const { intros, listener, state, connections } = setup();
  await Promise.all([listener.handle({}, state('one')), listener.handle({}, state('two'))]);
  assert.equal(connections.length, 2);
  intros.destroy();
  assert.ok(connections.every(connection => connection.state.status === 'destroyed'));
});

test('uma intro termina e libera imediatamente a conexão para música', async () => {
  const { intros, listener, state, connections, players } = setup();
  await listener.handle({}, state('guild'));
  players[0].emit('idle');
  assert.equal(intros.isActive('guild'), false);
  assert.equal(connections[0].state.status, 'destroyed');
});

test('eventos antigos não destroem uma intro nova no mesmo servidor', async () => {
  const { intros, listener, state, players } = setup();
  await listener.handle({}, state('guild'));
  const old = intros.sessions.get('guild');
  players[0].emit('idle');
  await listener.handle({}, state('guild'));
  intros.stop('guild', old);
  assert.equal(intros.isActive('guild'), true);
  intros.destroy();
});

test('uma fila de música ativa ou carregando impede a intro', async () => {
  const { intros, listener, state, connections } = setup(() => true);
  await listener.handle({}, state('guild'));
  assert.equal(connections.length, 0);
});

test('mudar somente mute/deaf não toca a intro novamente', async () => {
  const { intros, listener, state, connections } = setup();
  await listener.handle({ channelId: 'voice' }, state('guild'));
  assert.equal(connections.length, 0);
});

test('falha de conexão limpa sessão e player sem deixar o servidor bloqueado', async () => {
  const { intros, listener, state, audio, connections } = setup();
  audio.entersState = async () => { throw new Error('timeout'); };
  await assert.rejects(listener.handle({}, state('guild')), /timeout/);
  assert.equal(intros.isActive('guild'), false);
  assert.equal(connections[0].state.status, 'destroyed');
});

test('intro durante busca pendente não inicia e falha libera a reserva', async () => {
  const { listener, state, coordinator, connections } = setup();
  const reservation = coordinator.reserveMusic({ guildId: 'guild', voiceChannelId: 'voice' });
  await listener.handle({}, state('guild'));
  assert.equal(connections.length, 0);
  coordinator.release('guild', reservation);
  await listener.handle({}, state('guild'));
  assert.equal(connections.length, 1);
});
test('parar intro antes de Ready evita reprodução tardia e libera a reserva', async () => {
  const { listener, state, intros, audio, players, coordinator } = setup();
  let ready;
  audio.entersState = () => new Promise(resolve => { ready = resolve; });
  const pending = listener.handle({}, state('guild'));
  intros.stop('guild');
  ready();
  await pending;
  assert.equal(players[0].resource, undefined);
  assert.equal(coordinator.state('guild'), null);
});
test('liberação atrasada não apaga a reserva de outra intro', () => {
  const coordinator = new VoiceSessionCoordinator(() => null);
  const old = coordinator.reserveIntro('guild', 'voice');
  coordinator.release('guild', old);
  const current = coordinator.reserveIntro('guild', 'voice');
  coordinator.release('guild', old);
  assert.equal(coordinator.state('guild'), current);
});
test('conexão de voz externa não é destruída ou substituída por intro', async () => {
  const { listener, state, audio, connections, coordinator } = setup();
  audio.getVoiceConnection = () => ({});
  await listener.handle({}, state('guild'));
  assert.equal(connections.length, 0);
  assert.equal(coordinator.state('guild'), null);
});
test('encerramento impede uma nova intro depois de destroy', async () => {
  const { listener, state, intros, connections, coordinator } = setup();
  intros.destroy();
  await listener.handle({}, state('guild'));
  assert.equal(connections.length, 0);
  assert.equal(coordinator.state('guild'), null);
});
