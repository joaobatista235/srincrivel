import config from './src/utils/config.json' assert { type: 'json' };
import CommandHandler from './src/controllers/CommandHandler.js';
import DiscordBot from './src/entities/DiscordBot.js';

new DiscordBot(config, new CommandHandler()).initialize();