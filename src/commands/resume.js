import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Retoma a música pausada.')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Ação para retomar ou não a música.')
        .setRequired(false)),

  async execute(interaction, distube) {
    const queue = distube.getQueue(interaction);

    if (!queue) {
      return interaction.reply({ content: "❌ A fila está vazia.", ephemeral: true });
    }

    try {
      if (queue.paused) {
        queue.resume();
        console.log("Resumindo a música");
        await interaction.reply({ content: '🎶 Música retomada.' });
      } else {
        console.log("Fila não pausada");
        await interaction.reply({ content: '❌ A fila não está pausada.' });
      }
    } catch (err) {
      console.error("Erro ao tentar retomar a música:", err);
      await interaction.reply({ content: `❌ Ocorreu um erro: ${err.message}`, ephemeral: true });
    }
  },
};
