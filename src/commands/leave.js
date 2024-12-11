import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('sair')
    .setDescription('Remove o bot do canal de voz.'),
  async execute(interaction, distube) {
    const voiceChannel = interaction.member?.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Você precisa estar em um canal de voz para usar este comando.', ephemeral: true });
    }

    try {
      distube.voices.leave(interaction.guildId);
      await interaction.reply({ content: '✅ Saí do canal de voz com sucesso!' });
    } catch (err) {
      console.error('Erro ao sair do canal de voz:', err);
      await interaction.reply({ content: `❌ Ocorreu um erro ao tentar sair do canal de voz: ${err.message}`, ephemeral: true });
    }
  },
};
