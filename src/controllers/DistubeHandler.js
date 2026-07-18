import { EmbedBuilder } from "discord.js";
import buttons from "../components/buttons.js";

class DisTubeHandler {
    constructor(client, distube) {
        this.client = client;
        this.distube = distube;
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
        try {
            const embed = this.createEmbed({
                author: { name: `🟣 ${this.client.user.username}` },
                title: `Tocando ${song.name}`,
                thumbnail: song.thumbnail,
                fields: [
                    { name: 'Música', value: song.name, inline: true },
                    { name: 'Tempo', value: song.formattedDuration, inline: true },
                ],
                description: `🎶`,
            });

            await queue.textChannel.send({
                embeds: [embed],
                components: [
                    { type: 1, components: [buttons.previous, buttons.pause, buttons.stop, buttons.next] },
                    { type: 1, components: [buttons.autoplay] },
                ],
            });
        } catch (error) {
            console.error('❌ Erro ao enviar embed de música:', error);
        }
    }

    async onAddSong(queue, song) {
        try {
            const embed = this.createEmbed({
                title: `Adicionada à fila`,
                description: song.name,
            });

            await queue.textChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('❌ Erro ao enviar embed de música adicionada:', error);
        }
    }

    onError(queue, err) {
        console.error('❌ Erro no DisTube:', err);

        try {
            queue.textChannel?.send(`❌ Erro no player: ${err.message}`);
        } catch (sendError) {
            console.error('❌ Erro ao enviar mensagem de erro:', sendError);
        }
    }
}

export default DisTubeHandler;
