import config from './src/config/config.json' assert { type: 'json' };
import CommandHandler from './src/controllers/CommandHandler.js';
import DiscordBot from './src/entities/DiscordBot.js';

const commandHandler = new CommandHandler();

const bot = new DiscordBot(config, commandHandler);
bot.initialize();