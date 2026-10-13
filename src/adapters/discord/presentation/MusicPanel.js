import { EmbedBuilder } from 'discord.js';
import { ApplicationError } from '../../../application/errors/ApplicationError.js';
import { musicControls } from './musicControls.js';
import { errorMessage } from './errorMessages.js';
export default class MusicPanel {
  #panels = new Map();
  #generations = new Map();
  constructor(client) { this.client = client; }
  validate(guildId, messageId) {
    if (this.#panels.get(guildId)?.id !== messageId) throw new ApplicationError('STALE_PANEL');
  }
  #channel(id) { return this.client.channels.cache.get(id); }
  async show({ guildId, textChannelId, song, state }) {
    const generation = (this.#generations.get(guildId) ?? 0) + 1;
    this.#generations.set(guildId, generation);
    await this.clear(guildId, false);
    const channel = this.#channel(textChannelId);
    if (!channel) return;
    const embed = new EmbedBuilder().setColor('Purple').setTitle((song.name || 'Música').slice(0, 256))
      .addFields({ name: 'Duração', value: song.duration || 'Ao vivo' });
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);
    const message = await channel.send({ embeds: [embed], components: musicControls(state) });
    if (this.#generations.get(guildId) !== generation) { await this.#edit(message, { components: [] }); return; }
    this.#panels.set(guildId, message);
  }
  async added({ textChannelId, song }) {
    await this.#channel(textChannelId)?.send({ embeds: [new EmbedBuilder().setColor('Purple')
      .setTitle('Adicionada à fila').setDescription((song.name || 'Música').slice(0, 4096))] });
  }
  async error({ textChannelId, error }) { await this.#channel(textChannelId)?.send({ content: errorMessage(error) }); }
  async update(guildId, state) {
    const message = this.#panels.get(guildId);
    if (!message || !state) return;
    if (!await this.#edit(message, { components: musicControls(state) }) && this.#panels.get(guildId) === message) this.#panels.delete(guildId);
  }
  async clear(guildId, invalidate = true) {
    if (invalidate) this.#generations.set(guildId, (this.#generations.get(guildId) ?? 0) + 1);
    const message = this.#panels.get(guildId);
    this.#panels.delete(guildId);
    if (message) await this.#edit(message, { components: [] });
  }
  async #edit(message, payload) {
    try { await message.edit(payload); return true; }
    catch (error) { console.error('Não foi possível atualizar os controles:', error); return false; }
  }
}
