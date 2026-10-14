const CACHE_TTL = 5 * 60_000;
const normalize = value =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const cleanChannel = value =>
  String(value ?? '')
    .replace(/(?:\s*-\s*Topic|VEVO|\s+Official)$/i, '')
    .trim();
const unwanted =
  /\b(reaction|reacts|reacting|interview|podcast|tutorial|review|cover|karaoke|remix|slowed|sped up|nightcore|mashup|teaser|trailer|shorts|compilation|full album|live stream|livestream|gameplay)\b/i;
const musicMarker =
  /\b(official audio|official music video|official video|lyrics?|lyric video|visuali[sz]er)\b/i;

function artistOf(song) {
  const title = String(song.name ?? '');
  const separated = title.split(/\s[-–—]\s/);
  const artist = separated.length > 1 ? separated[0] : cleanChannel(song.uploader?.name);
  return artist?.split(/\s+(?:feat\.?|ft\.?|&|x)\s+/i)[0]?.trim();
}

function trackKey(title) {
  return normalize(
    String(title ?? '')
      .replace(/^.*?\s[-–—]\s/, '')
      .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
      .replace(
        /\b(official|music video|audio|video|lyrics?|visuali[sz]er|hd|hq|4k|explicit)\b/gi,
        '',
      ),
  );
}

/** A bounded, per-playback pool of music candidates. No stream URLs are cached. */
export default class YouTubeRecommendations {
  #contexts = new WeakMap();

  constructor({ extract, now = Date.now }) {
    this.extract = extract;
    this.now = now;
  }

  async related(song, previousSongs = []) {
    let context = this.#contexts.get(song);
    if (!context) {
      const artist = artistOf(song);
      if (!artist) return [];
      context = { artist, pool: [], ids: new Set(), tracks: new Set(), queryIndex: 0, expires: 0 };
      this.#contexts.set(song, context);
    }

    for (const played of [song, ...previousSongs]) {
      context.ids.add(String(played.id));
      const key = trackKey(played.name);
      if (key) context.tracks.add(key);
    }

    if (context.expires <= this.now()) {
      context.pool = [];
      context.queryIndex = 0;
      context.expires = this.now() + CACHE_TTL;
    }

    const available = () =>
      context.pool.filter(
        entry => !context.ids.has(String(entry.id)) && !context.tracks.has(trackKey(entry.title)),
      );
    const queries = [
      context.artist + ' official audio',
      context.artist + ' official music video',
      context.artist + ' songs',
    ];
    let lastError;
    let successfulSearch = false;

    while (!available().length && context.queryIndex < queries.length) {
      const query = queries[context.queryIndex++];
      try {
        const info = await this.extract(
          'ytsearch20:' + query,
          { flatPlaylist: true },
          { timeout: 15_000 },
        );
        successfulSearch = true;
        const unique = new Map(context.pool.map(entry => [String(entry.id), entry]));
        for (const entry of info.entries ?? []) {
          if (this.#score(entry, context.artist) > 0) unique.set(String(entry.id), entry);
        }
        context.pool = [...unique.values()].sort(
          (a, b) => this.#score(b, context.artist) - this.#score(a, context.artist),
        );
      } catch (error) {
        lastError = error;
      }
    }

    const tracks = new Set();
    const result = available().filter(entry => {
      const key = trackKey(entry.title);
      if (!key || tracks.has(key)) return false;
      tracks.add(key);
      return true;
    });
    if (!result.length && lastError && !successfulSearch) {
      context.queryIndex = 0;
      throw lastError;
    }

    return result.map(entry => ({ info: entry, context }));
  }

  remember(song, context) {
    this.#contexts.set(song, context);
  }

  #score(entry, artist) {
    if (
      !entry?.id ||
      entry._type === 'playlist' ||
      entry.is_live ||
      ['is_live', 'is_upcoming', 'post_live'].includes(entry.live_status)
    )
      return 0;
    const duration = Number(entry.duration);
    if (
      !Number.isFinite(duration) ||
      duration < 90 ||
      duration > 900 ||
      unwanted.test(entry.title ?? '')
    )
      return 0;

    const expected = normalize(artist);
    const title = normalize(entry.title);
    const channel = normalize(cleanChannel(entry.channel ?? entry.uploader));
    const sameChannel = channel === expected;
    if (!title.includes(expected) && !sameChannel) return 0;
    const categoryMusic = entry.categories?.includes('Music');
    if (!sameChannel && !categoryMusic && !musicMarker.test(entry.title ?? '')) return 0;

    const official = /\bofficial (audio|music video|video)\b/i.test(entry.title ?? '');
    return (
      (sameChannel ? 100 : 0) +
      (categoryMusic ? 60 : 0) +
      (official ? 160 : musicMarker.test(entry.title ?? '') ? 40 : 0) +
      (title.includes(expected) ? 20 : 0)
    );
  }
}
