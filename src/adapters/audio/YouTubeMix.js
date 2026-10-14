/** Usa a ordem do Mix do YouTube; não classifica títulos, artistas ou duração. */
export default class YouTubeMix {
  #mixes = new WeakMap();

  constructor({ extract }) {
    this.extract = extract;
  }

  async candidates(song, previousSongs = []) {
    const mix = this.#mixes.get(song) ?? { entries: [], excludedIds: new Set() };
    for (const played of [song, ...previousSongs]) mix.excludedIds.add(String(played.id));

    const available = () =>
      mix.entries.filter(entry => entry?.id && !mix.excludedIds.has(String(entry.id)));

    // Reaproveita a lista. Ao esgotá-la, consulta o Mix da faixa atual.
    if (!available().length) {
      const id = encodeURIComponent(song.id);
      const info = await this.extract(
        'https://www.youtube.com/watch?v=' + id + '&list=RD' + id,
        { flatPlaylist: true, playlistEnd: 25 },
        { timeout: 15_000 },
      );
      mix.entries = info.entries ?? [];
      this.#mixes.set(song, mix);
    }

    return available().map(info => ({ info, mix }));
  }

  remember(song, mix) {
    this.#mixes.set(song, mix);
  }

  reject(song, mix) {
    mix.excludedIds.add(String(song.id));
  }
}
