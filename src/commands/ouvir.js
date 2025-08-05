import { SlashCommandBuilder } from '@discordjs/builders';
import { transcribeAudio } from '../transcriber/whisper.js';

import {
    joinVoiceChannel,
    EndBehaviorType
} from '@discordjs/voice';
import prism from 'prism-media';
import fs from 'fs';
import path from 'path';

export default {
    data: new SlashCommandBuilder()
        .setName('ouvir')
        .setDescription('O Sr Incrível ouve o que um usuário específico fala.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para ouvir')
                .setRequired(true)
        ),

    async execute(interaction) {
        const channel = interaction.member.voice.channel;
        if (!channel) {
            return await interaction.reply({ content: '❌ Você precisa estar em um canal de voz.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('usuario');
        const targetMember = interaction.guild.members.cache.get(targetUser.id);

        if (!targetMember || !targetMember.voice.channel) {
            return await interaction.reply({
                content: `❌ ${targetUser.username} não está em um canal de voz.`,
                ephemeral: true
            });
        }

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: false
        });

        await interaction.reply({
            content: `👂 Estou ouvindo ${targetUser.username}...`,
            ephemeral: false
        });

        const receiver = connection.receiver;
        const activeStreams = new Map();
        const streamTimeouts = new Map();

        const processAudioChunks = async (audioChunks, userId, username, startTime) => {
            if (audioChunks.length === 0) return;

            const duration = Date.now() - startTime;
            if (duration < 500) {
                console.log(`Audio muito curto de ${username} (${duration}ms), ignorando...`);
                return;
            }

            try {
                const audioBuffer = Buffer.concat(audioChunks);

                if (audioBuffer.length < 1000) {
                    console.log(`Buffer muito pequeno de ${username}, ignorando...`);
                    return;
                }

                const tempFilePath = path.join(process.cwd(), 'temp', `${userId}_${Date.now()}.pcm`);

                const tempDir = path.dirname(tempFilePath);
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                fs.writeFileSync(tempFilePath, audioBuffer);

                const transcription = await transcribeAudio(
                    tempFilePath,
                    userId,
                    username
                );

                if (transcription && transcription.trim()) {
                    await interaction.followUp({
                        content: `🎤 **${username}**: ${transcription}`,
                        ephemeral: false
                    });
                }

            } catch (error) {
                console.error('Erro ao processar áudio:', error);
            }
        };

        const forceEndStream = async (userId, username) => {
            const streamData = activeStreams.get(userId);
            if (!streamData) return;

            if (streamTimeouts.has(userId)) {
                clearTimeout(streamTimeouts.get(userId));
                streamTimeouts.delete(userId);
            }

            activeStreams.delete(userId);

            console.log(`${username} parou de falar (forçado)`);

            if (streamData.stream) {
                streamData.stream.destroy();
            }

            await processAudioChunks(streamData.audioChunks, userId, username, streamData.startTime);
        };

        receiver.speaking.on('start', async (userId) => {
            if (userId !== targetUser.id) return;

            if (activeStreams.has(userId)) {
                console.log(`${targetUser.username} já está sendo processado, ignorando...`);
                return;
            }

            const user = interaction.guild.members.cache.get(userId);
            if (!user) return;

            console.log(`${user.user.username} começou a falar`);

            const audioStream = receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 1000,
                },
            });

            const streamData = {
                stream: audioStream,
                startTime: Date.now(),
                audioChunks: []
            };
            activeStreams.set(userId, streamData);

            const timeoutId = setTimeout(() => {
                console.log(`⏰ Timeout forçado para ${user.user.username} após 10 segundos`);
                forceEndStream(userId, user.user.username);
            }, 10000);

            streamTimeouts.set(userId, timeoutId);

            const pcmStream = new prism.opus.Decoder({
                rate: 48000,
                channels: 2,
                frameSize: 960,
            });

            audioStream.pipe(pcmStream);

            pcmStream.on('data', (chunk) => {
                const streamData = activeStreams.get(userId);
                if (streamData) {
                    streamData.audioChunks.push(chunk);

                    if (streamTimeouts.has(userId)) {
                        clearTimeout(streamTimeouts.get(userId));
                        const newTimeoutId = setTimeout(() => {
                            console.log(`⏰ Timeout forçado para ${user.user.username} após inatividade`);
                            forceEndStream(userId, user.user.username);
                        }, 3000);
                        streamTimeouts.set(userId, newTimeoutId);
                    }
                }
            });

            pcmStream.on('end', async () => {
                if (streamTimeouts.has(userId)) {
                    clearTimeout(streamTimeouts.get(userId));
                    streamTimeouts.delete(userId);
                }

                const streamData = activeStreams.get(userId);
                if (!streamData) {
                    console.log(`Stream data not found for ${user.user.username}`);
                    return;
                }

                activeStreams.delete(userId);

                console.log(`${user.user.username} parou de falar (natural)`);

                await processAudioChunks(streamData.audioChunks, userId, user.user.username, streamData.startTime);
            });

            audioStream.on('error', (error) => {
                console.error('Erro no stream de áudio:', error);
                forceEndStream(userId, user.user.username);
            });

            pcmStream.on('error', (error) => {
                console.error('Erro no decoder PCM:', error);
                forceEndStream(userId, user.user.username);
            });
        });

        receiver.speaking.on('end', (userId) => {
            if (userId === targetUser.id && activeStreams.has(userId)) {
                console.log(`🔇 Discord detectou fim da fala para ${targetUser.username}`);
                const streamData = activeStreams.get(userId);
                if (streamData) {
                    setTimeout(() => {
                        if (activeStreams.has(userId)) {
                            console.log(`Forçando limpeza para ${targetUser.username}`);
                            forceEndStream(userId, targetUser.username);
                        }
                    }, 1000);
                }
            }
        });

        const cleanup = () => {
            streamTimeouts.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            streamTimeouts.clear();

            activeStreams.forEach((streamData) => {
                if (streamData && streamData.stream) {
                    streamData.stream.destroy();
                }
            });
            activeStreams.clear();

            connection.destroy();
            console.log('Conexão de voz finalizada');
        };

        setTimeout(cleanup, 10 * 60 * 1000);

        const filter = i => i.customId === 'stop_listening' && i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 600000 });

        collector.on('collect', async i => {
            cleanup();
            await i.update({ content: '🔇 Parei de ouvir.', components: [] });
        });
    },
};