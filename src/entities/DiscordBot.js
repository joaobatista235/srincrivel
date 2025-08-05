import { Client, Collection } from 'discord.js';
import { DisTube } from 'distube';
import dotenv from 'dotenv';
import CommandHandler from '../controllers/CommandHandler.js';
import DistubeHandler from '../controllers/DistubeHandler.js';
import PlayAudioHandler from '../controllers/PlayAudioHandler.js';
import usuarios from '../utils/usuarios.json' assert { type: 'json' };
import { getDirname } from '../utils/paths.js';
import { intents, plugins } from '../utils/discord-bot-config.js';
import ResponseOptimizer from '../utils/ResponseOptimizer.js';
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
        this.responseOptimizer = new ResponseOptimizer();
        this.contextManager = new AIContextManager();
        
        this.performanceStats = {
            startTime: Date.now(),
            totalInteractions: 0,
            totalErrors: 0,
            uptime: 0
        };

        this.client.getPerformanceStats = this.getPerformanceStats.bind(this);
        this.client.contextManager = this.contextManager;
    }

    async initialize() {
        console.log('🚀 Iniciando bot com otimizações de performance...');
        
        await this.commandHandler.loadCommands();
        this.distubeHandler.init();
        this.setupEventListeners();
        this.setupPerformanceMonitoring();
        
        await this.client.login(process.env.TOKEN);
    }

    setupEventListeners() {
        this.client.on('ready', async () => {
            console.log(`✅ Bot conectado como ${this.client.user.tag}`);
            await this.commandHandler.registerCommands();
            
            const loadTime = this.commandHandler.loadTime;
            console.log(`⚡ Bot inicializado em ${loadTime}ms`);
        });

        this.client.on('interactionCreate', async (interaction) => {
            this.performanceStats.totalInteractions++;
            
            if (interaction.isChatInputCommand()) {
                await this.responseOptimizer.optimizeInteraction(
                    interaction,
                    () => this.commandHandler.handleInteraction(interaction),
                    { debounceDelay: 500 }
                );
            } else {
                await this.commandHandler.handleInteraction(interaction);
            }
        });

        this.client.on('voiceStateUpdate', (oldState, newState) => {
            this.responseOptimizer.throttle(
                `voice-${newState.guild.id}`,
                () => this.playAudioHandler.execute(oldState, newState),
                1000
            );
        });

        this.client.on('messageCreate', this.handleAIMessage.bind(this));

        this.client.on('error', (error) => {
            console.error('❌ Erro no cliente Discord:', error);
            this.performanceStats.totalErrors++;
        });
    }

    setupPerformanceMonitoring() {
        setInterval(() => {
            this.logPerformanceStats();
        }, 5 * 60 * 1000);

        setInterval(() => {
            this.cleanupCaches();
        }, 10 * 60 * 1000);

        setInterval(() => {
            this.performanceStats.uptime = Date.now() - this.performanceStats.startTime;
        }, 60 * 1000);
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
            this.performanceStats.totalErrors++;
            await message.channel.send(`❌ Erro ao processar sua mensagem: ${error.message}`);
        }
    }

    logPerformanceStats() {
        const uptime = Math.floor((Date.now() - this.performanceStats.startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        console.log('\n📊 === ESTATÍSTICAS DE PERFORMANCE ===');
        console.log(`⏱️  Uptime: ${hours}h ${minutes}m`);
        console.log(`🔄 Total de interações: ${this.performanceStats.totalInteractions}`);
        console.log(`❌ Total de erros: ${this.performanceStats.totalErrors}`);
        
        // Estatísticas dos comandos
        const commandStats = this.commandHandler.getPerformanceStats();
        console.log(`📁 Comandos carregados: ${commandStats.totalCommands}`);
        console.log(`⚡ Tempo de carregamento: ${commandStats.loadTime}ms`);
        
        // Estatísticas do DisTube
        const distubeStats = this.distubeHandler.getPerformanceStats();
        console.log(`🎵 Músicas tocadas: ${distubeStats.totalSongsPlayed}`);
        console.log(`➕ Músicas adicionadas: ${distubeStats.totalSongsAdded}`);
        console.log(`📊 Cache de embeds: ${distubeStats.cacheSize}`);
        
        // Estatísticas do PlayAudioHandler
        const audioStats = this.playAudioHandler.getPerformanceStats();
        console.log(`🔊 Áudios tocados: ${audioStats.totalAudiosPlayed}`);
        console.log(`🎯 Taxa de cache: ${audioStats.cacheHitRate}`);
        console.log(`❌ Taxa de erro: ${audioStats.errorRate.toFixed(1)}%`);
        
        // Estatísticas do ResponseOptimizer
        const optimizerStats = this.responseOptimizer.getMetrics();
        console.log(`⏳ Timers de debounce: ${optimizerStats.debounceTimers}`);
        console.log(`🚦 Timers de throttle: ${optimizerStats.throttleTimers}`);
        console.log(`💾 Cache de respostas: ${optimizerStats.cacheSize}`);
        
        // Estatísticas do AIContextManager
        const aiStats = this.contextManager.getStats();
        console.log(`🤖 Contextos de IA: ${aiStats.activeContexts}/${aiStats.totalContexts}`);
        console.log(`💬 Total de mensagens: ${aiStats.totalMessages}`);
        
        console.log('=====================================\n');
    }

    cleanupCaches() {
        this.distubeHandler.cleanupCache();
        this.playAudioHandler.cleanupCache();
        this.responseOptimizer.cleanupCache();
        console.log('🧹 Limpeza de cache concluída');
    }

    getPerformanceStats() {
        return {
            uptime: this.performanceStats.uptime,
            totalInteractions: this.performanceStats.totalInteractions,
            totalErrors: this.performanceStats.totalErrors,
            commandStats: this.commandHandler.getPerformanceStats(),
            distubeStats: this.distubeHandler.getPerformanceStats(),
            audioStats: this.playAudioHandler.getPerformanceStats(),
            optimizerStats: this.responseOptimizer.getMetrics(),
            aiStats: this.contextManager.getStats()
        };
    }
}

export default DiscordBot;