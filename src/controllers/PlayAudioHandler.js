import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import path from 'path';

class PlayAudioUseCase {
    constructor(client, usuarios, __dirname) {
        this.client = client;
        this.usuarios = usuarios;
        this.__dirname = __dirname;
        this.currentUser = null;
        this.isPlayingMusic = false;
        this.audioCache = new Map();
        this.performanceStats = {
            totalAudiosPlayed: 0,
            totalErrors: 0,
            averagePlayTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutos
    }

    async execute(oldState, newState) {
        if (!oldState.channelId && newState.channelId && newState.id !== '929526680341594112') {
            const userId = newState.id;
            const userAudio = this.usuarios[userId];

            if (!userAudio) {
                console.log(`👤 Usuário ${userId} não possui áudio configurado.`);
                return;
            }

            const guild = newState.guild;
            const queue = this.client.distube?.getQueue(guild.id);
            if (queue && queue.playing) {
                console.log(`🎵 DisTube está tocando música, pulando intro de áudio para ${userId}`);
                return;
            }

            await this.playAudio(newState, userAudio);
        }
    }

    async playAudio(newState, userAudio) {
        const audioPath = path.join(this.__dirname, '..', 'intros', userAudio.audio);
        const voiceChannel = newState.channel;

        if (this.currentUser && this.currentUser !== newState.id) {
            console.log(`⏳ Áudio já está sendo tocado para o usuário ${this.currentUser}, não será tocado para ${newState.id}`);
            return;
        }

        if (!this.currentUser) {
            try {
                const startTime = Date.now();

                // Verificar cache de áudio
                let audioResource = this.audioCache.get(userAudio.audio);
                if (!audioResource || Date.now() - audioResource.timestamp > this.cacheTimeout) {
                    // Carregar áudio do disco
                    audioResource = createAudioResource(audioPath);
                    this.audioCache.set(userAudio.audio, {
                        resource: audioResource,
                        timestamp: Date.now()
                    });
                    this.performanceStats.cacheMisses++;
                } else {
                    this.performanceStats.cacheHits++;
                }

                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                });

                const player = createAudioPlayer();

                connection.subscribe(player);
                player.play(audioResource.resource);

                player.on(AudioPlayerStatus.Playing, () => {
                    console.log(`🎵 Tocando áudio para o usuário ${newState.id}!`);
                    this.isPlayingMusic = true;
                    this.performanceStats.totalAudiosPlayed++;
                });

                player.on(AudioPlayerStatus.Idle, () => {
                    const playTime = Date.now() - startTime;
                    this.updateAveragePlayTime(playTime);

                    console.log(`✅ Áudio para o usuário ${newState.id} finalizado em ${playTime}ms. Desconectando...`);
                    this.isPlayingMusic = false;
                    this.currentUser = null;
                    setTimeout(() => {
                        if (!this.isPlayingMusic) {
                            connection.destroy();
                        }
                    }, 1000);
                });

                player.on('error', (error) => {
                    console.error(`❌ Erro no player de áudio para ${newState.id}:`, error);
                    this.performanceStats.totalErrors++;
                    this.isPlayingMusic = false;
                    this.currentUser = null;
                });

                this.currentUser = newState.id;

            } catch (error) {
                console.error(`❌ Erro ao tentar reproduzir o áudio para o usuário ${newState.id}:`, error);
                this.performanceStats.totalErrors++;
                this.isPlayingMusic = false;
                this.currentUser = null;
            }
        }
    }

    updateAveragePlayTime(newTime) {
        const currentAvg = this.performanceStats.averagePlayTime;
        const totalAudios = this.performanceStats.totalAudiosPlayed;

        this.performanceStats.averagePlayTime =
            (currentAvg * (totalAudios - 1) + newTime) / totalAudios;
    }

    getPerformanceStats() {
        const cacheHitRate = this.performanceStats.cacheHits + this.performanceStats.cacheMisses > 0
            ? (this.performanceStats.cacheHits / (this.performanceStats.cacheHits + this.performanceStats.cacheMisses)) * 100
            : 0;

        return {
            ...this.performanceStats,
            cacheHitRate: `${cacheHitRate.toFixed(1)}%`,
            cacheSize: this.audioCache.size,
            errorRate: this.performanceStats.totalAudiosPlayed > 0
                ? (this.performanceStats.totalErrors / this.performanceStats.totalAudiosPlayed) * 100
                : 0
        };
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.audioCache) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.audioCache.delete(key);
            }
        }
    }

    // Método para verificar se está tocando
    get isPlaying() {
        return this.isPlayingMusic;
    }

    // Método para forçar limpeza de cache
    forceCleanup() {
        this.audioCache.clear();
        this.isPlayingMusic = false;
        this.currentUser = null;
    }
}

export default PlayAudioUseCase;
