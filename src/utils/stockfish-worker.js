import { parentPort } from 'worker_threads';
import { spawn } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { getDirname } from '../utils/paths.js';

const __dirname = getDirname(import.meta.url);

class StockfishWorker {
    constructor() {
        this.engine = null;
        this.engineReady = false;
        this.buffer = '';
        this.init();
    }

    log(...args) {
        console.log('[StockfishWorker]', ...args);
    }
    logError(...args) {
        console.error('[StockfishWorker]', ...args);
    }
    sendToParent(msg) {
        parentPort.postMessage(msg);
    }

    init() {
        const enginePath = path.join(__dirname, '..', 'engine', 'stockfish.exe');
        this.log('Procurando Stockfish em:', enginePath);

        if (!existsSync(enginePath)) {
            this.logError('Stockfish não encontrado em:', enginePath);
            this.sendToParent({ type: 'error', message: `Stockfish não encontrado. Verifique se o arquivo está em: ${enginePath}` });
            process.exit(1);
        }
        this.log('Stockfish encontrado!');

        try {
            this.engine = spawn(enginePath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
            this.log('Stockfish iniciado com PID:', this.engine.pid);
        } catch (error) {
            this.logError('Erro ao iniciar Stockfish:', error);
            this.sendToParent({ type: 'error', message: `Erro ao iniciar Stockfish: ${error.message}` });
            process.exit(1);
        }

        this.engine.stdout.on('data', (data) => this.handleEngineOutput(data.toString()));
        this.engine.stderr.on('data', (data) => this.handleEngineError(data.toString()));
        this.engine.on('error', (err) => {
            this.logError('Erro no processo Stockfish:', err);
            this.sendToParent({ type: 'error', message: `Erro no processo Stockfish: ${err.message}` });
        });
        this.engine.on('close', (code, signal) => {
            this.log(`Stockfish fechou - Código: ${code}, Sinal: ${signal}`);
            this.sendToParent({ type: 'closed', code, signal });
        });

        parentPort.on('message', (data) => this.handleParentMessage(data));

        process.on('SIGTERM', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('exit', () => this.cleanup());

        this.log('Enviando comando UCI...');
        this.engine.stdin.write('uci\n');
    }

    handleEngineOutput(data) {
        this.buffer += data;
        let lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        for (let line of lines) {
            const message = line.trim();
            if (!message) continue;
            this.log('[Engine]:', message);
            if (message === 'uciok') {
                this.engineReady = true;
                this.log('Stockfish pronto para receber comandos');
                this.sendToParent({ type: 'ready' });
            }
            if (message.startsWith('bestmove')) {
                const parts = message.split(' ');
                const bestMove = parts[1];
                this.log('Melhor movimento encontrado:', bestMove);
                this.sendToParent({ type: 'bestMove', move: bestMove, fullMessage: message });
            }
            if (message.startsWith('info')) {
                this.sendToParent({ type: 'analysis', info: message });
            }
        }
    }

    handleEngineError(data) {
        const errorMsg = data.trim();
        if (errorMsg) {
            this.logError('[Engine Error]:', errorMsg);
            this.sendToParent({ type: 'engineError', message: errorMsg });
        }
    }

    handleParentMessage(data) {
        this.log('Comando recebido:', data);
        if (data.type === 'ping') {
            this.sendToParent({ type: 'pong', ready: this.engineReady });
            return;
        }
        if (!this.engineReady && data.type !== 'init') {
            this.sendToParent({ type: 'error', message: 'Stockfish ainda não está pronto. Aguarde a inicialização.' });
            return;
        }
        try {
            if (data.type === 'findBestMove') {
                this.log('Procurando melhor movimento...');
                this.log(`   FEN: ${data.fen}`);
                this.log(`   ELO: ${data.elo || 'Não limitado'}`);
                if (data.elo) {
                    this.engine.stdin.write(`setoption name UCI_LimitStrength value true\n`);
                    this.engine.stdin.write(`setoption name UCI_Elo value ${data.elo}\n`);
                } else {
                    this.engine.stdin.write(`setoption name UCI_LimitStrength value false\n`);
                }
                this.engine.stdin.write(`position fen ${data.fen}\n`);
                this.engine.stdin.write(`go movetime ${data.time || 1000}\n`);
            } else if (data.type === 'stop') {
                this.log('Parando análise...');
                this.engine.stdin.write('stop\n');
            } else if (data.type === 'quit') {
                this.log('Encerrando Stockfish...');
                this.engine.stdin.write('quit\n');
            } else if (data.type === 'customCommand') {
                this.log('Comando customizado:', data.command);
                this.engine.stdin.write(data.command + '\n');
            }
        } catch (error) {
            this.logError('Erro ao enviar comando:', error);
            this.sendToParent({ type: 'error', message: `Erro ao enviar comando: ${error.message}` });
        }
    }

    cleanup() {
        this.log('Limpando recursos...');
        if (this.engine && !this.engine.killed) {
            try {
                this.engine.stdin.write('quit\n');
                this.engine.kill('SIGTERM');
            } catch (error) {
                this.logError('Erro ao encerrar engine:', error);
                this.engine.kill('SIGKILL');
            }
        }
    }
}

new StockfishWorker();