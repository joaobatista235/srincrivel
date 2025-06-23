import { SlashCommandBuilder } from '@discordjs/builders';
import buttons from '../components/buttons.js'

export default {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Ativa ou desativa o modo autoplay na fila de músicas.'),

  async execute(interaction, distube) {
    const voiceChannel = interaction.member?.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Você precisa estar em um canal de voz para usar esse comando.', ephemeral: true });
    }

    const queue = distube.getQueue(interaction.guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ Nenhuma fila de músicas encontrada.', ephemeral: true });
    }
    try {
      const autoplayEnabled = queue.toggleAutoplay();
      const message = interaction.message;

      const newComponents = message.components.map(row => {
        const newRow = row.toJSON();
        newRow.components = newRow.components.map(component => {
          if (component.custom_id === 'autoplay') {
            return {
              ...component,
              label: autoplayEnabled ? '✅ Autoplay' : '❌ Autoplay'
            };
          }
          return component;
        });
        return newRow;
      });

      await message.edit({ components: newComponents });
      await interaction.deferUpdate();
    } catch (err) {
      console.error('Erro ao alternar o autoplay:', err);
      await interaction.reply({ content: `❌ Ocorreu um erro ao alternar o autoplay: ${err.message}`, ephemeral: true });
    }
  },
};
