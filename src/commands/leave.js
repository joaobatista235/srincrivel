import { SlashCommandBuilder } from 'discord.js';
export default {
  data: new SlashCommandBuilder().setName('sair').setDescription('Desconecta o bot do canal de voz.'),
  execute: (interaction, { music }) => music.leave(interaction),
};
