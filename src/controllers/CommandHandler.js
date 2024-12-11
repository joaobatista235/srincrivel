import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CommandHandler {
    constructor(client, distube, channelContext) {
        this.client = client;
        this.distube = distube;
        this.channelContexts = channelContext;
        this.rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    }

    async loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = await import(`file://${filePath}`);

            if ('data' in command.default && 'execute' in command.default) {
                this.client.commands.set(command.default.data.name, command.default);
            } else {
                console.log(`[WARNING] O comando em ${file} está faltando "data" ou "execute".`);
            }
        }
    }

    async registerCommands() {
        try {
            console.log(`Começando a registrar (${this.client.commands.size}) comandos globalmente.`);
            await this.rest.put(
                Routes.applicationGuildCommands(this.client.user?.id || '', '844365064785100802'),
                { body: this.client.commands.map(command => command.data.toJSON()) },
            );

            console.log(`Comandos registrados com sucesso.`);

        } catch (error) {
            console.error(`Erro ao registrar comandos:`, error);
        }
    }

    async handleInteraction(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`Nenhum comando correspondente encontrado para ${interaction.commandName}.`);
            return;
        }

        try {
            await command.execute(interaction, this.distube, this.channelContexts);
        } catch (error) {
            console.error(`Erro ao executar o comando ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Houve um erro ao executar esse comando!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Houve um erro ao executar esse comando!', ephemeral: true });
            }
        }
    }
}


export default CommandHandler;