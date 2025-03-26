import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { DisTube } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { YouTubePlugin } from '@distube/youtube';
import dotenv from 'dotenv';
import CommandHandler from '../controllers/CommandHandler.js';
import DistubeHandler from '../controllers/DistubeHandler.js';
import PlayAudioHandler from '../controllers/PlayAudioHandler.js';
import usuarios from '../config/usuarios.json' assert { type: 'json' };
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

class DiscordBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMembers,
            ],
        });
        this.distube = new DisTube(this.client, {
            plugins: [new YtDlpPlugin(), new YouTubePlugin()],
            emitNewSongOnly: true,
        });
        this.channelContexts = new Map();
        this.commandHandler = new CommandHandler(this.client, this.distube, this.channelContexts);
        this.distubeHandler = new DistubeHandler(this.client, this.distube);
        this.playAudioHandler = new PlayAudioHandler(this.client, usuarios, __dirname);

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

    async sendMessagesToUsers() {
        for (const [userId, userInfo] of Object.entries(usuarios)) {
            try {
                const user = await this.client.users.fetch(userId);
                if (user) {
                    await user.send(`🎄 Feliz Natal, ${userInfo.name}! Que seu dia seja repleto de alegria e bons momentos! 🎅`);
                    console.log(`Mensagem enviada para ${userInfo.name} (${userId})`);
                }
            } catch (error) {
                console.error(`Erro ao enviar mensagem para ${userId}:`, error);
            }
        }
    }
}

export default DiscordBot;