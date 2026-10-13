import { SlashCommandBuilder } from '@discordjs/builders';
import {
    joinVoiceChannel,
    EndBehaviorType
} from '@discordjs/voice';
import prism from 'prism-media';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import FormData from 'form-data';

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BIT_DEPTH = 16;

const MIN_DURATION_MS = 500;      // duração mínima de fala para enviar
const ENERGY_THRESHOLD = 600;     // limiar RMS — ajuste conforme seu microfone/ambiente
const FORCE_TIMEOUT_MS = 10000;   // forçar fim após 10s
const INACTIVITY_MS = 1200;       // considerar fim após 1.2s de silêncio
const COOLDOWN_AFTER_PROCESS_MS = 1500; // não enviar nova transcrição antes disso (por usuário)

function writeWavFile(filePath, pcmBuffer, sampleRate = SAMPLE_RATE, channels = CHANNELS, bitDepth = BIT_DEPTH) {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * channels * (bitDepth / 8);
    const blockAlign = channels * (bitDepth / 8);
    const dataSize = pcmBuffer.length;

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    fs.writeFileSync(filePath, Buffer.concat([header, pcmBuffer]));
}

function analyzeChunkRMS(chunk, streamData) {
    const sampleBytes = 2;
    const totalSamples = chunk.length / sampleBytes;
    let sumSquares = 0;
    for (let i = 0; i < chunk.length; i += sampleBytes) {
        const s = chunk.readInt16LE(i);
        sumSquares += s * s;
    }
    streamData.sumSquares += sumSquares;
    streamData.sampleCount += totalSamples;
}

function computeRMS(streamData) {
    if (streamData.sampleCount === 0) return 0;
    const meanSquare = streamData.sumSquares / streamData.sampleCount;
    return Math.sqrt(meanSquare);
}

