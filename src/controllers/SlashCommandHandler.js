import { SlashCommandBuilder } from '@discordjs/builders';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SlashCommandHandler {
    constructor(client) {
        this.client = client;
        this.client.commands = new Map();
    }

    async registerCommands() {
        const commandsPath = path.resolve(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        const commands = [];

        for (const file of commandFiles) {
            try {
                const filePath = path.resolve(commandsPath, file);
                const { default: command } = await import(`file://${filePath}`);

                if (!command.name || !command.description) {
                    throw new Error(`O comando ${command.name || file} está faltando um 'name' ou 'description'.`);
                }

                const slashCommand = new SlashCommandBuilder()
                    .setName(command.name)
                    .setDescription(command.description);

                if (command.options) {
                    command.options.forEach(option => {
                        slashCommand.addStringOption(opt =>
                            opt.setName(option.name).setDescription(option.description).setRequired(option.required)
                        );
                    });
                }

                commands.push(slashCommand.toJSON());

                this.client.commands.set(command.name, command);
            } catch (error) {
                console.error(`Erro ao carregar o comando ${file}:`, error);
            }
        }

        try {
            await this.client.guilds.cache.get(process.env.GUILD_ID)?.commands.set(commands);
            console.log('Comandos registrados com sucesso!');
        } catch (error) {
            console.error('Erro ao registrar comandos:', error);
        }
    }

    setupInteractionHandler() {
        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;

            const command = this.client.commands.get(interaction.commandName);

            if (command) {
                try {
                    await command.run(this.client, interaction);
                } catch (err) {
                    console.error(`Erro ao executar o comando ${interaction.commandName}:`, err);
                    await interaction.reply(`❌ Ocorreu um erro ao executar o comando: ${err.message}`);
                }
            }
        });
    }
}

export default SlashCommandHandler;