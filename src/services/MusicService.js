import { UserError } from '../utils/errors.js';
import { musicControls } from '../components/buttons.js';

export default class MusicService {
  constructor(distube) {
    this.distube = distube;
    this.intros = null;
    this.pending = new Set();
    this.panels = new Map();
  }

  isActive(guildId) {
    return this.pending.has(guildId) || Boolean(this.distube.getQueue(guildId));
  }

  getVoiceChannel(interaction) {
    const channel = interaction.member?.voice?.channel;
    if (!channel) throw new UserError('Entre em um canal de voz para usar este comando.');
    const currentChannel = this.distube.voices.get(interaction.guildId)?.channel;
    const currentChannelId = currentChannel?.id ?? this.intros?.channelId(interaction.guildId);
    if (currentChannelId && currentChannelId !== channel.id) {
      throw new UserError('Entre no mesmo canal de voz do bot para controlar a música.');
    }
    if (interaction.isButton() && this.panels.get(interaction.guildId)?.id !== interaction.message.id) {
      throw new UserError('Este controle está desatualizado. Use os controles da música atual.');
    }
    return channel;
  }

  getQueue(interaction) {
    this.getVoiceChannel(interaction);
    const queue = this.distube.getQueue(interaction.guildId);
    if (!queue) throw new UserError('Não há músicas na fila.');
    return queue;
  }

  async play(interaction, query) {
    const channel = this.getVoiceChannel(interaction);
    if (this.intros?.isActive(interaction.guildId)) {
      throw new UserError('Aguarde o áudio de entrada terminar antes de tocar música.');
    }
    if (this.pending.has(interaction.guildId)) {
      throw new UserError('Uma música já está sendo carregada. Aguarde e tente novamente.');
    }
    this.pending.add(interaction.guildId);
    try {
      await this.distube.play(channel, query, {
        member: interaction.member,
        textChannel: interaction.channel,
      });
    } finally {
      this.pending.delete(interaction.guildId);
    }
    return { content: 'Música adicionada à fila.' };
  }

  async control(interaction, action) {
    const queue = this.getQueue(interaction);
    let content;
    switch (action) {
      case 'pause':
        if (queue.paused) { await queue.resume(); content = 'Música retomada.'; }
        else { await queue.pause(); content = 'Música pausada.'; }
        break;
      case 'resume':
        if (!queue.paused) throw new UserError('A música já está tocando.');
        await queue.resume();
        content = 'Música retomada.';
        break;
      case 'autoplay':
        content = queue.toggleAutoplay() ? 'Autoplay ativado.' : 'Autoplay desativado.';
        break;
      case 'skip':
        await queue.skip();
        content = 'Música pulada.';
        break;
      case 'previous': {
        const song = await queue.previous();
        content = `Tocando a música anterior: ${song.name}.`;
        break;
      }
      case 'stop':
        await queue.stop();
        this.distube.voices.leave(interaction.guildId);
        await this.clearPanel(interaction.guildId);
        return { content: 'Música parada e bot desconectado.' };
      default:
        throw new Error(`Ação de música desconhecida: ${action}.`);
    }
    if (action === 'pause' || action === 'resume' || action === 'autoplay') {
      await this.updatePanel(interaction.guildId, queue);
    }
    return { content };
  }

  async leave(interaction) {
    this.getVoiceChannel(interaction);
    const queue = this.distube.getQueue(interaction.guildId);
    if (queue) await queue.stop();
    this.intros?.stop(interaction.guildId);
    this.distube.voices.leave(interaction.guildId);
    await this.clearPanel(interaction.guildId);
    return { content: 'Bot desconectado do canal de voz.' };
  }

  async updatePanel(guildId, queue) {
    const message = this.panels.get(guildId);
    if (!message) return;
    try { await message.edit({ components: musicControls(queue) }); }
    catch (error) {
      this.panels.delete(guildId);
      console.error('Não foi possível atualizar os controles:', error);
    }
  }

  async clearPanel(guildId) {
    const message = this.panels.get(guildId);
    this.panels.delete(guildId);
    if (!message) return;
    try { await message.edit({ components: [] }); }
    catch (error) { console.error('Não foi possível remover os controles antigos:', error); }
  }
}
