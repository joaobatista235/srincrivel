import { ApplicationError } from '../errors/ApplicationError.js';

/** Reserva a voz durante buscas e intros. Filas em reprodução são consultadas no player. */
export default class VoiceSessionCoordinator {
  // Uma reserva por servidor, sem bloquear servidores diferentes.
  #reservations = new Map();

  constructor(getMusicState) {
    this.getMusicState = getMusicState;
  }

  state(guildId) {
    return this.#reservations.get(guildId) ?? this.getMusicState(guildId);
  }

  authorize({ guildId, voiceChannelId }) {
    if (!voiceChannelId) throw new ApplicationError('VOICE_REQUIRED');

    const current = this.state(guildId);

    if (current?.channelId && current.channelId !== voiceChannelId) {
      throw new ApplicationError('SAME_VOICE_REQUIRED');
    }
  }

  reserveMusic(input) {
    this.authorize(input);
    const current = this.#reservations.get(input.guildId);

    if (current?.kind === 'intro') throw new ApplicationError('INTRO_ACTIVE');

    if (current) throw new ApplicationError('MUSIC_LOADING');

    return this.#reserve(input.guildId, 'music', input.voiceChannelId);
  }

  reserveIntro(guildId, channelId) {
    if (this.#reservations.has(guildId) || this.getMusicState(guildId)) return null;

    return this.#reserve(guildId, 'intro', channelId);
  }

  #reserve(guildId, kind, channelId) {
    const reservation = Object.freeze({ kind, channelId });

    this.#reservations.set(guildId, reservation);

    return reservation;
  }

  release(guildId, reservation) {
    // Uma conclusão antiga não pode liberar a reserva de uma sessão mais recente.
    if (this.#reservations.get(guildId) === reservation) this.#reservations.delete(guildId);
  }

  requireReady(guildId) {
    if (this.#reservations.get(guildId)?.kind === 'music')
      throw new ApplicationError('MUSIC_LOADING');
  }
}
