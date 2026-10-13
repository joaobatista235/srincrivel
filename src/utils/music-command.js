import { SlashCommandBuilder } from 'discord.js';

export function musicCommand(name, description, action = name) {
  return {
    data: new SlashCommandBuilder().setName(name).setDescription(description),
    button: name !== 'resume',
    execute: (interaction, { music }) => music.control(interaction, action),
  };
}
