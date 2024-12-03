import Discord from "discord.js";
import buttons from "./buttons/buttons.js";

const btnComponent = [
    { type: 1, components: [buttons.previous, buttons.pause, buttons.stop, buttons.next] },
    { type: 1, components: [buttons.autoplay] }
]

const btnOn = '✅ Autoplay';
const btnOff = '❌ Autoplay';
let bool = false;

const voltar = '▶️ Resume';
const pausar = '⏸️ Pausar';
let boolPause = false;

export default {
    btnComponent: btnComponent,
    onPlaySong: async(username, icon, name, thumb, duracao, canal) => {
    let embed = new Discord.EmbedBuilder()
                .setColor("Random")
                .setAuthor({ name: `🟣 ${username}`, iconURL: icon })
                .setTitle(`Tocando ${name}.`)
                .setThumbnail(thumb)
                .addFields(
                    { name: 'Musica', value: `${name}`, inline: true },
                    { name: 'Tempo', value: `${duracao}`, inline: true }
                )
                .setDescription(`🎶`);

            canal.send({
                embeds: [embed],
                components: btnComponent
            })
    },

    onAddSong: async(name, canal) => {
        let embed = new Discord.EmbedBuilder()
                .setColor("Random")
                .setTitle(`Adicionada a fila`)
                .setDescription(`${name}`)
            canal.send({ embeds: [embed] })
    },

    error: async(message, canal) => {
        let embed = new Discord.EmbedBuilder()
                .setColor("Random")
                .setTitle(`Erro`)
                .setDescription(`${message.slice(0, 2000)}`)
            canal.send({ embeds: [embed] })
    },

    acoes: async(interaction) => {
        if (interaction === 'autoplay') {
            bool = bool ? false : true;
            if (bool) buttons.autoplay.setLabel(btnOn);
            else buttons.autoplay.setLabel(btnOff);
        }

        if (interaction === 'pause') {
            boolPause = boolPause ? false : true;
            if (boolPause) buttons.pause.setLabel(voltar);
            else buttons.pause.setLabel(pausar);
        }
    }
}