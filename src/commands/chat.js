import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import usuarios from '../utils/usuarios.json' assert { type: 'json' };
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Cache para o contexto
let contextCache = null;
let contextCacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Função otimizada para ler CONTEXT do arquivo .env
async function getContextFromFile() {
    const now = Date.now();
    
    // Usar cache se válido
    if (contextCache && (now - contextCacheTimestamp) < CACHE_DURATION) {
        return contextCache;
    }
    
    try {
        const envPath = path.join(process.cwd(), '.env');
        const envContent = await fs.readFile(envPath, 'utf8');
        
        // Extrair CONTEXT usando regex
        const contextMatch = envContent.match(/CONTEXT="([\s\S]*?)"\s*$/m);
        
        if (contextMatch) {
            contextCache = contextMatch[1];
            contextCacheTimestamp = now;
            return contextCache;
        }
        
        return null;
    } catch (error) {
        console.error('❌ Erro ao ler arquivo .env:', error);
        return null;
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Cria um chat privado com IA.'),

    async execute(interaction, _distube, channelContext) {
        if (!interaction.guild) {
            return interaction.reply({
                content: "❌ Este comando só pode ser usado em um servidor.",
                ephemeral: true
            });
        }

        const category = interaction.guild.channels.cache.get('1316251242430992414');
        if (!category || category.type !== 4) {
            return interaction.reply({
                content: '❌ Categoria de chats privados não configurada corretamente.',
                ephemeral: true
            });
        }

        try {
            const privateChannel = await interaction.guild.channels.create({
                name: `ia-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    },
                ],
            });
            
            // Carregar contexto do arquivo
            const contextFromFile = await getContextFromFile();
            
            if (!contextFromFile) {
                await interaction.reply({
                    content: '❌ Erro: Variável CONTEXT não configurada no arquivo .env',
                    ephemeral: true
                });
                return;
            }
            
            const contextInitial = contextFromFile + `
            Você está conversando com o usuário de ID ${interaction.user.id} que se chama ${usuarios[interaction.user.id].name}
            `;

            const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

            // Configurar contexto
            channelContext.set(privateChannel.id, {
                model: model,
                user: interaction.user.id,
                messages: [{ role: 'system', content: contextInitial }]
            });

            // Inicializar contexto no AIContextManager
            interaction.client.contextManager.initializeContext(privateChannel.id, contextInitial);

            await privateChannel.send('Envie suas mensagens para começar a conversa com o Sr Incrível.');

            await interaction.reply({
                content: `✅ Seu canal privado foi criado: ${privateChannel}`,
                ephemeral: true,
            });

            setTimeout(async () => {
                try {
                    await privateChannel.delete('Canal de IA expirado');
                    channelContext.delete(privateChannel.id);
                    interaction.client.contextManager.clearContext(privateChannel.id);
                } catch (error) {
                    console.error('Erro ao excluir o canal de IA:', error);
                }
            }, 30 * 60 * 1000);
        } catch (err) {
            console.error('Erro ao criar canal privado:', err);
            await interaction.reply({
                content: `❌ Erro ao criar o canal: ${err.message}`,
                ephemeral: true,
            });
        }
    }
};
