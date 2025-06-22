import { parentPort } from 'worker_threads';
import { spawn } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { getDirname } from '../utils/paths.js';

const __dirname = getDirname(import.meta.url)

// Caminho do executável do Stockfish (ajustado para a estrutura correta)
const enginePath = path.join(__dirname, '..', 'engine', 'stockfish.exe');
console.log('Procurando Stockfish em:', enginePath);

// Verifica se o arquivo existe
if (!existsSync(enginePath)) {
    console.error('❌ Stockfish não encontrado em:', enginePath);
    parentPort.postMessage({
        type: 'error',
        message: `Stockfish não encontrado. Verifique se o arquivo está em: ${enginePath}`
    });
    process.exit(1);
}

console.log('✅ Stockfish encontrado!');

// Inicializa a engine como processo filho
let engine;
let engineReady = false;

try {
    engine = spawn(enginePath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log('🚀 Stockfish iniciado com PID:', engine.pid);
} catch (error) {
    console.error('❌ Erro ao iniciar Stockfish:', error);
    parentPort.postMessage({
        type: 'error',
        message: `Erro ao iniciar Stockfish: ${error.message}`
    });
    process.exit(1);
}

// Buffer para processar saída linha por linha
let buffer = '';

// Lê a saída da engine
engine.stdout.on('data', (data) => {
    buffer += data.toString();

    let lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Mantém pedaços incompletos

    for (let line of lines) {
        const message = line.trim();
        if (message) {
            console.log('📡 [Stockfish]:', message);

            // Engine pronta
            if (message === 'uciok') {
                engineReady = true;
                console.log('✅ Stockfish pronto para receber comandos');
                parentPort.postMessage({ type: 'ready' });
            }

            // Melhor movimento encontrado
            if (message.startsWith('bestmove')) {
                const parts = message.split(' ');
                const bestMove = parts[1];
                console.log('🎯 Melhor movimento encontrado:', bestMove);
                parentPort.postMessage({
                    type: 'bestMove',
                    move: bestMove,
                    fullMessage: message
                });
            }

            // Informações de análise
            if (message.startsWith('info')) {
                parentPort.postMessage({
                    type: 'analysis',
                    info: message
                });
            }
        }
    }
});

// Lida com erros da engine
engine.stderr.on('data', (data) => {
    const errorMsg = data.toString().trim();
    if (errorMsg) {
        console.error('❌ [Stockfish Error]:', errorMsg);
        parentPort.postMessage({
            type: 'engineError',
            message: errorMsg
        });
    }
});

// Lida com erros do processo
engine.on('error', (err) => {
    console.error('❌ Erro no processo Stockfish:', err);
    parentPort.postMessage({
        type: 'error',
        message: `Erro no processo Stockfish: ${err.message}`
    });
});

// Lida com o fechamento do processo
engine.on('close', (code, signal) => {
    console.log(`🔚 Stockfish fechou - Código: ${code}, Sinal: ${signal}`);
    parentPort.postMessage({
        type: 'closed',
        code: code,
        signal: signal
    });
});

// Envia o comando inicial para inicializar o protocolo UCI
console.log('📤 Enviando comando UCI...');
engine.stdin.write('uci\n');

// Recebe comandos do processo principal
parentPort.on('message', (data) => {
    console.log('📨 Comando recebido:', data);

    if (data.type === 'ping') {
        parentPort.postMessage({ type: 'pong', ready: engineReady });
        return;
    }

    if (!engineReady && data.type !== 'init') {
        parentPort.postMessage({
            type: 'error',
            message: 'Stockfish ainda não está pronto. Aguarde a inicialização.'
        });
        return;
    }

    try {
        if (data.type === 'findBestMove') {
            console.log('🔍 Procurando melhor movimento...');
            console.log(`   FEN: ${data.fen}`);
            console.log(`   ELO: ${data.elo || 'Não limitado'}`);

            // Configura força da engine se ELO foi especificado
            if (data.elo) {
                engine.stdin.write(`setoption name UCI_LimitStrength value true\n`);
                engine.stdin.write(`setoption name UCI_Elo value ${data.elo}\n`);
            } else {
                engine.stdin.write(`setoption name UCI_LimitStrength value false\n`);
            }

            // Define a posição e inicia a busca
            engine.stdin.write(`position fen ${data.fen}\n`);
            engine.stdin.write(`go movetime ${data.time || 1000}\n`);
        }

        if (data.type === 'stop') {
            console.log('⏹️ Parando análise...');
            engine.stdin.write('stop\n');
        }

        if (data.type === 'quit') {
            console.log('👋 Encerrando Stockfish...');
            engine.stdin.write('quit\n');
        }

        if (data.type === 'customCommand') {
            console.log('⚙️ Comando customizado:', data.command);
            engine.stdin.write(data.command + '\n');
        }

    } catch (error) {
        console.error('❌ Erro ao enviar comando:', error);
        parentPort.postMessage({
            type: 'error',
            message: `Erro ao enviar comando: ${error.message}`
        });
    }
});

// Limpa recursos quando o worker é encerrado
const cleanup = () => {
    console.log('🧹 Limpando recursos...');
    if (engine && !engine.killed) {
        try {
            engine.stdin.write('quit\n');
            engine.kill('SIGTERM');
        } catch (error) {
            console.error('Erro ao encerrar engine:', error);
            engine.kill('SIGKILL');
        }
    }
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('exit', cleanup);

// Avisa que o worker foi iniciado
console.log('🔧 Worker do Stockfish inicializado');