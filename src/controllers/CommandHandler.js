import { Collection, MessageFlags, REST, Routes } from 'discord.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { UserError, musicErrorMessage } from '../utils/errors.js';

export default class CommandHandler {
  constructor(client, services, commandsPath = join(import.meta.dirname, '..', 'commands')) {
    this.client = client;
    this.services = services;
    this.commandsPath = commandsPath;
    this.commands = new Collection();
  }

  async loadCommands() {
    this.commands.clear();
    const files = (await readdir(this.commandsPath)).filter(file => file.endsWith('.js')).sort();
    for (const file of files) {
      const { default: command } = await import(pathToFileURL(join(this.commandsPath, file)).href);
      if (!command?.data?.name || typeof command.execute !== 'function') {
        throw new Error(`Comando inválido: ${file}.`);
      }
      if (this.commands.has(command.data.name)) {
        throw new Error(`Comando duplicado: ${command.data.name}.`);
      }
      this.commands.set(command.data.name, command);
    }
    console.log(`${this.commands.size} comandos carregados.`);
  }

  async registerCommands(guildId) {
    const rest = new REST({ version: '10' }).setToken(this.client.token);
    await rest.put(Routes.applicationGuildCommands(this.client.user.id, guildId), {
      body: this.commands.map(command => command.data.toJSON()),
    });
  }

  async handleInteraction(interaction) {
    const isButton = interaction.isButton();
    if (!isButton && !interaction.isChatInputCommand()) return;
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Use este comando em um servidor.', flags: MessageFlags.Ephemeral });
      return;
    }
    const name = isButton ? interaction.customId : interaction.commandName;
    const command = this.commands.get(name);
    if (!command || (isButton && !command.button)) {
      await interaction.reply({ content: 'Este comando ou controle não está mais disponível.', flags: MessageFlags.Ephemeral });
      return;
    }
    try {
      if (isButton) await interaction.deferUpdate();
      else await interaction.deferReply(command.public ? {} : { flags: MessageFlags.Ephemeral });
      const response = await command.execute(interaction, this.services);
      if (!isButton) await interaction.editReply(response);
    } catch (error) {
      if (!(error instanceof UserError)) console.error(`Erro em /${name}:`, error);
      const content = error instanceof UserError ? error.message : musicErrorMessage(error);
      if (isButton && interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content, embeds: [], components: [] });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    }
  }
}
