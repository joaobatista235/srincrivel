import { EmbedBuilder } from 'discord.js';
import { ApplicationError } from '../../../application/errors/ApplicationError.js';
import { musicControls } from './musicControls.js';
import { errorMessage } from './errorMessages.js';

export default class MusicPanel {
  #panels = new Map();

  #generations = new Map();

  #transitions = new Map();

  #destroyed = false;

  constructor(client, { transitionTimeoutMs = 12_000 } = {}) {
    this.transitionTimeoutMs = transitionTimeoutMs;
    this.client = client;
  }

  validate(guildId, messageId) {
    if (this.#transitions.has(guildId)) throw new ApplicationError('MUSIC_TRANSITION');
    if (this.#panels.get(guildId)?.id !== messageId) throw new ApplicationError('STALE_PANEL');
  }

  #channel(id) {
    return this.client.channels.cache.get(id);
  }

  async show({ guildId, textChannelId, song, state }) {
    if (this.#destroyed) return;
    const generation = (this.#generations.get(guildId) ?? 0) + 1;

    this.#generations.set(guildId, generation);
    await this.clear(guildId, false);
    const channel = this.#channel(textChannelId);

    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('Purple')
      .setTitle((song.name || 'Música').slice(0, 256))
      .addFields({ name: 'Duração', value: song.duration || 'Ao vivo' });

    if (song.thumbnail) embed.setThumbnail(song.thumbnail);

    const wasBusy = this.#transitions.has(guildId);
    const message = await channel.send({
      embeds: [embed],
      components: musicControls({ ...state, busy: this.#transitions.has(guildId) }),
    });

    if (this.#generations.get(guildId) !== generation) {
      await this.#edit(message, { components: [] });

      return;
    }

    this.#panels.set(guildId, message);
    this.#transitions.get(guildId)?.ready();
    // A send that finishes after the transition timeout must not leave disabled buttons.
    if (wasBusy && !this.#transitions.has(guildId)) await this.update(guildId, state);
  }

  async added({ textChannelId, song }) {
    await this.#channel(textChannelId)?.send({
      embeds: [
        new EmbedBuilder()
          .setColor('Purple')
          .setTitle('Adicionada à fila')
          .setDescription((song.name || 'Música').slice(0, 4096)),
      ],
    });
  }

  async error({ textChannelId, error }) {
    await this.#channel(textChannelId)?.send({ content: errorMessage(error) });
  }

  async update(guildId, state) {
    const message = this.#panels.get(guildId);

    if (!message || !state) return;

    if (
      !(await this.#edit(message, {
        components: musicControls({ ...state, busy: this.#transitions.has(guildId) }),
      })) &&
      this.#panels.get(guildId) === message
    )
      this.#panels.delete(guildId);
  }

  async clear(guildId, invalidate = true) {
    if (invalidate) this.#transitions.get(guildId)?.ready();

    if (invalidate) this.#generations.set(guildId, (this.#generations.get(guildId) ?? 0) + 1);

    const message = this.#panels.get(guildId);

    this.#panels.delete(guildId);

    if (message) await this.#edit(message, { components: [] });
  }

  async transition(guildId, operation, getState) {
    if (this.#destroyed) throw new ApplicationError('PLAYER_CLOSED');
    if (this.#transitions.has(guildId)) throw new ApplicationError('MUSIC_TRANSITION');
    let ready;
    const rendered = new Promise(resolve => {
      ready = resolve;
    });
    const token = { ready };
    const previous = this.#panels.get(guildId);
    this.#transitions.set(guildId, token);
    let timeout;

    try {
      await this.update(guildId, getState());
      const result = await operation();
      // The old card becomes invalid even if the next playSong event has not arrived.
      if (this.#panels.get(guildId) === previous) this.#panels.delete(guildId);
      await Promise.race([
        rendered,
        new Promise(resolve => {
          timeout = setTimeout(resolve, this.transitionTimeoutMs);
        }),
      ]);
      return result;
    } finally {
      clearTimeout(timeout);
      if (this.#transitions.get(guildId) === token) this.#transitions.delete(guildId);
      await this.update(guildId, getState());
    }
  }

  destroy() {
    this.#destroyed = true;
    for (const token of this.#transitions.values()) token.ready();
    for (const guildId of this.#generations.keys()) {
      this.#generations.set(guildId, (this.#generations.get(guildId) ?? 0) + 1);
    }
    this.#transitions.clear();
    this.#panels.clear();
  }

  async #edit(message, payload) {
    try {
      await message.edit(payload);

      return true;
    } catch (error) {
      console.error('Não foi possível atualizar os controles:', error);

      return false;
    }
  }
}
