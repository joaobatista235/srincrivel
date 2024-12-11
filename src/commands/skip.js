import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Pula a música atual.'),

  async execute(interaction, distube) {
    const queue = distube.getQueue(interaction);

    if (!queue) {
      return interaction.reply({ content: "❌ Não há músicas na fila para pular.", ephemeral: true });
    }

    try {
      await queue.skip();
      console.log("Música pulada");
      await interaction.reply({ content: "🎶 A música foi pulada." });
    } catch (err) {
      console.error("Erro ao tentar pular a música:", err);
      await interaction.reply({ content: `❌ Ocorreu um erro ao tentar pular a música: ${err.message}`, ephemeral: true });
    }
  },
};
