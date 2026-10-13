import { playerError } from './playerErrors.js';
/** Converts native events into plain notifications; presentation is injected. */
export default class DisTubeEvents {
  #listeners = [];

  constructor(distube, callbacks) {
    this.distube = distube;
    this.callbacks = callbacks;
  }

  init() {
    const snapshot = (queue, song) => ({
      guildId: queue.id,
      textChannelId: queue.textChannel?.id,
      state: { paused: queue.paused, autoplay: queue.autoplay },
      song: song && {
        name: song.name,
        duration: song.formattedDuration,
        thumbnail: song.thumbnail,
      },
    });

    this.#on('playSong', (queue, song) => this.callbacks.playing(snapshot(queue, song)));
    this.#on('addSong', (queue, song) => this.callbacks.added(snapshot(queue, song)));
    this.#on('error', (error, queue) => {
      console.error('Erro do DisTube:', error);

      return this.callbacks.error({
        textChannelId: queue?.textChannel?.id,
        error: playerError(error),
      });
    });
    this.#on('finish', queue => this.callbacks.finished({ guildId: queue.id }));
    this.#on('disconnect', queue => this.callbacks.cleared({ guildId: queue.id }));
    this.#on('deleteQueue', queue => this.callbacks.cleared({ guildId: queue.id }));
  }

  #on(event, callback) {
    const listener = (...args) =>
      Promise.resolve()
        .then(() => callback(...args))
        .catch(error => console.error('Erro no evento de música:', error));

    this.distube.on(event, listener);
    this.#listeners.push([event, listener]);
  }

  destroy() {
    for (const [event, listener] of this.#listeners) this.distube.off(event, listener);

    this.#listeners = [];
  }
}
