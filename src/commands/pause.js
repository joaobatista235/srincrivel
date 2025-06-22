import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa ou retoma a música em reprodução.'),

  async execute(interaction, distube) {
    const voiceChannel = interaction.member?.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Você precisa estar em um canal de voz para usar este comando.', ephemeral: true });
    }

    const queue = distube.getQueue(interaction.guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ Não há nenhuma música sendo reproduzida no momento.', ephemeral: true });
    }

    try {
      if (queue.paused) {
        await queue.resume();
        return interaction.reply('▶️ A música foi retomada!');
      }

      await queue.pause();
      return interaction.reply('⏸️ A música foi pausada!');
    } catch (err) {
      console.error('Erro ao pausar ou retomar a música:', err);
      return interaction.reply({ content: `❌ Ocorreu um erro: ${err.message}`, ephemeral: true });
    }
  },
};
