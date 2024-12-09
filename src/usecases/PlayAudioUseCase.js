import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import path from 'path';

class PlayAudioUseCase {
    constructor(client, usuarios, __dirname) {
        this.client = client;
        this.usuarios = usuarios;
        this.__dirname = __dirname;
        this.currentUser = null;
    }

    execute(oldState, newState) {
        if (!oldState.channelId && newState.channelId) {
            const userId = newState.id;
            const userAudio = this.usuarios[userId];

            if (!userAudio) {
                console.log(`Usuário ${userId} não possui áudio configurado.`);
                return;
            }

            const audioPath = path.join(this.__dirname, ('/src/intros/' + userAudio.audio));
            const voiceChannel = newState.channel;

            if (this.currentUser && this.currentUser !== userId) {
                console.log(`Áudio já está sendo tocado para o usuário ${this.currentUser}, não será tocado para ${userId}`);
                return;
            }

            if (!this.currentUser) {
                try {
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: voiceChannel.guild.id,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    });

                    const player = createAudioPlayer();
                    const resource = createAudioResource(audioPath);

                    connection.subscribe(player);

                    player.play(resource);

                    player.on(AudioPlayerStatus.Playing, () => {
                        console.log(`Tocando áudio para o usuário ${userId}!`);
                    });

                    player.on(AudioPlayerStatus.Idle, () => {
                        console.log(`Áudio para o usuário ${userId} finalizado. Desconectando...`);
                        connection.destroy();
                        this.currentUser = null;
                    });

                    this.currentUser = userId;
                } catch (error) {
                    console.error(`Erro ao tentar reproduzir o áudio para o usuário ${userId}:`, error);
                }
            }
        }
    }
}

export default PlayAudioUseCase;
