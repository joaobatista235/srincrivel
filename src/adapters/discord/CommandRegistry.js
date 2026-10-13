import { REST, Routes } from 'discord.js';
import play from './commands/music/play.js';
import pause from './commands/music/pause.js';
import resume from './commands/music/resume.js';
import autoplay from './commands/music/autoplay.js';
import previous from './commands/music/previous.js';
import skip from './commands/music/skip.js';
import stop from './commands/music/stop.js';
import leave from './commands/music/leave.js';
import roll from './commands/roll.js';

export default class CommandRegistry {
  constructor(definitions = [play, pause, resume, autoplay, previous, skip, stop, leave, roll]) {
    this.commands = new Map();

    for (const command of definitions) {
      if (!command?.data?.name || typeof command.execute !== 'function')
        throw new Error('Comando inválido.');

      if (this.commands.has(command.data.name))
        throw new Error('Comando duplicado: ' + command.data.name);

      this.commands.set(command.data.name, command);
    }
  }

  get(name) {
    return this.commands.get(name);
  }

  async register(client, guildId, rest = new REST({ version: '10' }).setToken(client.token)) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
      body: [...this.commands.values()].map(command => command.data.toJSON()),
    });
  }
}
