import { test } from 'node:test';
import assert from 'node:assert/strict';
import YtDlpExtractor from '../src/adapters/audio/YtDlpExtractor.js';
import MusicActions from '../src/application/music/MusicActions.js';
import VoiceSessionCoordinator from '../src/application/audio/VoiceSessionCoordinator.js';
import MusicPanel from '../src/adapters/discord/presentation/MusicPanel.js';
import DisTubePlayer from '../src/adapters/audio/DisTubePlayer.js';
import { Client, GatewayIntentBits } from 'discord.js';
import { DisTube, Queue } from 'distube';
import InteractionRouter from '../src/adapters/discord/InteractionRouter.js';
import CommandRegistry from '../src/adapters/discord/CommandRegistry.js';
import { ApplicationError } from '../src/application/errors/ApplicationError.js';

function metadataPlugin({ extract }) {
  return new YtDlpExtractor({
    extract: (input, flags, options) =>
      flags?.noPlaylist
        ? Promise.resolve({ url: 'https://example.com/audio' })
        : extract(input, flags, options),
  });
}

const seed = () => ({
  id: 'seed',
  name: 'Bad Omens - Specter (Official Music Video)',
  url: 'https://youtu.be/seed',
  uploader: { name: 'Sumerian Records' },
});
const entry = (id, title = id, fields = {}) => ({
  id,
  title: 'Bad Omens - ' + title + ' (Official Audio)',
  duration: 200,
  channel: 'Bad Omens',
  webpage_url: 'https://youtu.be/' + id,
  ...fields,
});

test('autoplay usa o Mix na ordem do YouTube, incluindo outros artistas e músicas fora dos filtros antigos', async () => {
  const calls = [];
  const plugin = metadataPlugin({
    extract: async (url, flags, options) => {
      calls.push({ url, flags, options });
      return {
        entries: [
          entry('seed', 'Specter'),
          null,
          entry('other', 'Next', {
            title: 'Bring Me The Horizon - Throne',
            channel: 'Bring Me The Horizon',
            duration: 60,
          }),
          entry('long', 'Long Track', { duration: 1000 }),
        ],
      };
    },
  });
  const next = (await plugin.getRelatedSongs(seed()))[0];
  assert.equal(next.id, 'other');
  assert.equal(next.name, 'Bring Me The Horizon - Throne');
  assert.deepEqual(calls, [
    {
      url: 'https://www.youtube.com/watch?v=seed&list=RDseed',
      flags: { flatPlaylist: true, playlistEnd: 25 },
      options: { timeout: 15_000 },
    },
  ]);
  assert.equal((await plugin.getRelatedSongs(next))[0].id, 'long');
  assert.equal(calls.length, 1);
});

test('fila real do DisTube consegue seis skips usando um único Mix, sem repetir vídeos', async t => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  t.after(() => client.destroy());
  let mixes = 0;
  const plugin = metadataPlugin({
    extract: async query => {
      if (query.startsWith('ytsearch1:')) return { entries: [entry('seed', 'Specter')] };
      mixes++;
      return { entries: Array.from({ length: 8 }, (_, index) => entry('track' + index)) };
    },
  });
  const distube = new DisTube(client, { plugins: [plugin], savePreviousSongs: true });
  const queue = new Queue(distube, {
    id: '123456789012345678',
    stop() {},
    channel: { guild: { members: {} } },
  });
  queue.songs.push(await distube.handler.resolve('bad omens'));
  queue.autoplay = true;
  const ids = [];
  for (let i = 0; i < 6; i++) {
    await queue.skip();
    ids.push(queue.songs[0].id);
  }
  assert.equal(new Set(ids).size, 6);
  assert.equal(queue.previousSongs.length, 6);
  assert.equal(mixes, 1);
});

