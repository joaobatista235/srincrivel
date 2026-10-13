import { ApplicationError } from '../errors/ApplicationError.js';

/** Input: {guildId,userId,voiceChannelId,textChannelId,query}; no SDK objects.
 * Player port: state/play/pause/resume/toggleAutoplay/skip/previous/stop/leave.
 */
export default class MusicActions {
  constructor({ player, coordinator, stopIntro }) {
    this.player = player;
    this.coordinator = coordinator;
    this.stopIntro = stopIntro;
  }

  #queue(input) {
    this.coordinator.authorize(input);
    this.coordinator.requireReady(input.guildId);
    const state = this.player.state(input.guildId);

    if (!state?.hasQueue) throw new ApplicationError('NO_QUEUE');

    return state;
  }

  async play(input) {
    const reservation = this.coordinator.reserveMusic(input);

    try {
      await this.player.play(input);
    } finally {
      this.coordinator.release(input.guildId, reservation);
    }

    return { code: 'ADDED' };
  }

  async pause(input) {
    const state = this.#queue(input);

    if (state.paused) {
      await this.player.resume(input.guildId);

      return { code: 'RESUMED' };
    }

    await this.player.pause(input.guildId);

    return { code: 'PAUSED' };
  }

  async resume(input) {
    if (!this.#queue(input).paused) throw new ApplicationError('ALREADY_PLAYING');

    await this.player.resume(input.guildId);

    return { code: 'RESUMED' };
  }

  async autoplay(input) {
    this.#queue(input);
    const enabled = await this.player.toggleAutoplay(input.guildId);

    return { code: enabled ? 'AUTOPLAY_ON' : 'AUTOPLAY_OFF' };
  }

  async skip(input) {
    this.#queue(input);
    await this.player.skip(input.guildId);

    return { code: 'SKIPPED' };
  }

  async previous(input) {
    this.#queue(input);
    const song = await this.player.previous(input.guildId);

    return { code: 'PREVIOUS', name: song.name };
  }

  async stop(input) {
    this.#queue(input);
    await this.player.stop(input.guildId);
    await this.player.leave(input.guildId);

    return { code: 'STOPPED' };
  }

  async leave(input) {
    this.coordinator.authorize(input);
    this.coordinator.requireReady(input.guildId);

    if (this.player.state(input.guildId)?.hasQueue) await this.player.stop(input.guildId);

    this.stopIntro(input.guildId);
    await this.player.leave(input.guildId);

    return { code: 'LEFT' };
  }
}
