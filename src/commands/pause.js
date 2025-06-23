import { SlashCommandBuilder } from '@discordjs/builders';

export default {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pausa ou retoma a música em reprodução.'),

  async execute(interaction, distube) {
    const voiceChannel = interaction.member?.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ Você precisa estar em um canal de voz para usar este comando.',
        ephemeral: true
      });
    }

    const queue = distube.getQueue(interaction.guildId);
    if (!queue) {
      return interaction.reply({
        content: '❌ Não há nenhuma música sendo reproduzida no momento.',
        ephemeral: true
      });
    }

    try {
      const message = interaction.message;

      if (queue.paused) {
        await queue.resume();

        if (message) {
          const newComponents = message.components.map(row => {
            const newRow = row.toJSON();
            newRow.components = newRow.components.map(component => {
              if (component.custom_id === 'pause') {
                return { ...component, label: '⏸️ Pausar' };
              }
              return component;
            });
            return newRow;
          });

          await message.edit({ components: newComponents });
        }

        await interaction.deferUpdate();
      } else {
        await queue.pause();

        if (message) {
          const newComponents = message.components.map(row => {
            const newRow = row.toJSON();
            newRow.components = newRow.components.map(component => {
              if (component.custom_id === 'pause') {
                return { ...component, label: '▶️ Retomar' };
              }
              return component;
            });
            return newRow;
          });

          await message.edit({ components: newComponents });
        }

        await interaction.deferUpdate();
      }

    } catch (err) {
      console.error('Erro ao pausar ou retomar a música:', err);
      return interaction.reply({
        content: `❌ Ocorreu um erro: ${err.message}`,
        ephemeral: true
      });
    }
  },
};
