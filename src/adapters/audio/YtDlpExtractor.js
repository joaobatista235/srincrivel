import { ExtractorPlugin, Song, Playlist, DisTubeError } from 'distube';
import { extractMetadata } from './ytDlpProcess.js';
import YouTubeMix from './YouTubeMix.js';
import { ApplicationError } from '../../application/errors/ApplicationError.js';
import { mediaAccessError, unavailableMedia } from './mediaAccess.js';

export default class YtDlpExtractor extends ExtractorPlugin {
  constructor({ extract = extractMetadata } = {}) {
    super();
    this.extract = extract;
    this.mix = new YouTubeMix({
      extract: (...args) => this.extract(...args),
    });
  }

  validate(input) {
    try {
      return ['https:', 'http:'].includes(new URL(input).protocol);
    } catch {
      return false;
    }
  }

  songFromInfo(info, options) {
    return new Song(
      {
        plugin: this,
        source: info.extractor || 'youtube',
        playFromSource: true,
        id: String(info.id),
        name: info.title || info.fulltitle || String(info.id),
        url: info.webpage_url || info.original_url || info.url,
        duration: info.is_live ? 0 : info.duration || 0,
        isLive: Boolean(info.is_live),
        thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
        uploader: {
          name: info.uploader || info.channel,
          url: info.uploader_url || info.channel_url,
        },
        ageRestricted: Number(info.age_limit) >= 18,
      },
      options,
    );
  }

  async resolve(input, options) {
    let info;
    try {
      info = await this.extract(input, { flatPlaylist: true });
    } catch (error) {
      throw mediaAccessError(error);
    }

    if (!Array.isArray(info.entries)) return this.songFromInfo(info, options);

    const songs = info.entries
      .filter(entry => entry?.id)
      .map(entry => this.songFromInfo(entry, options));

    if (!songs.length) throw new DisTubeError('NO_RESULT');

    return new Playlist(
      {
        songs,
        source: info.extractor || 'youtube',
        id: String(info.id || input),
        name: info.title || input,
        url: info.webpage_url || input,
      },
      options,
    );
  }

  async getStreamURL(song, options = {}) {
    if (song.ageRestricted) throw new ApplicationError('MEDIA_AGE_RESTRICTED');
    try {
      const info = await this.extract(
        song.url,
        { noPlaylist: true, format: 'bestaudio/best' },
        options,
      );
      if (Number(info.age_limit) >= 18) throw new ApplicationError('MEDIA_AGE_RESTRICTED');
      if (!info.url) throw new DisTubeError('CANNOT_GET_STREAM', song);
      return info.url;
    } catch (error) {
      throw mediaAccessError(error);
    }
  }

  async searchSong(query, options) {
    const result = await this.resolve(`ytsearch1:${query}`, options);

    return result.songs?.[0] ?? result;
  }

  async getRelatedSongs(song) {
    const url = new URL(song.url);

    if (!['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].includes(url.hostname))
      return [];

    const guildId = song.member?.guild?.id;
    const previousSongs = guildId ? (this.distube?.getQueue(guildId)?.previousSongs ?? []) : [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidates = await this.mix.candidates(song, previousSongs);
      const candidate = candidates[0];
      if (!candidate) return [];
      const { info, mix } = candidate;
      const next = this.songFromInfo({
        ...info,
        webpage_url: 'https://www.youtube.com/watch?v=' + encodeURIComponent(info.id),
      });
      this.mix.remember(next, mix);
      try {
        next.stream.url = await this.getStreamURL(next, { timeout: 15_000 });
        return [next];
      } catch (error) {
        if (!unavailableMedia(error)) throw error;
        this.mix.reject(next, mix);
      }
    }
    return [];
  }
}
