import {
  AudioPlayerStatus, VoiceConnectionStatus, createAudioPlayer, createAudioResource,
  entersState, joinVoiceChannel, getVoiceConnection,
} from '@discordjs/voice';
import { resolve, sep } from 'node:path';

const defaultAudio = {
  AudioPlayerStatus, VoiceConnectionStatus, createAudioPlayer, createAudioResource,
  entersState, joinVoiceChannel, getVoiceConnection,
};

export default class IntroAudioPlayer {
  #destroyed = false;
  constructor({ client, audio = defaultAudio,
    introsDir = resolve(import.meta.dirname, '..', '..', 'intros') }) {
    this.client = client;
    this.audio = audio;
    this.introsDir = introsDir;
    this.sessions = new Map();
  }

  isActive(guildId) { return this.sessions.has(guildId); }
  channelId(guildId) { return this.sessions.get(guildId)?.channelId; }

  async play({ guildId, channelId, audio }, onEnd) {
    if (this.#destroyed) { onEnd(); return; }
    const audioPath = resolve(this.introsDir, audio);
    if (!audioPath.startsWith(this.introsDir + sep)) throw new Error('Arquivo de intro fora do diretório permitido.');
    if (this.sessions.has(guildId) || this.audio.getVoiceConnection(guildId)) { onEnd(); return; }
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) throw new Error('Servidor da intro indisponível.');
    const session = { player: null, connection: null, channelId, onEnd };
    this.sessions.set(guildId, session);
    try {
      session.player = this.audio.createAudioPlayer();
      session.connection = this.audio.joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
      });
      session.player.once(this.audio.AudioPlayerStatus.Idle, () => this.stop(guildId, session));
      session.player.once('error', error => {
        console.error('Erro ao reproduzir intro:', error);
        this.stop(guildId, session);
      });
      session.connection.on('error', error => {
        console.error('Erro na conexão da intro:', error);
        this.stop(guildId, session);
      });
      session.connection.on(this.audio.VoiceConnectionStatus.Disconnected, () => this.stop(guildId, session));
      session.connection.subscribe(session.player);
      await this.audio.entersState(session.connection, this.audio.VoiceConnectionStatus.Ready, 20_000);
      if (this.sessions.get(guildId) !== session) return;
      session.player.play(this.audio.createAudioResource(audioPath));
    } catch (error) {
      this.stop(guildId, session);
      throw error;
    }
  }

  stop(guildId, expected = this.sessions.get(guildId)) {
    if (!expected || this.sessions.get(guildId) !== expected) return;
    this.sessions.delete(guildId);
    expected.player?.stop(true);
    if (expected.connection && expected.connection.state.status !== this.audio.VoiceConnectionStatus.Destroyed) {
      expected.connection.destroy();
    }
    expected.onEnd();
  }

  destroy() {
    this.#destroyed = true;
    for (const guildId of this.sessions.keys()) this.stop(guildId);
  }
}
