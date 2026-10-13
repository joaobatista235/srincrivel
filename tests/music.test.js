import { test } from 'node:test';
import assert from 'node:assert/strict';
import MusicService from '../src/services/MusicService.js';
import { UserError } from '../src/utils/errors.js';
import { musicControls } from '../src/components/buttons.js';

function setup() {
  const actions = [];
  const queue = {
    paused: false, autoplay: false,
    async pause() { actions.push('pause'); this.paused = true; },
    async resume() { actions.push('resume'); this.paused = false; },
    toggleAutoplay() { this.autoplay = !this.autoplay; return this.autoplay; },
    async previous() { await Promise.resolve(); return { name: 'Anterior' }; },
    async stop() { actions.push('stop'); },
  };
  const distube = {
    getQueue: () => queue,
    voices: { get: () => ({ channel: { id: 'voice' } }), leave: id => actions.push('leave:' + id) },
    play: async () => actions.push('play'),
  };
  const music = new MusicService(distube);
  const interaction = { guildId: 'guild', member: { voice: { channel: { id: 'voice' } } },
    isButton: () => false, channel: {}, message: { id: 'panel' } };
  return { music, interaction, queue, distube, actions };
}

test('pause e resume funcionam sem uma mensagem de botão', async () => {
  const { music, interaction, queue } = setup();
  await music.control(interaction, 'pause');
  assert.equal(queue.paused, true);
  await music.control(interaction, 'resume');
  assert.equal(queue.paused, false);
});

test('autoplay funciona como slash command sem interaction.message', async () => {
  const { music, interaction, queue } = setup();
  delete interaction.message;
  await music.control(interaction, 'autoplay');
  assert.equal(queue.autoplay, true);
});

test('previous aguarda a promessa e usa o nome correto', async () => {
  const { music, interaction } = setup();
  assert.match((await music.control(interaction, 'previous')).content, /Anterior/);
});

test('usuários em outro canal não conseguem parar a música', async () => {
  const { music, interaction, actions } = setup();
  interaction.member.voice.channel.id = 'other';
  await assert.rejects(music.control(interaction, 'stop'), UserError);
  assert.deepEqual(actions, []);
});

test('botões de músicas antigas não afetam a fila atual', async () => {
  const { music, interaction, actions } = setup();
  interaction.isButton = () => true;
  music.panels.set('guild', { id: 'new-panel' });
  await assert.rejects(music.control(interaction, 'stop'), /desatualizado/);
  assert.deepEqual(actions, []);
});

test('stop encerra fila, conexão e controles antigos', async () => {
  const { music, interaction, actions } = setup();
  music.panels.set('guild', { id: 'panel', edit: async payload => actions.push(payload.components) });
  await music.control(interaction, 'stop');
  assert.deepEqual(actions, ['stop', 'leave:guild', []]);
  assert.equal(music.panels.size, 0);
});

test('play não disputa a conexão com uma intro em andamento', async () => {
  const { music, interaction, actions } = setup();
  music.intros = { isActive: () => true, channelId: () => 'voice' };
  await assert.rejects(music.play(interaction, 'música'), /entrada/);
  assert.deepEqual(actions, []);
});

test('uma busca pendente impede outra busca e libera a reserva ao falhar', async () => {
  const { music, interaction, distube } = setup();
  let reject;
  distube.play = () => new Promise((_resolve, fail) => { reject = fail; });
  const pending = music.play(interaction, 'first');
  assert.equal(music.isActive('guild'), true);
  await assert.rejects(music.play(interaction, 'second'), /carregada/);
  reject(new Error('indisponível'));
  await assert.rejects(pending, /indisponível/);
  assert.equal(music.pending.has('guild'), false);
});

test('controles são criados com estado independente por servidor', () => {
  const first = musicControls({ paused: true, autoplay: true }).map(row => row.toJSON());
  const second = musicControls({ paused: false, autoplay: false }).map(row => row.toJSON());
  assert.match(first[0].components[1].label, /Retomar/);
  assert.match(second[0].components[1].label, /Pausar/);
  assert.match(first[1].components[0].label, /✅/);
  assert.match(second[1].components[0].label, /❌/);
});
