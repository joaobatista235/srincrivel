import { Events } from 'discord.js';
/** Discord lifecycle only. Concrete dependency construction belongs to bootstrap. */
export default class DiscordBot {
  #listeners = [];
  #destroyed = false;
  constructor({ client, config, registry, router, voiceListener, shutdown }) {
    Object.assign(this, { client, config, registry, router, voiceListener, shutdown });
  }
  async initialize() {
    const safely = operation => (...args) => Promise.resolve().then(() => { if (!this.#destroyed) return operation(...args); })
      .catch(error => console.error('Erro no evento do Discord:', error));
    this.#on(Events.InteractionCreate, safely(interaction => this.router.handleInteraction(interaction)));
    this.#on(Events.VoiceStateUpdate, safely((oldState, newState) => this.voiceListener.handle(oldState, newState)));
    this.#on(Events.Error, error => console.error('Erro do Discord:', error));
    this.client.once(Events.ClientReady, this.onReady = async client => {
      try {
        await this.registry.register(client, this.config.guildId);
        console.log('Bot conectado como ' + client.user.tag + '.');
      } catch (error) {
        console.error('Erro ao registrar os comandos:', error);
        this.destroy();
        process.exitCode = 1;
      }
    });
    try { await this.client.login(this.config.token); }
    catch (error) { this.destroy(); throw error; }
  }
  #on(event, listener) { this.client.on(event, listener); this.#listeners.push([event, listener]); }
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const [event, listener] of this.#listeners) this.client.off(event, listener);
    if (this.onReady) this.client.off(Events.ClientReady, this.onReady);
    this.shutdown();
    this.client.destroy();
  }
}
