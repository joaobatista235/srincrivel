import { EmbedBuilder } from "discord.js";
import buttons from "../components/buttons.js";

class DisTubeHandler {
    constructor(client, distube) {
        this.client = client;
        this.distube = distube;
        this.embedCache = new Map();
        this.cacheTimeout = 10 * 60 * 1000; // 10 minutos
        this.performanceStats = {
            totalSongsPlayed: 0,
            totalSongsAdded: 0,
            averageEmbedCreationTime: 0,
            errors: 0
        };
    }

    init() {
        this.distube
            .on('playSong', (queue, song) => this.onPlaySong(queue, song))
            .on('addSong', (queue, song) => this.onAddSong(queue, song))
            .on('error', (e, queue, song) => this.handleError(e, queue, song))
            .on('disconnect', (queue) => this.handleDisconnect(queue))
            .on('finish', (queue) => this.handleFinish(queue))
            .on('initQueue', (queue) => this.handleInitQueue(queue));
    }

    async handleError(e, queue) {
        this.performanceStats.errors++;
        console.error('❌ Erro no DisTube:', e);

        try {
            if (queue?.textChannel) {
                const errorMessage = this.getErrorMessage(e);
                await queue.textChannel.send(errorMessage);
            }
        } catch (sendError) {
            console.error('❌ Erro ao enviar mensagem de erro:', sendError);
        }
    }

    getErrorMessage(error) {
        const errorMessages = {
            'NoVoice': "❌ Já estou conectado em outro canal!",
            'InvalidURL': "❌ Link inválido ou não suportado!",
            'AgeRestricted': "❌ Conteúdo restrito por idade!",
            'PrivateVideo': "❌ Vídeo privado não pode ser reproduzido!",
            'SignIn': "❌ Conteúdo requer login!",
            'VideoUnavailable': "❌ Vídeo não disponível!",
            'LiveVideo': "❌ Vídeos ao vivo não são suportados!",
            'VOICE_CONNECT_FAILED': "❌ Erro ao conectar ao canal de voz. Tente novamente.",
            'UNKNOWN': `❌ Erro desconhecido: ${error.message}`
        };

        return errorMessages[error.code] || errorMessages['UNKNOWN'];
    }

    async handleDisconnect(queue) {
        console.log(`🔌 Bot desconectado do canal de voz em guild ${queue?.guild?.id}`);
    }

    async handleFinish(queue) {
        console.log(`✅ Fila finalizada em guild ${queue?.guild?.id}`);
    }

    async handleInitQueue(queue) {
        console.log(`🎵 Nova fila inicializada em guild ${queue?.guild?.id}`);
    }

    createEmbed({ color = "Random", author, title, thumbnail, fields, description }) {
        const embed = new EmbedBuilder().setColor(color);
        if (author) embed.setAuthor(author);
        if (title) embed.setTitle(title);
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (fields) embed.addFields(fields);
        if (description) embed.setDescription(description);
        return embed;
    }

    async onPlaySong(queue, song) {
        const startTime = Date.now();
        this.performanceStats.totalSongsPlayed++;

        try {
            // Usar cache para embeds similares
            const cacheKey = `play-${song.name}-${song.duration}`;
            let embed = this.embedCache.get(cacheKey);

            if (!embed || Date.now() - embed.timestamp > this.cacheTimeout) {
                embed = this.createEmbed({
                    author: { name: `🟣 ${this.client.user.username}` },
                    title: `Tocando ${song.name}`,
                    thumbnail: song.thumbnail,
                    fields: [
                        { name: 'Música', value: song.name, inline: true },
                        { name: 'Tempo', value: song.formattedDuration, inline: true },
                    ],
                    description: `🎶`,
                });

                // Cache do embed
                this.embedCache.set(cacheKey, {
                    embed,
                    timestamp: Date.now()
                });
            } else {
                embed = embed.embed;
            }

            await queue.textChannel.send({
                embeds: [embed],
                components: [
                    { type: 1, components: [buttons.previous, buttons.pause, buttons.stop, buttons.next] },
                    { type: 1, components: [buttons.autoplay] },
                ],
            });

            const creationTime = Date.now() - startTime;
            this.updateAverageEmbedTime(creationTime);

        } catch (error) {
            console.error('❌ Erro ao enviar embed de música:', error);
            this.performanceStats.errors++;
        }
    }

    async onAddSong(queue, song) {
        this.performanceStats.totalSongsAdded++;

        try {
            const embed = this.createEmbed({
                title: `Adicionada à fila`,
                description: song.name,
            });

            await queue.textChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Erro ao enviar embed de música adicionada:', error);
            this.performanceStats.errors++;
        }
    }

    updateAverageEmbedTime(newTime) {
        const currentAvg = this.performanceStats.averageEmbedCreationTime;
        const totalSongs = this.performanceStats.totalSongsPlayed;

        this.performanceStats.averageEmbedCreationTime =
            (currentAvg * (totalSongs - 1) + newTime) / totalSongs;
    }

    getPerformanceStats() {
        return {
            ...this.performanceStats,
            cacheSize: this.embedCache.size,
            cacheKeys: Array.from(this.embedCache.keys())
        };
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.embedCache) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.embedCache.delete(key);
            }
        }
    }

    onError(queue, err) {
        console.error('❌ Erro no DisTube:', err);
        this.performanceStats.errors++;

        try {
            queue.textChannel?.send(`❌ Erro no player: ${err.message}`);
        } catch (sendError) {
            console.error('❌ Erro ao enviar mensagem de erro:', sendError);
        }
    }
}

export default DisTubeHandler;
