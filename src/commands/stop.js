import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Para a música ou desconecta do canal de voz.'),

  async execute(interaction, distube) {
    const queue = distube.getQueue(interaction);

    if (!queue) {
      return interaction.reply({ content: "❌ Não há música para parar.", ephemeral: true });
    }

    try {
      await queue.stop();
      console.log("Música ou fila parada");
      await interaction.reply({ content: "⏹ A música foi parada e o bot foi desconectado do canal." });
    } catch (err) {
      console.error("Erro ao tentar parar a música:", err);
      await interaction.reply({ content: `❌ Ocorreu um erro ao tentar parar a música: ${err.message}`, ephemeral: true });
    }
  },
};
