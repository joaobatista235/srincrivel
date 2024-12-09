import Discord from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import PlayAudioHandler from '../controllers/PlayAudioHandler.js';
import usuarios from '../config/usuarios.json' assert { type: 'json' };
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DiscordBot {
    constructor(config, commandHandler) {
        this.client = new Discord.Client({
            intents: [
                Discord.GatewayIntentBits.Guilds,
                Discord.GatewayIntentBits.GuildMessages,
                Discord.GatewayIntentBits.MessageContent,
                Discord.GatewayIntentBits.GuildVoiceStates,
                Discord.GatewayIntentBits.GuildMembers
            ],
        });

        this.client.commands = new Discord.Collection();
        this.client.aliases = new Discord.Collection();

        this.config = config;
        this.commandHandler = commandHandler;
        this.playAudioHandler = new PlayAudioHandler(this.client, usuarios, __dirname);
    }

    async initialize() {
        await this.loadCommands();
        this.setupEventListeners();
        await this.client.login(process.env.TOKEN);
    }

    async loadCommands() {
        const commandsPath = path.resolve(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            try {
                const filePath = path.resolve(commandsPath, file);
                const fileUrl = `file://${filePath}`;

                const { default: command } = await import(fileUrl);

                if (command.name) {
                    this.client.commands.set(command.name, command);
                }

                if (command.aliases && Array.isArray(command.aliases)) {
                    command.aliases.forEach(alias => this.client.aliases.set(alias, command.name));
                }
            } catch (error) {
                console.error(`Erro ao carregar o comando ${file}:`, error);
            }
        }

        console.log(`Comandos carregados: ${this.client.commands.size}`);
    }

    setupEventListeners() {
        this.client.on('ready', () => {
            console.log(`Bot conectado como ${this.client.user.tag}`);
        });

        this.client.on('messageCreate', this.handleMessage.bind(this));
        this.client.on('voiceStateUpdate', this.handleVoiceState.bind(this));
    }

    handleMessage(message) {
        if (message.author.bot) return;
        const prefix = this.config.prefix;
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = this.client.commands.get(commandName) ||
            this.client.commands.get(this.client.aliases.get(commandName));

        if (command) {
            try {
                command.execute(message, args);
            } catch (error) {
                console.error(`Erro ao executar o comando ${commandName}:`, error);
                message.reply('Houve um erro ao executar esse comando.');
            }
        }
    }

    handleVoiceState(oldState, newState) {
        this.playAudioHandler.execute(oldState, newState);
    }
}

export default DiscordBot;