test('Mix esgotado é renovado pela faixa atual, considerando vídeos já tocados no servidor', async () => {
  const calls = [];
  const plugin = metadataPlugin({
    extract: async url => {
      calls.push(url);
      return {
        entries: url.includes('v=seed&')
          ? [entry('played'), entry('next')]
          : [entry('seed'), entry('played'), entry('next'), entry('new')],
      };
    },
  });
  plugin.distube = { getQueue: () => ({ previousSongs: [{ id: 'played', name: 'Outra' }] }) };
  const current = { ...seed(), member: { guild: { id: 'guild' } } };
  const next = (await plugin.getRelatedSongs(current))[0];
  assert.equal(next.id, 'next');
  assert.equal((await plugin.getRelatedSongs(next))[0].id, 'new');
  assert.deepEqual(calls, [
    'https://www.youtube.com/watch?v=seed&list=RDseed',
    'https://www.youtube.com/watch?v=next&list=RDnext',
  ]);
});

test('Mix vazio encerra sugestões e erros de extração continuam visíveis', async () => {
  const empty = metadataPlugin({ extract: async () => ({ entries: [] }) });
  assert.deepEqual(await empty.getRelatedSongs(seed()), []);
  const cause = new Error('network');
  const failing = metadataPlugin({
    extract: async () => {
      throw cause;
    },
  });
  await assert.rejects(failing.getRelatedSongs(seed()), error => error === cause);
});

function actions(player) {
  const coordinator = new VoiceSessionCoordinator(id => player.state(id));
  return new MusicActions({ player, coordinator, stopIntro() {} });
}
const input = { guildId: 'guild', voiceChannelId: 'voice' };

test('cliques e slash commands concorrentes não enfileiram skips; erro libera a trava', async () => {
  let reject;
  let skips = 0;
  const player = {
    state: () => ({ hasQueue: true, channelId: 'voice' }),
    skip: () => {
      skips++;
      return new Promise((_resolve, fail) => {
        reject = fail;
      });
    },
    previous: () => {
      throw new Error('não deve executar');
    },
  };
  const music = actions(player);
  const pending = music.skip(input);
  for (let i = 0; i < 5; i++) await assert.rejects(music.skip(input), { code: 'MUSIC_TRANSITION' });
  await assert.rejects(music.previous(input), { code: 'MUSIC_TRANSITION' });
  assert.equal(skips, 1);
  reject(Object.assign(new Error('sem sugestões'), { code: 'NO_RELATED' }));
  await assert.rejects(pending, { code: 'NO_RELATED' });
  player.skip = async () => {
    skips++;
  };
  await music.skip(input);
  assert.equal(skips, 2);
});

test('trava de troca pertence ao servidor, sem bloquear skips em outro servidor', async () => {
  let finish;
  const player = {
    state: () => ({ hasQueue: true, channelId: 'voice' }),
    skip: id =>
      id === 'guild'
        ? new Promise(resolve => {
            finish = resolve;
          })
        : Promise.resolve(),
  };
  const music = actions(player);
  const pending = music.skip(input);
  await music.skip({ ...input, guildId: 'other' });
  finish();
  await pending;
});

function panels(options = {}) {
  const edits = [];
  let sequence = 0;
  const panel = new MusicPanel(
    {
      channels: {
        cache: new Map([
          [
            'text',
            {
              send: async () => ({
                id: 'panel' + ++sequence,
                edit: async payload => edits.push(payload),
              }),
            },
          ],
        ]),
      },
    },
    options,
  );
  const event = { guildId: 'guild', textChannelId: 'text', song: { name: 'Track' }, state: {} };
  return { panel, edits, event };
}

test('skip permanece protegido até o novo painel ser publicado e os botões serem reativados', async () => {
  const { panel, edits, event } = panels();
  await panel.show(event);
  let nativeSkipped;
  const skipped = new Promise(resolve => {
    nativeSkipped = resolve;
  });
  const queue = {
    skip: async () => {
      nativeSkipped();
    },
    paused: false,
    autoplay: true,
  };
  const player = new DisTubePlayer({
    distube: { getQueue: () => queue, voices: { get: () => ({ channel: { id: 'voice' } }) } },
    transition: (id, operation) => panel.transition(id, operation, () => player.state(id)),
  });
  const music = actions(player);
  const pending = music.skip(input);
  await skipped;
  assert.throws(() => panel.validate('guild', 'panel1'), { code: 'MUSIC_TRANSITION' });
  await assert.rejects(music.skip(input), { code: 'MUSIC_TRANSITION' });
  assert.ok(
    edits[0].components.every(row => row.toJSON().components.every(button => button.disabled)),
  );
  await panel.show({ ...event, song: { name: 'Next' } });
  await pending;
  assert.throws(() => panel.validate('guild', 'panel1'), { code: 'STALE_PANEL' });
  panel.validate('guild', 'panel2');
  assert.ok(
    edits.at(-1).components.every(row => row.toJSON().components.every(button => !button.disabled)),
  );
});

