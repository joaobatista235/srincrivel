import { SlashCommandBuilder } from '@discordjs/builders';

export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Toca uma música.')
        .addStringOption(option =>
            option.setName('musica')
                .setDescription('Nome ou URL da música.')
                .setRequired(true)),
    async execute(interaction, distube) {
        const query = interaction.options.getString('musica');

        const voiceChannel = interaction.member?.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: "❌ Você precisa estar em um canal de voz para tocar música.", ephemeral: true });
        }

        try {
            await interaction.deferReply();

            await distube.play(voiceChannel, query, {
                textChannel: interaction.channel,
                member: interaction.member,
            });

            await interaction.editReply(`🎶 Tocando: \`${query}\``);
        } catch (err) {
            console.error("Erro ao tentar tocar a música:", err);
            await interaction.editReply(`❌ Ocorreu um erro ao tentar tocar a música: ${err.message}`);
        }
    },
};