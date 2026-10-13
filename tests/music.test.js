import { test } from 'node:test';
import assert from 'node:assert/strict';
import MusicActions from '../src/application/music/MusicActions.js';
import VoiceSessionCoordinator from '../src/application/audio/VoiceSessionCoordinator.js';
import { ApplicationError } from '../src/application/errors/ApplicationError.js';
import { musicControls } from '../src/adapters/discord/presentation/musicControls.js';
import MusicPanel from '../src/adapters/discord/presentation/MusicPanel.js';
import DisTubePlayer from '../src/adapters/audio/DisTubePlayer.js';
function setup() {
  const actions = [];
  const state = { channelId: 'voice', hasQueue: true, paused: false, autoplay: false };
  const player = {
    state: () => state,
    async pause() { actions.push('pause'); state.paused = true; },
    async resume() { actions.push('resume'); state.paused = false; },
    async toggleAutoplay() { return state.autoplay = !state.autoplay; },
    async previous() { await Promise.resolve(); return { name: 'Anterior' }; },
    async skip() { actions.push('skip'); },
    async stop() { actions.push('stop'); },
    async leave(id) { actions.push('leave:' + id); },
    async play() { actions.push('play'); },
  };
  const coordinator = new VoiceSessionCoordinator(id => player.state(id));
  const music = new MusicActions({ player, coordinator, stopIntro: () => actions.push('stopIntro') });
  const input = { guildId: 'guild', userId: 'user', voiceChannelId: 'voice', textChannelId: 'text', query: 'música' };
  return { music, input, state, player, actions, coordinator };
}
test('ações de pause e resume recebem somente IDs e retornam resultados sem apresentação', async () => {
  const { music, input, state } = setup();
  assert.deepEqual(await music.pause(input), { code: 'PAUSED' });
  assert.equal(state.paused, true);
  assert.deepEqual(await music.resume(input), { code: 'RESUMED' });
  assert.equal(state.paused, false);
});
test('autoplay e previous usam os retornos assíncronos do player', async () => {
  const { music, input } = setup();
  assert.deepEqual(await music.autoplay(input), { code: 'AUTOPLAY_ON' });
  assert.deepEqual(await music.previous(input), { code: 'PREVIOUS', name: 'Anterior' });
});
test('usuários fora do canal ou em outro canal não modificam o player', async () => {
  const { music, input, actions } = setup();
  for (const voiceChannelId of [null, 'other']) {
    await assert.rejects(music.stop({ ...input, voiceChannelId }), ApplicationError);
  }
  assert.deepEqual(actions, []);
});
test('resume rejeita música que já está tocando e stop encerra fila antes da conexão', async () => {
  const { music, input, actions } = setup();
  await assert.rejects(music.resume(input), { code: 'ALREADY_PLAYING' });
  await music.stop(input);
  assert.deepEqual(actions, ['stop', 'leave:guild']);
});
test('play não disputa a conexão com uma intro reservada', async () => {
  const { music, input, player, coordinator, actions } = setup();
  player.state = () => null;
  coordinator.reserveIntro('guild', 'voice');
  await assert.rejects(music.play(input), { code: 'INTRO_ACTIVE' });
  assert.deepEqual(actions, []);
});
test('busca pendente bloqueia outra busca e sair, e libera a reserva ao falhar', async () => {
  const { music, input, player, coordinator } = setup();
  let reject;
  player.play = () => new Promise((_resolve, fail) => { reject = fail; });
  const pending = music.play(input);
  assert.equal(coordinator.state('guild').kind, 'music');
  await assert.rejects(music.play(input), { code: 'MUSIC_LOADING' });
  await assert.rejects(music.leave(input), { code: 'MUSIC_LOADING' });
  reject(new Error('indisponível'));
  await assert.rejects(pending, /indisponível/);
  assert.notEqual(coordinator.state('guild').kind, 'music');
});
test('sair encerra também intro e não exige fila', async () => {
  const { music, input, player, actions } = setup();
  player.state = () => null;
  await music.leave(input);
  assert.deepEqual(actions, ['stopIntro', 'leave:guild']);
});
test('controles são criados com estado independente por servidor', () => {
  const first = musicControls({ paused: true, autoplay: true }).map(row => row.toJSON());
  const second = musicControls({ paused: false, autoplay: false }).map(row => row.toJSON());
  assert.match(first[0].components[1].label, /Retomar/);
  assert.match(second[0].components[1].label, /Pausar/);
  assert.match(first[1].components[0].label, /✅/);
  assert.match(second[1].components[0].label, /❌/);
});
test('painel rejeita botões antigos e desativa seus controles ao limpar', async () => {
  const edits = [];
  const panel = new MusicPanel({ channels: { cache: new Map([['text', { send: async () => ({ id: 'current', edit: async data => edits.push(data) }) }]]) } });
  await panel.show({ guildId: 'guild', textChannelId: 'text', song: { name: 'Song' }, state: {} });
  assert.throws(() => panel.validate('guild', 'old'), { code: 'STALE_PANEL' });
  panel.validate('guild', 'current');
  await panel.clear('guild');
  assert.deepEqual(edits, [{ components: [] }]);
  assert.throws(() => panel.validate('guild', 'current'), ApplicationError);
});
test('painel que termina de enviar depois de stop não reaparece', async () => {
  let sent;
  const edits = [];
  const panel = new MusicPanel({ channels: { cache: new Map([['text', { send: () => new Promise(resolve => { sent = resolve; }) }]]) } });
  const showing = panel.show({ guildId: 'guild', textChannelId: 'text', song: {}, state: {} });
  await Promise.resolve();
  await panel.clear('guild');
  sent({ id: 'late', edit: async data => edits.push(data) });
  await showing;
  assert.throws(() => panel.validate('guild', 'late'), ApplicationError);
  assert.deepEqual(edits, [{ components: [] }]);
});
test('adaptador converte erro do DisTube preservando a causa', async () => {
  const cause = Object.assign(new Error('native'), { code: 'NO_PREVIOUS' });
  const player = new DisTubePlayer({ distube: { getQueue: () => ({ previous: async () => { throw cause; } }) } });
  await assert.rejects(player.previous('guild'), error => error.code === 'NO_PREVIOUS' && error.cause === cause);
});
test('adaptador resolve os IDs e entrega objetos nativos somente ao DisTube', async () => {
  const voice = { isVoiceBased: () => true }; const text = {}; const member = {};
  let captured;
  const player = new DisTubePlayer({ client: { guilds: { cache: new Map([['guild', {
    channels: { cache: new Map([['voice', voice], ['text', text]]) }, members: { fetch: async () => member },
  }]]) } }, distube: { play: async (...args) => { captured = args; } } });
  await player.play({ guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text', userId: 'user', query: 'Song' });
  assert.deepEqual(captured, [voice, 'Song', { member, textChannel: text }]);
});