test('NO_RELATED restaura o painel atual, sem deixar os controles bloqueados', async () => {
  const { panel, edits, event } = panels();
  await panel.show(event);
  await assert.rejects(
    panel.transition(
      'guild',
      async () => {
        throw Object.assign(new Error('empty'), { code: 'NO_RELATED' });
      },
      () => ({}),
    ),
    { code: 'NO_RELATED' },
  );
  panel.validate('guild', 'panel1');
  assert.ok(
    edits.at(-1).components.every(row => row.toJSON().components.every(button => !button.disabled)),
  );
});

test('timeout de publicação invalida o painel antigo sem criar trava permanente', async () => {
  const { panel, event } = panels({ transitionTimeoutMs: 1 });
  await panel.show(event);
  await panel.transition(
    'guild',
    async () => {},
    () => ({}),
  );
  assert.throws(() => panel.validate('guild', 'panel1'), { code: 'STALE_PANEL' });
  await panel.show(event);
  panel.validate('guild', 'panel2');
});

test('ausência real de sugestões recebe orientação privada sem registrar stack de erro esperado', async t => {
  const logs = [];
  const replies = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  const router = new InteractionRouter(new CommandRegistry(), {
    music: {
      skip: async () => {
        throw new ApplicationError('NO_RELATED', {}, { cause: new Error('empty') });
      },
    },
  });
  const interaction = {
    commandName: 'skip',
    guildId: 'guild',
    user: { id: 'user' },
    member: { voice: { channelId: 'voice' } },
    isButton: () => false,
    isChatInputCommand: () => true,
    inGuild: () => true,
    deferReply: async () => {
      interaction.deferred = true;
    },
    editReply: async payload => replies.push(payload),
  };
  await router.handleInteraction(interaction);
  assert.match(replies[0].content, /\/play/);
  assert.equal(logs.length, 0);
});

test('painel enviado após timeout recebe controles ativos e o painel antigo permanece inválido', async () => {
  let finishSend;
  let sequence = 0;
  const edits = [];
  const panel = new MusicPanel(
    {
      channels: {
        cache: new Map([
          [
            'text',
            {
              send: () =>
                ++sequence === 1
                  ? Promise.resolve({ id: 'old', edit: async data => edits.push(data) })
                  : new Promise(resolve => {
                      finishSend = resolve;
                    }),
            },
          ],
        ]),
      },
    },
    { transitionTimeoutMs: 1 },
  );
  const event = { guildId: 'guild', textChannelId: 'text', song: {}, state: {} };
  await panel.show(event);
  let skipped;
  const began = new Promise(resolve => {
    skipped = resolve;
  });
  const transition = panel.transition(
    'guild',
    async () => {
      skipped();
    },
    () => ({}),
  );
  await began;
  const sending = panel.show(event);
  while (!finishSend) await Promise.resolve();
  await transition;
  assert.throws(() => panel.validate('guild', 'old'), { code: 'STALE_PANEL' });
  finishSend({ id: 'new', edit: async data => edits.push(data) });
  await sending;
  panel.validate('guild', 'new');
  assert.ok(
    edits.at(-1).components.every(row => row.toJSON().components.every(button => !button.disabled)),
  );
});

test('encerramento libera a espera de painel e impede novas publicações', async () => {
  const { panel, event } = panels();
  await panel.show(event);
  let skipped;
  const began = new Promise(resolve => {
    skipped = resolve;
  });
  const transition = panel.transition(
    'guild',
    async () => {
      skipped();
    },
    () => ({}),
  );
  await began;
  panel.destroy();
  await transition;
  await panel.show(event);
  assert.throws(() => panel.validate('guild', 'panel2'), { code: 'STALE_PANEL' });
  await assert.rejects(
    panel.transition(
      'guild',
      async () => {},
      () => ({}),
    ),
    { code: 'PLAYER_CLOSED' },
  );
});
