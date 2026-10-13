import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { rollDice } from '../../../application/dice/rollDice.js';

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Rola dados, por exemplo 2d6.')
    .addStringOption(option =>
      option.setName('dados').setDescription('Formato xdy.').setRequired(true).setMaxLength(12),
    ),
  public: true,
  execute(interaction) {
    const { count, sides, results, total } = rollDice(interaction.options.getString('dados', true));

    return {
      embeds: [
        new EmbedBuilder()
          .setColor('Purple')
          .setAuthor({
            name: interaction.user.username,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTitle(`Rolando ${count}d${sides}`)
          .addFields(
            { name: 'Resultados', value: results.join(' / ') },
            { name: 'Total', value: String(total) },
          ),
      ],
    };
  },
};
