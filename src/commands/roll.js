import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { randomInt } from 'node:crypto';
import { UserError } from '../utils/errors.js';

export function rollDice(input) {
  const match = /^(\d{1,3})d(\d{1,7})$/.exec(input);
  if (!match) throw new UserError('Use o formato xdy, como 2d6.');
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (count < 1 || count > 100 || sides < 1 || sides > 1_000_000) {
    throw new UserError('Use de 1 a 100 dados, com até 1.000.000 de faces.');
  }
  const results = Array.from({ length: count }, () => randomInt(1, sides + 1));
  return { count, sides, results, total: results.reduce((sum, value) => sum + value, 0) };
}

export default {
  data: new SlashCommandBuilder().setName('roll').setDescription('Rola dados, por exemplo 2d6.')
    .addStringOption(option => option.setName('dados').setDescription('Formato xdy.')
      .setRequired(true).setMaxLength(12)),
  public: true,
  execute(interaction) {
    const { count, sides, results, total } = rollDice(interaction.options.getString('dados', true));
    return {
      embeds: [new EmbedBuilder().setColor('Purple')
        .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
        .setTitle(`Rolando ${count}d${sides}`)
        .addFields({ name: 'Resultados', value: results.join(' / ') }, { name: 'Total', value: String(total) })],
    };
  },
}
