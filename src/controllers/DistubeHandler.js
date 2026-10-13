import { EmbedBuilder } from 'discord.js';
import { musicControls } from '../components/buttons.js';
import { musicErrorMessage } from '../utils/errors.js';

export default class DistubeHandler {
  constructor(client, distube, music) {
    this.client = client;
    this.distube = distube;
    this.music = music;
  }

  init() {
    const safely = fn => (...args) => {
      Promise.resolve().then(() => fn(...args)).catch(error => console.error('Erro no evento de música:', error));
    };
    this.distube.on('playSong', safely((queue, song) => this.onPlaySong(queue, song)));
    this.distube.on('addSong', safely((queue, song) => this.onAddSong(queue, song)));
    this.distube.on('error', safely((error, queue) => this.onError(error, queue)));
    this.distube.on('finish', safely(queue => this.onFinish(queue)));
    this.distube.on('disconnect', safely(queue => this.music.clearPanel(queue.id)));
    this.distube.on('deleteQueue', safely(queue => this.music.clearPanel(queue.id)));
  }

  async onPlaySong(queue, song) {
    await this.music.clearPanel(queue.id);
    if (!queue.textChannel) return;
    const embed = new EmbedBuilder()
      .setColor('Purple')
      .setTitle((song.name || 'Música').slice(0, 256))
      .addFields({ name: 'Duração', value: song.formattedDuration || 'Ao vivo' });
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);
    const message = await queue.textChannel.send({ embeds: [embed], components: musicControls(queue) });
    this.music.panels.set(queue.id, message);
  }

  async onAddSong(queue, song) {
    if (!queue.textChannel) return;
    await queue.textChannel.send({
      embeds: [new EmbedBuilder().setColor('Purple').setTitle('Adicionada à fila')
        .setDescription((song.name || 'Música').slice(0, 4096))],
    });
  }

  async onError(error, queue) {
    console.error('Erro do DisTube:', error);
    if (queue?.textChannel) await queue.textChannel.send({ content: musicErrorMessage(error) });
  }

  async onFinish(queue) {
    await this.music.clearPanel(queue.id);
    if (!this.distube.getQueue(queue.id)) this.distube.voices.leave(queue.id);
  }
}
