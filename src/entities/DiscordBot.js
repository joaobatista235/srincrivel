import { Client, Collection } from 'discord.js';
import { DisTube } from 'distube';
import dotenv from 'dotenv';
import CommandHandler from '../controllers/CommandHandler.js';
import DistubeHandler from '../controllers/DistubeHandler.js';
import PlayAudioHandler from '../controllers/PlayAudioHandler.js';
import usuarios from '../utils/usuarios.json' assert { type: 'json' };
import { getDirname } from '../utils/paths.js';
import { intents, plugins } from '../utils/discord-bot-config.js';

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
    }

    async initialize() {
        await this.commandHandler.loadCommands();
        this.distubeHandler.init();
        this.setupEventListeners();
        await this.client.login(process.env.TOKEN);
    }

    setupEventListeners() {
        this.client.on('ready', async () => {
            console.log(`Bot conectado como ${this.client.user.tag}`);
            await this.commandHandler.registerCommands();
        });
        this.client.on('interactionCreate', this.commandHandler.handleInteraction.bind(this.commandHandler));
        this.client.on('voiceStateUpdate', this.playAudioHandler.execute.bind(this.playAudioHandler));
        this.client.on('messageCreate', this.handleAIMessage.bind(this));
    }

    async handleAIMessage(message) {
        if (message.author.bot) return;

        const channelContext = this.channelContexts.get(message.channel.id);
        if (!channelContext || message.channel.parentId !== '1316251242430992414') return;

        try {
            const userMessage = message.content.trim();
            const processingMsg = await message.channel.send('🔄 Processando...');

            channelContext.messages.push({ role: 'user', content: userMessage });

            const conversationHistory = channelContext.messages.map(msg => `${msg.role}: ${msg.content}`).join("\n");
            const result = await channelContext.model.generateContent(conversationHistory);
            const aiResponseText = result.response.text();

            channelContext.messages.push({ role: 'assistant', content: aiResponseText });

            await processingMsg.edit({
                content: `${aiResponseText}`,
            });
        } catch (error) {
            console.error('Erro ao processar mensagem da IA:', error);
            await message.channel.send(`❌ Erro ao processar sua mensagem: ${error.message}`);
        }
    }

    // async sendMessagesToUsers() {
    //     for (const [userId, userInfo] of Object.entries(usuarios)) {
    //         try {
    //             const user = await this.client.users.fetch(userId);
    //             if (user) {
    //                 await user.send(`🎄 Feliz Natal, ${userInfo.name}! Que seu dia seja repleto de alegria e bons momentos! 🎅`);
    //                 console.log(`Mensagem enviada para ${userInfo.name} (${userId})`);
    //             }
    //         } catch (error) {
    //             console.error(`Erro ao enviar mensagem para ${userId}:`, error);
    //         }
    //     }
    // }
}

export default DiscordBot;