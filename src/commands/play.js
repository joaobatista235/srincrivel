import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('play').setDescription('Toca uma música.')
    .addStringOption(option => option.setName('musica').setDescription('Nome ou URL da música.')
      .setRequired(true).setMaxLength(1000)),
  execute: (interaction, { music }) => music.play(interaction, interaction.options.getString('musica', true)),
};
