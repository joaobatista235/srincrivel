import { test } from 'node:test';
import assert from 'node:assert/strict';
import YtDlpExtractor from '../src/services/YtDlpExtractor.js';

test('busca por nome retorna uma única música em vez de tocar toda a busca', async () => {
  const plugin = new YtDlpExtractor();
  plugin.resolve = async (query, options) => {
    assert.equal(query, 'ytsearch1:teste');
    assert.equal(options.member, 'member');
    return { songs: [{ id: 'first' }, { id: 'second' }] };
  };
  assert.equal((await plugin.searchSong('teste', { member: 'member' })).id, 'first');
});

test('autoplay busca 10 vídeos pelo título e artista sem repetir o vídeo atual', async () => {
  const plugin = new YtDlpExtractor({ extract: async (url, flags, options) => {
    assert.equal(url, 'ytsearch10:Artista Atual');
    assert.equal(flags.flatPlaylist, true);
    assert.equal(options.timeout, 30_000);
    return { entries: [{ id: 'current', title: 'Atual' }, null, { id: 'next', title: 'Próxima', duration: 30 }] };
  } });
  const songs = await plugin.getRelatedSongs({ url: 'https://youtu.be/current', id: 'current', name: 'Atual', uploader: { name: 'Artista' } });
  assert.deepEqual(songs.map(song => song.id), ['next']);
  assert.equal(songs[0].plugin, plugin);
});

test('autoplay não cria URLs do YouTube para outras fontes', async () => {
  const plugin = new YtDlpExtractor({ extract: async () => { throw new Error('não deve ser chamado'); } });
  assert.deepEqual(await plugin.getRelatedSongs({ url: 'https://example.com/music.mp3' }), []);
});
