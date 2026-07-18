import { Client, Collection } from 'discord.js';
import { DisTube } from 'distube';
import dotenv from 'dotenv';
import CommandHandler from '../controllers/CommandHandler.js';
import DistubeHandler from '../controllers/DistubeHandler.js';
import PlayAudioHandler from '../controllers/PlayAudioHandler.js';
import usuarios from '../utils/usuarios.json' assert { type: 'json' };
import { getDirname } from '../utils/paths.js';
import { intents, plugins } from '../utils/discord-bot-config.js';
import AIContextManager from '../utils/AIContextManager.js';

class DiscordBot {
    constructor() {
        dotenv.config();
        this.client = new Client({ intents });
        this.distube = new DisTube(this.client, plugins);
        this.channelContexts = new Map();
        this.commandHandler = new CommandHandler(this.client, this.distube, this.channelContexts);
        this.distubeHandler = new DistubeHandler(this.client, this.distube);
        this.playAudioHandler = new PlayAudioHandler(this.client, usuarios, getDirname(import.meta.url));
        this.client.commands = new Collection();
        this.contextManager = new AIContextManager();
        this.client.contextManager = this.contextManager;
    }

    async initialize() {
        console.log('🚀 Iniciando bot com otimizações de performance...');
        
        await this.commandHandler.loadCommands();
        this.distubeHandler.init();
        this.setupEventListeners();
        
        await this.client.login(process.env.TOKEN);
    }

    setupEventListeners() {
        this.client.on('ready', async () => {
            console.log(`✅ Bot conectado como ${this.client.user.tag}`);
            await this.commandHandler.registerCommands();
            console.log(`⚡ Bot inicializado`);
        });

        this.client.on('interactionCreate', async (interaction) => {
            await this.commandHandler.handleInteraction(interaction);
        });

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            this.playAudioHandler.execute(oldState, newState);
        });

        this.client.on('messageCreate', this.handleAIMessage.bind(this));

        this.client.on('error', (error) => {
            console.error('❌ Erro no cliente Discord:', error);
        });
    }

    async handleAIMessage(message) {
        if (message.author.bot) return;

        const channelContext = this.channelContexts.get(message.channel.id);
        if (!channelContext || message.channel.parentId !== '1316251242430992414') return;

        try {
            const userMessage = message.content.trim();
            const processingMsg = await message.channel.send('🔄 Processando...');

            this.contextManager.addMessage(message.channel.id, { role: 'user', content: userMessage });

            const conversationHistory = this.contextManager.getConversationHistory(message.channel.id);
            const result = await channelContext.model.generateContent(conversationHistory);
            const aiResponseText = result.response.text();

            this.contextManager.addAIResponse(message.channel.id, aiResponseText);

            await processingMsg.edit({
                content: `${aiResponseText}`,
            });
        } catch (error) {
            console.error('❌ Erro ao processar mensagem da IA:', error);
            await message.channel.send(`❌ Erro ao processar sua mensagem: ${error.message}`);
        }
    }
}

export default DiscordBot;