import fs from 'fs';
import { spawn } from 'child_process';
import FormData from 'form-data';
import fetch from 'node-fetch';

const transcriptionQueue = new Map();
let isProcessing = false;

/**
 * Convert PCM audio to WAV format using FFmpeg
 * @param {string} inputPath - Path to PCM file
 * @param {string} outputPath - Path for WAV output
 * @returns {Promise<void>}
 */
function convertPCMtoWAV(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-f', 's16le',           // Input format: signed 16-bit little endian
            '-ar', '48000',          // Sample rate: 48kHz
            '-ac', '2',              // Channels: 2 (stereo)
            '-i', inputPath,         // Input file
            '-y',                    // Overwrite output file
            outputPath               // Output file
        ]);

        ffmpeg.stderr.on('data', () => { });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', reject);
    });
}

/**
 * Transcribe audio using OpenAI Whisper API with form-data (Node 18 compatible)
 * @param {string} wavPath - Path to WAV audio file
 * @returns {Promise<string>} - Transcribed text
 */
async function callWhisperAPI(wavPath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(wavPath), {
        filename: 'audio.wav',
        contentType: 'audio/wav'
    });
    form.append('model', 'whisper-1');
    form.append('language', 'pt');
    form.append('response_format', 'text');
    form.append('temperature', '0.2');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            ...form.getHeaders()
        },
        body: form
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return await response.text();
}

/**
 * Process transcription queue to avoid overlapping requests
 */
async function processQueue() {
    if (isProcessing || transcriptionQueue.size === 0) return;

    isProcessing = true;

    const [userId, { audioPath, username, resolve, reject }] = transcriptionQueue.entries().next().value;
    transcriptionQueue.delete(userId);

    try {
        const result = await transcribeAudioDirect(audioPath, username);
        resolve(result);
    } catch (error) {
        reject(error);
    }

    isProcessing = false;

    if (transcriptionQueue.size > 0) {
        setTimeout(processQueue, 100);
    }
}

/**
 * Direct transcription function (internal use)
 * @param {string} audioPath - Path to PCM audio file
 * @param {string} username - Username for logging
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudioDirect(audioPath, username) {
    try {
        const wavPath = audioPath.replace('.pcm', '.wav');
        await convertPCMtoWAV(audioPath, wavPath);

        const stats = fs.statSync(wavPath);
        if (stats.size < 2000) {
            console.log(`Audio muito pequeno de ${username}, pulando transcrição`);
            fs.unlinkSync(wavPath);
            return '';
        }

        console.log(`🎤 Transcrevendo áudio de ${username}...`);

        const transcription = await callWhisperAPI(wavPath);

        fs.unlinkSync(wavPath);
        if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
        }

        const result = transcription.trim();
        if (result) {
            console.log(`📝 ${username} disse: "${result}"`);
        }

        return result;

    } catch (error) {
        console.error(`Erro na transcrição de ${username}:`, error.message);

        const wavPath = audioPath.replace('.pcm', '.wav');
        [wavPath, audioPath].forEach(path => {
            if (fs.existsSync(path)) {
                fs.unlinkSync(path);
            }
        });

        return '';
    }
}

/**
 * Queue-based transcription to prevent overlapping requests
 * @param {string} audioPath - Path to PCM audio file
 * @param {string} userId - User ID for queue management
 * @param {string} username - Username for logging
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribeAudio(audioPath, userId = 'unknown', username = 'Usuário') {
    return new Promise((resolve, reject) => {
        if (transcriptionQueue.has(userId)) {
            const existing = transcriptionQueue.get(userId);
            existing.reject(new Error('Cancelled by newer request'));

            if (fs.existsSync(existing.audioPath)) {
                fs.unlinkSync(existing.audioPath);
            }
        }

        transcriptionQueue.set(userId, {
            audioPath,
            username,
            resolve,
            reject
        });

        processQueue();
    });
}

/**
 * Alternative: Simple transcription without queue (faster but may overlap)
 * @param {string} audioPath - Path to PCM audio file
 * @param {string} username - Username for logging
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribeAudioSimple(audioPath, username = 'Usuário') {
    return transcribeAudioDirect(audioPath, username);
}