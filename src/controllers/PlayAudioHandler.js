import {
  AudioPlayerStatus, VoiceConnectionStatus, createAudioPlayer, createAudioResource,
  entersState, joinVoiceChannel, getVoiceConnection,
} from '@discordjs/voice';
import { resolve, sep } from 'node:path';

const defaultAudio = {
  AudioPlayerStatus, VoiceConnectionStatus, createAudioPlayer, createAudioResource,
  entersState, joinVoiceChannel, getVoiceConnection,
};

export default class PlayAudioHandler {
  constructor({ client, users, isMusicActive, audio = defaultAudio,
    introsDir = resolve(import.meta.dirname, '..', 'intros') }) {
    this.client = client;
    this.users = users;
    this.isMusicActive = isMusicActive;
    this.audio = audio;
    this.introsDir = introsDir;
    this.sessions = new Map();
  }

  isActive(guildId) { return this.sessions.has(guildId); }
  channelId(guildId) { return this.sessions.get(guildId)?.channelId; }

  async execute(oldState, newState) {
    if (!newState.channelId || oldState.channelId === newState.channelId
      || newState.id === this.client.user?.id || newState.member?.user?.bot) return;
    const user = this.users[newState.id];
    const guildId = newState.guild.id;
    if (!user?.audio || this.isActive(guildId) || this.isMusicActive(guildId)) return;
    const audioPath = resolve(this.introsDir, user.audio);
    if (!audioPath.startsWith(this.introsDir + sep)) {
      throw new Error('O arquivo de intro deve estar dentro de src/intros.');
    }
    // A conexão de música e a conexão da intro nunca disputam a mesma guild.
    if (this.audio.getVoiceConnection(guildId)) return;
    const session = { player: null, connection: null, channelId: newState.channelId };
    this.sessions.set(guildId, session);
    try {
      session.player = this.audio.createAudioPlayer();
      session.connection = this.audio.joinVoiceChannel({
        channelId: newState.channelId,
        guildId,
        adapterCreator: newState.guild.voiceAdapterCreator,
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
  }

  destroy() {
    for (const guildId of this.sessions.keys()) this.stop(guildId);
  }
}