export default {
    data: new SlashCommandBuilder()
        .setName('ouvir')
        .setDescription('Ouve o que um usuário fala e envia para o serviço de transcrição em Python.')
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
            content: `🎤 Ouvindo ${targetUser.username}...`,
            ephemeral: false
        });

        const receiver = connection.receiver;
        const activeStreams = new Map();
        const lastProcessed = new Map();

        const processAudioChunks = async (userId, username) => {
            const streamData = activeStreams.get(userId);
            if (!streamData) return;

            const durationMs = Date.now() - streamData.startTime;
            const rms = computeRMS(streamData);

            activeStreams.delete(userId);
            if (streamData.timeoutId) clearTimeout(streamData.timeoutId);

            if (durationMs < MIN_DURATION_MS) {
                console.log(`Áudio muito curto de ${username} (${durationMs}ms), ignorando.`);
                return;
            }
            if (rms < ENERGY_THRESHOLD) {
                console.log(`Áudio de ${username} provavelmente ruído (RMS ${Math.round(rms)}), ignorando.`);
                return;
            }

            const last = lastProcessed.get(userId) || 0;
            if (Date.now() - last < COOLDOWN_AFTER_PROCESS_MS) {
                console.log(`Cooldown: ignorando requisição extra de ${username}.`);
                return;
            }
            lastProcessed.set(userId, Date.now());

            const audioBuffer = Buffer.concat(streamData.audioChunks || []);
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            const tempFilePath = path.join(tempDir, `${userId}_${Date.now()}.wav`);
            try {
                writeWavFile(tempFilePath, audioBuffer, SAMPLE_RATE, CHANNELS, BIT_DEPTH);
            } catch (err) {
                console.error('Erro ao escrever WAV:', err);
                return;
            }

            try {
                const formData = new FormData();
                formData.append('file', fs.createReadStream(tempFilePath));
                formData.append('username', username);

                const res = await fetch('http://0.0.0.0:4000/transcribe', {
                    method: 'POST',
                    body: formData,
                });

                const contentType = (res.headers.get('content-type') || '').toLowerCase();

                if (!res.ok) {
                    const text = await res.text().catch(() => '<não foi possível ler corpo>');
                    console.error('Erro do serviço de transcrição:', res.status, text);
                } else if (contentType.includes('application/json')) {
                    const data = await res.json();
                    console.log(`📝 Transcrição de ${username}:`, (data.transcription ?? data.text ?? '').trim());
                } else {
                    const text = await res.text().catch(() => '<não foi possível ler corpo>');
                    console.log(`Resposta não-JSON do transcriber para ${username}:`, text);
                }
            } catch (err) {
                console.error('Erro ao enviar para o serviço Python:', err);
            } finally {
                try { fs.unlinkSync(tempFilePath); } catch (e) { /* ignore */ }
            }
        };

        const forceEndStream = async (userId, username) => {
            const streamData = activeStreams.get(userId);
            if (!streamData) return;
            try {
                if (streamData.decoder) streamData.decoder.removeAllListeners();
                if (streamData.stream) streamData.stream.destroy();
            } catch (e) { /* ignore */ }

            await processAudioChunks(userId, username);
        };

        receiver.speaking.on('start', (userId) => {
            if (userId !== targetUser.id) return;
            if (activeStreams.has(userId)) {
                return;
            }

            const user = interaction.guild.members.cache.get(userId);
            if (!user) return;

            const username = user.user.username;
            console.log(`▶ ${username} começou a falar`);

            const audioStream = receiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 1000
                }
            });

            const pcmDecoder = new prism.opus.Decoder({
                rate: SAMPLE_RATE,
                channels: CHANNELS,
                frameSize: 960
            });

            const streamData = {
                stream: audioStream,
                decoder: pcmDecoder,
                startTime: Date.now(),
                audioChunks: [],
                sumSquares: 0,
                sampleCount: 0,
                timeoutId: null
            };
            activeStreams.set(userId, streamData);

            streamData.timeoutId = setTimeout(() => {
                console.log(`⏰ Timeout forçado para ${username}`);
                forceEndStream(userId, username);
            }, FORCE_TIMEOUT_MS);

            audioStream.pipe(pcmDecoder);

            pcmDecoder.on('data', (chunk) => {
                streamData.audioChunks.push(chunk);
                analyzeChunkRMS(chunk, streamData);
                streamData.lastActivity = Date.now();

                if (streamData.inactivityTimer) clearTimeout(streamData.inactivityTimer);
                streamData.inactivityTimer = setTimeout(() => {
                    console.log(`⏱ Inatividade detectada para ${username}, processando.`);
                    forceEndStream(userId, username);
                }, INACTIVITY_MS);
            });

            pcmDecoder.on('end', async () => {
                console.log(`${username} parou de falar (evento end)`);
                if (streamData.inactivityTimer) clearTimeout(streamData.inactivityTimer);
                if (streamData.timeoutId) clearTimeout(streamData.timeoutId);
                await processAudioChunks(userId, username);
            });

            audioStream.on('error', (err) => {
                console.error('Erro no audioStream:', err);
                forceEndStream(userId, username);
            });

            pcmDecoder.on('error', (err) => {
                console.error('Erro no decoder PCM:', err);
                forceEndStream(userId, username);
            });
        });

        receiver.speaking.on('end', (userId) => {
            if (userId === targetUser.id && activeStreams.has(userId)) {
                const streamData = activeStreams.get(userId);
                if (streamData) {
                    setTimeout(() => {
                        if (activeStreams.has(userId)) {
                            console.log(`🔇 Discord detectou fim para ${targetUser.username}, forçando processamento.`);
                            forceEndStream(userId, targetUser.username);
                        }
                    }, 500);
                }
            }
        });

        const cleanup = () => {
            activeStreams.forEach((s) => {
                try {
                    if (s.stream) s.stream.destroy();
                    if (s.decoder) s.decoder.destroy && s.decoder.destroy();
                } catch (e) { /* ignore */ }
                if (s.timeoutId) clearTimeout(s.timeoutId);
                if (s.inactivityTimer) clearTimeout(s.inactivityTimer);
            });
            activeStreams.clear();
            connection.destroy();
            console.log('Conexão de voz finalizada (cleanup)');
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
