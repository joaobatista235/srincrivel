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
            .on('error', (e, queue, song) => {
                queue.textChannel.send(`An error encountered: ${e}`);
            })
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
    }

    async onAddSong(queue, song) {
        const embed = this.createEmbed({
            title: `Adicionada à fila`,
            description: song.name,
        });

        await queue.textChannel.send({ embeds: [embed] });
    }

    onError(queue, err) {
        console.error('Erro no DisTube:', err);
        queue.textChannel?.send(`❌ Erro no player: ${err.message}`);
    }
}

export default DisTubeHandler;
