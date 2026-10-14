import { test } from 'node:test';
import assert from 'node:assert/strict';
import YtDlpExtractor from '../src/adapters/audio/YtDlpExtractor.js';

test('busca por nome retorna uma única música em vez de tocar toda a busca', async () => {
  const plugin = new YtDlpExtractor();

  plugin.resolve = async (query, options) => {
    assert.equal(query, 'ytsearch1:teste');
    assert.equal(options.member, 'member');

    return { songs: [{ id: 'first' }, { id: 'second' }] };
  };
  assert.equal((await plugin.searchSong('teste', { member: 'member' })).id, 'first');
});

test('autoplay consulta o Mix do vídeo atual', async () => {
  const plugin = new YtDlpExtractor({
    extract: async (url, flags, options) => {
      if (flags.noPlaylist) return { url: 'https://example.com/audio' };
      assert.equal(url, 'https://www.youtube.com/watch?v=current&list=RDcurrent');
      assert.equal(flags.flatPlaylist, true);
      assert.equal(options.timeout, 15_000);

      return {
        entries: [
          { id: 'current', title: 'Artista - Atual (Official Audio)', duration: 180 },
          null,
          { id: 'next', title: 'Artista - Próxima (Official Audio)', duration: 180 },
        ],
      };
    },
  });
  const songs = await plugin.getRelatedSongs({
    url: 'https://youtu.be/current',
    id: 'current',
    name: 'Atual',
    uploader: { name: 'Artista' },
  });

  assert.deepEqual(
    songs.map(song => song.id),
    ['next'],
  );
  assert.equal(songs[0].plugin, plugin);
});

test('autoplay não cria URLs do YouTube para outras fontes', async () => {
  const plugin = new YtDlpExtractor({
    extract: async () => {
      throw new Error('não deve ser chamado');
    },
  });

  assert.deepEqual(await plugin.getRelatedSongs({ url: 'https://example.com/music.mp3' }), []);
});

test('URLs válidas são aceitas e entradas locais ou esquemas diferentes são rejeitados', () => {
  const plugin = new YtDlpExtractor();
  for (const url of ['https://youtu.be/example', 'http://example.com/audio'])
    assert.equal(plugin.validate(url), true);
  for (const url of ['texto', 'file:///local.mp3', 'ftp://example.com/audio'])
    assert.equal(plugin.validate(url), false);
});

test('resolução de playlist ignora entradas indisponíveis e preserva os metadados', async () => {
  const plugin = new YtDlpExtractor({
    extract: async () => ({
      id: 'list',
      title: 'Lista',
      entries: [
        null,
        {},
        { id: 'first', title: 'Primeira', webpage_url: 'https://youtu.be/first', duration: 30 },
      ],
    }),
  });
  const playlist = await plugin.resolve('https://youtube.com/playlist?list=list');
  assert.equal(playlist.name, 'Lista');
  assert.deepEqual(
    playlist.songs.map(song => song.id),
    ['first'],
  );
});

test('playlist vazia e stream indisponível produzem erros específicos', async () => {
  const empty = new YtDlpExtractor({ extract: async () => ({ entries: [null, {}] }) });
  await assert.rejects(empty.resolve('https://example.com/list'), { code: 'NO_RESULT' });
  const missing = new YtDlpExtractor({ extract: async () => ({}) });
  await assert.rejects(missing.getStreamURL({ url: 'https://youtu.be/example' }), {
    code: 'CANNOT_GET_STREAM',
  });
});

test('música ao vivo mantém propriedades e stream usa formato de áudio', async () => {
  const calls = [];
  const plugin = new YtDlpExtractor({
    extract: async (input, flags) => {
      calls.push({ input, flags });
      return flags.noPlaylist
        ? { url: 'https://example.com/stream' }
        : {
            id: 'live',
            fulltitle: 'Ao vivo',
            original_url: 'https://youtu.be/live',
            is_live: true,
            thumbnails: [{ url: 'https://example.com/thumbnail' }],
            channel: 'Canal',
            age_limit: 0,
          };
    },
  });
  const song = await plugin.resolve('https://youtu.be/live');
  assert.equal(song.name, 'Ao vivo');
  assert.equal(song.isLive, true);
  assert.equal(song.duration, 0);
  assert.equal(song.ageRestricted, false);
  assert.equal(await plugin.getStreamURL(song), 'https://example.com/stream');
  assert.deepEqual(calls[1].flags, { noPlaylist: true, format: 'bestaudio/best' });
});
