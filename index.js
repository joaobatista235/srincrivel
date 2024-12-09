import Discord from 'discord.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import client from './src/frameworks_and_drivers/discordClient.js';
import config from './src/config/config.json' assert { type: 'json' };
import CommandHandler from './src/interface_adapters/CommandHandler.js';
import voiceStateController from './src/controllers/voiceStateController.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usuarios = JSON.parse(fs.readFileSync('./src/config/usuarios.json'));

client.login(process.env.TOKEN);
client.commands = new Discord.Collection();
client.aliases = new Discord.Collection();

const loadCommands = async () => {
    const commandFiles = fs.readdirSync('./src/commands/').filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const { default: command } = await import(`./src/commands/${file}`);
        if (command.name) {
            client.commands.set(command.name, command);
        }
        if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach(alias => client.aliases.set(alias, command.name));
        }
    }
};

loadCommands();

client.on('messageCreate', async (message) => {
    if (message.channel.type === Discord.ChannelType.DM || message.author.bot || message.content.length <= config.prefix.length) return;
    if (!message.content.toLowerCase().startsWith(config.prefix.toLowerCase())) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const commandHandler = new CommandHandler(client);
    await commandHandler.handleCommand(message, args);
});

const audioController = new voiceStateController(client, usuarios, __dirname);
client.on('voiceStateUpdate', (oldState, newState) => {
    audioController.handleVoiceStateUpdate(oldState, newState);
});

client.on('ready', () => {
    console.log('Bot está pronto!');
});