import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import path from 'path';

class PlayAudioUseCase {
    constructor(client, usuarios, __dirname) {
        this.client = client;
        this.usuarios = usuarios;
        this.__dirname = __dirname;
        this.usuarios = usuarios;
        this.currentUser = null;
        this.isPlayingMusic = false;
    }

    execute(oldState, newState) {
        if (!oldState.channelId && newState.channelId && newState.id !== '929526680341594112') {
            const userId = newState.id;
            const userAudio = this.usuarios[userId];

            if (!userAudio) {
                console.log(`Usuário ${userId} não possui áudio configurado.`);
                return;
            }

            const guild = newState.guild;
            const queue = this.client.distube?.getQueue(guild.id);
            if (queue && queue.playing) {
                console.log(`DisTube está tocando música, pulando intro de áudio para ${userId}`);
                return;
            }

            const audioPath = path.join(this.__dirname, '..', 'intros', userAudio.audio);
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
                        this.isPlayingMusic = true;
                    });

                    player.on(AudioPlayerStatus.Idle, () => {
                        console.log(`Áudio para o usuário ${userId} finalizado. Desconectando...`);
                        this.isPlayingMusic = false;
                        this.currentUser = null;
                        setTimeout(() => {
                            if (!this.isPlayingMusic) {
                                connection.destroy();
                            }
                        }, 1000);
                    });

                    this.currentUser = userId;
                } catch (error) {
                    console.error(`Erro ao tentar reproduzir o áudio para o usuário ${userId}:`, error);
                    this.isPlayingMusic = false;
                    this.currentUser = null;
                }
            }
        }
    }
}

export default PlayAudioUseCase;
