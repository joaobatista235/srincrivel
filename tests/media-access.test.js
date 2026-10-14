import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { Client, GatewayIntentBits } from 'discord.js';
import { DisTube, Queue } from 'distube';
import YtDlpExtractor from '../src/adapters/audio/YtDlpExtractor.js';
import DisTubeEvents from '../src/adapters/audio/DisTubeEvents.js';
import { playerError } from '../src/adapters/audio/playerErrors.js';
import { errorMessage } from '../src/adapters/discord/presentation/errorMessages.js';

const blocked = () =>
  Object.assign(new Error('yt-dlp failed'), {
    stderr:
      'ERROR: [youtube] example: Sign in to confirm your age. Use --cookies for authentication.',
  });
const seed = () => ({
  id: 'current',
  name: 'Band - Current',
  url: 'https://youtu.be/current',
  uploader: { name: 'Band' },
});
const entry = (id, fields = {}) => ({
  id,
  title: 'Band - ' + id + ' (Official Audio)',
  channel: 'Band',
  duration: 200,
  webpage_url: 'https://youtu.be/' + id,
  ...fields,
});

test('erro real de verificação de idade vira mensagem específica, preservando a causa', () => {
  const cause = blocked();
  cause.name = 'PlayingError';
  const error = playerError(cause);
  assert.equal(error.code, 'MEDIA_AGE_RESTRICTED');
  assert.equal(error.cause, cause);
  assert.match(errorMessage(error), /verificação de idade/);
});

test('metadados de restrição de idade impedem extrair áudio de um vídeo manual', async () => {
  let requests = 0;
  const plugin = new YtDlpExtractor({
    extract: async () => {
      requests++;
      return {};
    },
  });
  await assert.rejects(
    plugin.getStreamURL({ url: 'https://youtu.be/blocked', ageRestricted: true }),
    { code: 'MEDIA_AGE_RESTRICTED' },
  );
  assert.equal(requests, 0);
});

test('restrição descoberta ao extrair metadados do link também é classificada', async () => {
  const plugin = new YtDlpExtractor({
    extract: async () => {
      throw blocked();
    },
  });
  await assert.rejects(plugin.resolve('https://youtu.be/blocked'), {
    code: 'MEDIA_AGE_RESTRICTED',
  });
  await assert.rejects(plugin.getStreamURL({ url: 'https://youtu.be/blocked' }), {
    code: 'MEDIA_AGE_RESTRICTED',
  });
});

test('autoplay verifica restrições sem reordenar as recomendações do Mix', async () => {
  const streams = [];
  const plugin = new YtDlpExtractor({
    extract: async (input, flags) => {
      if (flags.noPlaylist) {
        streams.push(input);
        if (input.endsWith('private'))
          throw Object.assign(new Error('private'), { stderr: 'This video is private' });
        return { url: 'https://example.com/audio' };
      }
      return {
        entries: [
          entry('adult', { age_limit: 18 }),
          entry('private', { availability: 'private' }),
          entry('public'),
        ],
      };
    },
  });
  const songs = await plugin.getRelatedSongs(seed());
  assert.deepEqual(
    songs.map(song => song.id),
    ['public'],
  );
  assert.equal(streams.length, 2);
});

test('restrição ausente na busca é detectada antes da fila e o autoplay escolhe o próximo candidato', async () => {
  const streams = [];
  const plugin = new YtDlpExtractor({
    extract: async (input, flags, options) => {
      if (!flags.noPlaylist) return { entries: [entry('hidden'), entry('public')] };
      assert.equal(options.timeout, 15_000);
      streams.push(input);
      if (input.endsWith('hidden')) throw blocked();
      return { url: 'https://example.com/audio' };
    },
  });
  const current = seed();
  const songs = await plugin.getRelatedSongs(current);
  assert.equal(songs[0].id, 'public');
  assert.equal(songs[0].stream.url, 'https://example.com/audio');
  await plugin.getRelatedSongs(current);
  assert.equal(streams.filter(url => url.endsWith('hidden')).length, 1);
});

