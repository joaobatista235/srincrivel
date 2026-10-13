import { PlayableExtractorPlugin, Song, Playlist, DisTubeError } from 'distube';
import { extractMetadata } from './ytDlpProcess.js';

export default class YtDlpExtractor extends PlayableExtractorPlugin {
  constructor({ extract = extractMetadata } = {}) {
    super();
    this.extract = extract;
  }

  validate(input) {
    try { return ['https:', 'http:'].includes(new URL(input).protocol); }
    catch { return false; }
  }

  songFromInfo(info, options) {
    return new Song({
      plugin: this, source: info.extractor || 'youtube', playFromSource: true,
      id: String(info.id), name: info.title || info.fulltitle || String(info.id),
      url: info.webpage_url || info.original_url || info.url,
      duration: info.is_live ? 0 : info.duration || 0, isLive: Boolean(info.is_live),
      thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
      uploader: { name: info.uploader || info.channel, url: info.uploader_url || info.channel_url },
      ageRestricted: Number(info.age_limit) >= 18,
    }, options);
  }

  async resolve(input, options) {
    const info = await this.extract(input, { flatPlaylist: true });
    if (!Array.isArray(info.entries)) return this.songFromInfo(info, options);
    const songs = info.entries.filter(entry => entry?.id).map(entry => this.songFromInfo(entry, options));
    if (!songs.length) throw new DisTubeError('NO_RESULT');
    return new Playlist({ songs, source: info.extractor || 'youtube', id: String(info.id || input),
      name: info.title || input, url: info.webpage_url || input }, options);
  }

  async getStreamURL(song) {
    const info = await this.extract(song.url, { noPlaylist: true, format: 'bestaudio/best' });
    if (!info.url) throw new DisTubeError('CANNOT_GET_STREAM', song);
    return info.url;
  }

  async searchSong(query, options) {
    const result = await this.resolve(`ytsearch1:${query}`, options);
    return result.songs?.[0] ?? result;
  }

  async getRelatedSongs(song) {
    const url = new URL(song.url);
    if (!['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].includes(url.hostname)) return [];
    const query = [song.uploader?.name, song.name].filter(Boolean).join(' ');
    const info = await this.extract(`ytsearch10:${query}`, { flatPlaylist: true }, { timeout: 30_000 });
    return (info.entries ?? []).filter(entry => entry?.id && entry.id !== song.id).map(entry =>
      this.songFromInfo({ ...entry, webpage_url: `https://www.youtube.com/watch?v=${encodeURIComponent(entry.id)}` }));
  }
}
