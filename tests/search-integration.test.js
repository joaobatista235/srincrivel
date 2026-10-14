import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client, GatewayIntentBits } from 'discord.js';
import { DisTube, Song, Playlist } from 'distube';
import YtDlpExtractor from '../src/adapters/audio/YtDlpExtractor.js';

function setup(t, extract) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  t.after(() => client.destroy());
  const plugin = new YtDlpExtractor({ extract });
  const distube = new DisTube(client, { plugins: [plugin] });

  return { plugin, distube };
}

test('resolvedor real do DisTube encaminha texto ao YouTube e retorna somente a primeira música', async t => {
  const calls = [];
  const { plugin, distube } = setup(t, async (input, flags) => {
    calls.push({ input, flags });
    return {
      id: 'search',
      title: 'Busca',
      entries: [
        {
          id: 'first',
          title: 'Bad Omens - Just Pretend',
          webpage_url: 'https://youtu.be/first',
          duration: 30,
        },
        { id: 'second', title: 'Outra', webpage_url: 'https://youtu.be/second' },
      ],
    };
  });
  const song = await distube.handler.resolve('bad omens', { metadata: { request: 'test' } });

  assert.ok(song instanceof Song);
  assert.equal(song instanceof Playlist, false);
  assert.equal(song.id, 'first');
  assert.equal(song.plugin, plugin);
  assert.deepEqual(song.metadata, { request: 'test' });
  assert.deepEqual(calls, [{ input: 'ytsearch1:bad omens', flags: { flatPlaylist: true } }]);
});

test('resolvedor real continua encaminhando links diretamente, sem transformar em busca', async t => {
  const calls = [];
  const url = 'https://www.youtube.com/watch?v=example';
  const { distube } = setup(t, async input => {
    calls.push(input);
    return { id: 'example', title: 'Música', webpage_url: url, duration: 30 };
  });
  const song = await distube.handler.resolve(url);

  assert.ok(song instanceof Song);
  assert.equal(song.url, url);
  assert.deepEqual(calls, [url]);
});

test('resolvedor real preserva playlists em URLs e trata busca sem resultados', async t => {
  const { distube } = setup(t, async input =>
    input.startsWith('ytsearch1:')
      ? { entries: [] }
      : {
          id: 'list',
          title: 'Playlist',
          entries: [
            { id: 'first', title: 'Primeira', webpage_url: 'https://youtu.be/first' },
            { id: 'second', title: 'Segunda', webpage_url: 'https://youtu.be/second' },
          ],
        },
  );
  const playlist = await distube.handler.resolve('https://www.youtube.com/playlist?list=example');

  assert.ok(playlist instanceof Playlist);
  assert.equal(playlist.songs.length, 2);
  await assert.rejects(distube.handler.resolve('sem resultado'), { code: 'NO_RESULT' });
});
