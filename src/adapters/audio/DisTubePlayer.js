import { ApplicationError } from '../../application/errors/ApplicationError.js';
import { playerError } from './playerErrors.js';
/** DisTube implementation of the application player port. SDK objects stay here. */
export default class DisTubePlayer {
  #destroyed = false;
  constructor({ client, distube }) { this.client = client; this.distube = distube; }
  state(guildId) {
    const queue = this.distube.getQueue(guildId);
    const channelId = this.distube.voices.get(guildId)?.channel?.id;
    return queue || channelId ? { hasQueue: Boolean(queue), channelId, paused: Boolean(queue?.paused), autoplay: Boolean(queue?.autoplay) } : null;
  }
  async #call(operation) { try { return await operation(); } catch (error) { throw playerError(error); } }
  #queue(guildId) {
    const queue = this.distube.getQueue(guildId);
    if (!queue) throw new ApplicationError('NO_QUEUE');
    return queue;
  }
  async play({ guildId, voiceChannelId, textChannelId, userId, query }) {
    return this.#call(async () => {
      if (this.#destroyed) throw new ApplicationError('PLAYER_CLOSED');
      const guild = this.client.guilds.cache.get(guildId);
      const channel = guild?.channels.cache.get(voiceChannelId);
      if (!channel?.isVoiceBased()) throw new ApplicationError('VOICE_REQUIRED');
      const member = await guild.members.fetch(userId);
      if (this.#destroyed) throw new ApplicationError('PLAYER_CLOSED');
      const textChannel = guild.channels.cache.get(textChannelId);
      try { await this.distube.play(channel, query, { member, textChannel }); }
      finally { if (this.#destroyed) this.distube.voices.leave(guildId); }
    });
  }
  pause(guildId) { return this.#call(() => this.#queue(guildId).pause()); }
  resume(guildId) { return this.#call(() => this.#queue(guildId).resume()); }
  toggleAutoplay(guildId) { return this.#call(() => this.#queue(guildId).toggleAutoplay()); }
  skip(guildId) { return this.#call(() => this.#queue(guildId).skip()); }
  previous(guildId) { return this.#call(async () => ({ name: (await this.#queue(guildId).previous()).name })); }
  stop(guildId) { return this.#call(() => this.#queue(guildId).stop()); }
  leave(guildId) { return this.#call(() => this.distube.voices.leave(guildId)); }
  destroy() { this.#destroyed = true; for (const voice of this.distube.voices.collection.values()) voice.leave(); }
}