test('restrição de um vídeo permite outra versão pública da mesma música', async () => {
  const plugin = new YtDlpExtractor({
    extract: async (input, flags) => {
      if (!flags.noPlaylist)
        return {
          entries: [
            entry('blocked', { title: 'Band - Another (Official Video)' }),
            entry('audio', { title: 'Band - Another (Official Audio)' }),
          ],
        };
      if (input.endsWith('blocked')) throw blocked();
      return { url: 'https://example.com/audio' };
    },
  });
  assert.equal((await plugin.getRelatedSongs(seed()))[0].id, 'audio');
});

test('fila real continua no autoplay sem adicionar a faixa restrita e sem extrair o stream duas vezes', async t => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  t.after(() => client.destroy());
  let validStreams = 0;
  const plugin = new YtDlpExtractor({
    extract: async (input, flags) => {
      if (flags.noPlaylist) {
        if (input.endsWith('blocked')) throw blocked();
        validStreams++;
        return { url: 'https://example.com/audio' };
      }
      return {
        entries: input.startsWith('ytsearch1:')
          ? [entry('current')]
          : [entry('blocked'), entry('public')],
      };
    },
  });
  const distube = new DisTube(client, { plugins: [plugin], savePreviousSongs: true });
  const queue = new Queue(distube, {
    id: '123456789012345678',
    stop() {},
    channel: { guild: { members: {} } },
  });
  queue.songs.push(await distube.handler.resolve('Band Current'));
  queue.autoplay = true;
  await queue.skip();
  assert.equal(queue.songs[0].id, 'public');
  await distube.handler.attachStreamInfo(queue.songs[0]);
  assert.equal(validStreams, 1);
});

test('cinco candidatos bloqueados encerram tentativas sem alterar a música atual da fila', async t => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  t.after(() => client.destroy());
  let attempts = 0;
  const plugin = new YtDlpExtractor({
    extract: async (input, flags) => {
      if (flags.noPlaylist) {
        attempts++;
        throw blocked();
      }
      return {
        entries: input.startsWith('ytsearch1:')
          ? [entry('current')]
          : Array.from({ length: 10 }, (_, index) => entry('blocked' + index)),
      };
    },
  });
  const distube = new DisTube(client, { plugins: [plugin], savePreviousSongs: true });
  const queue = new Queue(distube, {
    id: '123456789012345678',
    stop() {},
    channel: { guild: { members: {} } },
  });
  queue.songs.push(await distube.handler.resolve('Band Current'));
  queue.autoplay = true;
  await assert.rejects(queue.skip(), { code: 'NO_RELATED' });
  assert.equal(attempts, 5);
  assert.equal(queue.songs[0].id, 'current');
  assert.equal(queue.previousSongs.length, 0);
});

test('erros de rede e bloqueio anti-bot não são confundidos com restrição etária', async () => {
  const cause = Object.assign(new Error('network'), {
    stderr: "Sign in to confirm you're not a bot",
  });
  const plugin = new YtDlpExtractor({
    extract: async (_input, flags) => {
      if (flags.noPlaylist) throw cause;
      return { entries: [entry('next')] };
    },
  });
  await assert.rejects(plugin.getRelatedSongs(seed()), error => error === cause);
  assert.equal(playerError(cause).code, 'PLAYER_FAILED');
});

test('evento de reprodução bloqueada publica erro específico sem despejar o comando e stderr', async t => {
  const distube = new EventEmitter();
  const logs = [];
  let received;
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  t.mock.method(console, 'error', () => {
    throw new Error('Não deve registrar stack de restrição esperada');
  });
  const events = new DisTubeEvents(distube, {
    error: event => {
      received = event;
    },
  });
  events.init();
  distube.emit('error', blocked(), { textChannel: { id: 'text' } });
  await setImmediate();
  events.destroy();
  assert.equal(received.error.code, 'MEDIA_AGE_RESTRICTED');
  assert.equal(received.textChannelId, 'text');
  assert.deepEqual(logs, [['Mídia indisponível:', 'MEDIA_AGE_RESTRICTED']]);
});
