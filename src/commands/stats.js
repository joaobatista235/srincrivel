import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Mostra estatísticas de performance do bot.'),

    async execute(interaction) {
        try {
            const stats = interaction.client.getPerformanceStats();
            
            const embed = new EmbedBuilder()
                .setTitle('📊 Estatísticas de Performance')
                .setColor('#00ff00')
                .setTimestamp();

            // Informações gerais
            const uptime = Math.floor(stats.uptime / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            embed.addFields(
                { 
                    name: '⏱️ Uptime', 
                    value: `${hours}h ${minutes}m`, 
                    inline: true 
                },
                { 
                    name: '🔄 Interações', 
                    value: stats.totalInteractions.toString(), 
                    inline: true 
                },
                { 
                    name: '❌ Erros', 
                    value: stats.totalErrors.toString(), 
                    inline: true 
                }
            );

            // Estatísticas dos comandos
            const commandStats = stats.commandStats;
            embed.addFields(
                { 
                    name: '📁 Comandos', 
                    value: `Carregados: ${commandStats.totalCommands}\nTempo: ${commandStats.loadTime}ms`, 
                    inline: true 
                }
            );

            // Estatísticas do DisTube
            const distubeStats = stats.distubeStats;
            embed.addFields(
                { 
                    name: '🎵 DisTube', 
                    value: `Tocadas: ${distubeStats.totalSongsPlayed}\nAdicionadas: ${distubeStats.totalSongsAdded}\nCache: ${distubeStats.cacheSize}`, 
                    inline: true 
                }
            );

            // Estatísticas do áudio
            const audioStats = stats.audioStats;
            embed.addFields(
                { 
                    name: '🔊 Áudio', 
                    value: `Tocados: ${audioStats.totalAudiosPlayed}\nCache: ${audioStats.cacheHitRate}\nErro: ${audioStats.errorRate.toFixed(1)}%`, 
                    inline: true 
                }
            );

            // Estatísticas do otimizador
            const optimizerStats = stats.optimizerStats;
            embed.addFields(
                { 
                    name: '⚡ Otimizações', 
                    value: `Debounce: ${optimizerStats.debounceTimers}\nThrottle: ${optimizerStats.throttleTimers}\nCache: ${optimizerStats.cacheSize}`, 
                    inline: true 
                }
            );

            // Estatísticas da IA
            const aiStats = stats.aiStats;
            embed.addFields(
                { 
                    name: '🤖 IA', 
                    value: `Contextos: ${aiStats.activeContexts}/${aiStats.totalContexts}\nMensagens: ${aiStats.totalMessages}`, 
                    inline: true 
                }
            );

            // Comandos mais usados (se disponível)
            if (commandStats.commandStats) {
                const commandUsage = Object.entries(commandStats.commandStats)
                    .sort(([,a], [,b]) => b.totalExecutions - a.totalExecutions)
                    .slice(0, 5)
                    .map(([name, stats]) => `${name}: ${stats.totalExecutions}x`)
                    .join('\n');

                if (commandUsage) {
                    embed.addFields({
                        name: '🔥 Comandos Mais Usados',
                        value: commandUsage,
                        inline: false
                    });
                }
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ Erro ao gerar estatísticas:', error);
            await interaction.reply({
                content: '❌ Erro ao gerar estatísticas de performance. Verifique se o bot está configurado corretamente.',
                ephemeral: true
            });
        }
    }
}; 