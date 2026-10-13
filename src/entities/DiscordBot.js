import { Client, Events, GatewayIntentBits } from 'discord.js';
import { DisTube } from 'distube';
import YtDlpExtractor from '../services/YtDlpExtractor.js';
import ffmpegPath from 'ffmpeg-static';
import { readIntroUsers } from '../config.js';
import CommandHandler from '../controllers/CommandHandler.js';
import DistubeHandler from '../controllers/DistubeHandler.js';
import PlayAudioHandler from '../controllers/PlayAudioHandler.js';
import MusicService from '../services/MusicService.js';

export default class DiscordBot {
  constructor(config) {
    this.config = config;
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });
    this.distube = new DisTube(this.client, {
      plugins: [new YtDlpExtractor()],
      ffmpeg: { path: ffmpegPath },
      emitNewSongOnly: true,
      savePreviousSongs: true,
      emitAddSongWhenCreatingQueue: false,
      emitAddListWhenCreatingQueue: false,
      joinNewVoiceChannel: false,
    });
    this.music = new MusicService(this.distube);
    this.intros = new PlayAudioHandler({
      client: this.client,
      users: readIntroUsers(),
      isMusicActive: guildId => this.music.isActive(guildId),
    });
    this.music.intros = this.intros;
    this.commandHandler = new CommandHandler(this.client, {
      music: this.music,
      config,
    });
    this.distubeHandler = new DistubeHandler(this.client, this.distube, this.music);
  }

  async initialize() {
    await this.commandHandler.loadCommands();
    this.distubeHandler.init();
    this.client.on(Events.InteractionCreate, interaction => {
      this.commandHandler.handleInteraction(interaction).catch(error => {
        console.error('Erro ao responder à interação:', error);
      });
    });
    this.client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      this.intros.execute(oldState, newState).catch(error => {
        console.error('Erro no áudio de entrada:', error);
      });
    });
    this.client.on(Events.Error, error => console.error('Erro do Discord:', error));
    this.client.once(Events.ClientReady, async client => {
      try {
        await this.commandHandler.registerCommands(this.config.guildId);
        console.log(`Bot conectado como ${client.user.tag}.`);
      } catch (error) {
        console.error('Erro ao registrar os comandos:', error);
        this.destroy();
        process.exitCode = 1;
      }
    });
    try {
      await this.client.login(this.config.token);
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  destroy() {
    this.intros.destroy();
    for (const voice of this.distube.voices.collection.values()) voice.leave();
    this.client.destroy();
  }
}
