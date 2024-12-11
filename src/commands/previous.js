import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('previous')
    .setDescription('Toca a música anterior.'),

  async execute(interaction, distube) {
    const queue = distube.getQueue(interaction);

    if (!queue) {
      return interaction.reply({ content: "❌ Não há músicas na fila.", ephemeral: true });
    }

    try {
      await interaction.deferReply();

      const song = queue.previous();
      console.log("Música anterior");

      await interaction.editReply(`🎶 Tocando a música anterior: \`${song.name}\``);
    } catch (err) {
      console.error("Erro ao tentar tocar a música anterior:", err);
      await interaction.editReply(`❌ Nenhuma música anterior.`);
    }
  },
};
