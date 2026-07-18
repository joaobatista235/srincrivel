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

            console.log(`🚀 ${this.client.commands.size} comandos carregados em ${Date.now() - startTime}ms`);

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
            } catch (error) {
                console.error(`❌ Erro ao executar o comando ${commandName}:`, error);

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'Houve um erro ao executar esse comando!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'Houve um erro ao executar esse comando!', ephemeral: true });
                }
            }
        }
    }

}

export default CommandHandler;