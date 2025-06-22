import path from 'path';
import { Worker } from 'worker_threads';
import { __dirname } from '../utils/discord-bot-config.js';

class StockfishHandler {
    constructor() {
        this.workers = new Map();
    }

    async initWorker(channelId) {
        if (this.workers.has(channelId)) {
            return this.workers.get(channelId);
        }
        return new Promise((resolve, reject) => {
            try {
                const workerPath = path.join(__dirname, '..', 'utils', 'stockfish-worker.js');
                const worker = new Worker(workerPath);
                let isReady = false;
                worker.on('message', (data) => {
                    if (data.type === 'ready' && !isReady) {
                        isReady = true;
                        this.workers.set(channelId, worker);
                        resolve(worker);
                    } else if (data.type === 'error') {
                        if (!isReady) {
                            reject(new Error(data.message));
                        }
                    }
                });
                worker.on('error', (error) => {
                    if (!isReady) {
                        reject(error);
                    }
                });
                worker.on('exit', () => {
                    this.workers.delete(channelId);
                });
                setTimeout(() => {
                    if (!isReady) {
                        worker.terminate();
                        reject(new Error('Timeout na inicialização do Stockfish'));
                    }
                }, 10000);
            } catch (error) {
                reject(error);
            }
        });
    }

    getBestMove(fen, elo, channelId) {
        return new Promise((resolve, reject) => {
            const worker = this.workers.get(channelId);
            if (!worker) {
                reject(new Error('Worker do Stockfish não encontrado para este canal.'));
                return;
            }
            const messageHandler = (msg) => {
                if (msg.type === 'bestMove') {
                    worker.off('message', messageHandler);
                    resolve(msg.move);
                } else if (msg.type === 'error') {
                    worker.off('message', messageHandler);
                    reject(new Error(msg.message));
                }
            };
            worker.on('message', messageHandler);
            const timeout = setTimeout(() => {
                worker.off('message', messageHandler);
                reject(new Error('Timeout na busca do melhor movimento'));
            }, 10000);
            const originalResolve = resolve;
            resolve = (move) => {
                clearTimeout(timeout);
                originalResolve(move);
            };
            worker.postMessage({
                type: 'findBestMove',
                fen,
                elo,
                time: 3000
            });
        });
    }

    terminateWorker(channelId) {
        const worker = this.workers.get(channelId);
        if (worker) {
            worker.postMessage({ type: 'quit' });
            setTimeout(() => {
                worker.terminate();
            }, 1000);
            this.workers.delete(channelId);
        }
    }
}

export default StockfishHandler; 