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
      const message = interaction.message;

      if (queue.paused) {
        await queue.resume();
        console.log("Resumindo a música");

        if (message) {
          await updateButtonLabel(message, 'pause', '⏸️ Pausar');
        }

        await interaction.deferUpdate();
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
