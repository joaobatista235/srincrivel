import Discord from "discord.js";
import buttons from "./buttons/buttons.js";

const buttonComponents = [
    { type: 1, components: [buttons.previous, buttons.pause, buttons.stop, buttons.next] },
    { type: 1, components: [buttons.autoplay] },
];

let isAutoplay = false;
let isPaused = false;

const labels = {
    autoplayOn: '✅ Autoplay',
    autoplayOff: '❌ Autoplay',
    resume: '▶️ Resume',
    pause: '⏸️ Pausar',
};

const createEmbed = ({ color = "Random", author, title, thumbnail, fields, description }) => {
    const embed = new Discord.EmbedBuilder().setColor(color);
    if (author) embed.setAuthor(author);
    if (title) embed.setTitle(title);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (fields) embed.addFields(fields);
    if (description) embed.setDescription(description);
    return embed;
};

export default {
    buttonComponents,

    onPlaySong: async (username, icon, name, thumb, duration, channel) => {
        const embed = createEmbed({
            author: { name: `🟣 ${username}`, iconURL: icon },
            title: `Tocando ${name}`,
            thumbnail: thumb,
            fields: [
                { name: 'Música', value: name, inline: true },
                { name: 'Tempo', value: duration, inline: true },
            ],
            description: `🎶`,
        });

        await channel.send({
            embeds: [embed],
            components: buttonComponents,
        });
    },

    onAddSong: async (name, channel) => {
        const embed = createEmbed({
            title: `Adicionada à fila`,
            description: name,
        });

        await channel.send({ embeds: [embed] });
    },

    error: async (message, channel) => {
        const embed = createEmbed({
            title: `Erro`,
            description: message.slice(0, 2000),
        });

        await channel.send({ embeds: [embed] });
    },

    actions: async (interaction) => {
        if (interaction === 'autoplay') {
            isAutoplay = !isAutoplay;
            buttons.autoplay.setLabel(isAutoplay ? labels.autoplayOn : labels.autoplayOff);
        }

        if (interaction === 'pause') {
            isPaused = !isPaused;
            buttons.pause.setLabel(isPaused ? labels.resume : labels.pause);
        }
    },
};
