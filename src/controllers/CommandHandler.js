import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import fs from 'node:fs/promises';
import path from 'node:path';
import { __dirname } from '../utils/discord-bot-config.js';

class CommandHandler {
    constructor(client, distube, channelContext) {
        this.client = client;
        this.distube = distube;
        this.channelContexts = channelContext;
        this.rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        this.loadTime = 0;
        this.commandStats = new Map();
    }

    async loadCommands() {
        const startTime = Date.now();
        const commandsPath = path.join(__dirname, '..', 'commands');

        try {
            const commandFiles = await fs.readdir(commandsPath);
            const jsFiles = commandFiles.filter(file => file.endsWith('.js'));

            console.log(`📁 Encontrados ${jsFiles.length} arquivos de comando`);

            const commandPromises = jsFiles.map(async (file) => {
                const filePath = path.join(commandsPath, file);
                try {
                    const command = await import(`file://${filePath}`);
                    return { file, command: command.default };
                } catch (error) {
                    console.error(`❌ Erro ao carregar comando ${file}:`, error);
                    return null;
                }
            });

            const commands = await Promise.all(commandPromises);

            for (const result of commands) {
                if (result && 'data' in result.command && 'execute' in result.command) {
                    this.client.commands.set(result.command.data.name, result.command);
                } else if (result) {
                    console.log(`⚠️ Comando em ${result.file} está faltando "data" ou "execute".`);
                }
            }

            this.loadTime = Date.now() - startTime;
            console.log(`🚀 ${this.client.commands.size} comandos carregados em ${this.loadTime}ms`);

        } catch (error) {
            console.error('❌ Erro ao carregar comandos:', error);
            throw error;
        }
    }

    async registerCommands() {
        try {
            console.log(`📝 Começando a registrar ${this.client.commands.size} comandos globalmente.`);
            await this.rest.put(
                Routes.applicationGuildCommands(this.client.user?.id || '', '844365064785100802'),
                { body: this.client.commands.map(command => command.data.toJSON()) },
            );

            console.log(`✅ Comandos registrados com sucesso.`);

        } catch (error) {
            console.error(`❌ Erro ao registrar comandos:`, error);
        }
    }

    async handleInteraction(interaction) {
        const startTime = Date.now();
        const commandName = interaction.commandName ?? interaction.customId;

        console.log('🔄 Interaction received:', {
            type: interaction.type,
            isCommand: interaction.isChatInputCommand(),
            isSelect: interaction.isStringSelectMenu(),
            isButton: interaction.isButton(),
            commandName,
            customId: interaction.customId
        });

        const command = interaction.client.commands.get(commandName);
        if (command) {
            try {
                await command.execute(interaction, this.distube, this.channelContexts);

                const executionTime = Date.now() - startTime;
                this.recordCommandExecution(commandName, executionTime, true);

            } catch (error) {
                console.error(`❌ Erro ao executar o comando ${commandName}:`, error);

                this.recordCommandExecution(commandName, Date.now() - startTime, false);

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Houve um erro ao executar esse comando!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Houve um erro ao executar esse comando!', ephemeral: true });
                }
            }
        } else if ((interaction.isStringSelectMenu() || interaction.isButton()) && interaction.channel.name.startsWith('Xadrez-')) {
            const chessCommand = interaction.client.commands.get('chess');
            if (chessCommand) {
                try {
                    await chessCommand.handleInteraction(interaction);
                } catch (err) {
                    console.error('❌ Erro ao processar interação do xadrez:', err);
                    try {
                        await interaction.channel.send({
                            content: '❌ Ocorreu um erro ao processar sua seleção.',
                            ephemeral: true
                        });
                    } catch (e) {
                        console.error('❌ Erro ao enviar mensagem de erro:', e);
                    }
                }
            }
        }
    }

    recordCommandExecution(commandName, executionTime, success) {
        if (!this.commandStats.has(commandName)) {
            this.commandStats.set(commandName, {
                totalExecutions: 0,
                successfulExecutions: 0,
                failedExecutions: 0,
                totalExecutionTime: 0,
                averageExecutionTime: 0,
                lastExecution: null
            });
        }

        const stats = this.commandStats.get(commandName);
        stats.totalExecutions++;
        stats.totalExecutionTime += executionTime;
        stats.averageExecutionTime = stats.totalExecutionTime / stats.totalExecutions;
        stats.lastExecution = Date.now();

        if (success) {
            stats.successfulExecutions++;
        } else {
            stats.failedExecutions++;
        }

        // Log de performance para comandos lentos
        if (executionTime > 1000) {
            console.warn(`⚠️ Comando ${commandName} executado em ${executionTime}ms (lento)`);
        }
    }

    getCommandStats() {
        const stats = {};
        for (const [commandName, commandStats] of this.commandStats) {
            stats[commandName] = {
                ...commandStats,
                successRate: commandStats.totalExecutions > 0
                    ? (commandStats.successfulExecutions / commandStats.totalExecutions) * 100
                    : 0
            };
        }
        return stats;
    }

    getPerformanceStats() {
        return {
            loadTime: this.loadTime,
            totalCommands: this.client.commands.size,
            commandStats: this.getCommandStats()
        };
    }
}

export default CommandHandler;