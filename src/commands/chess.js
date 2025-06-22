import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } from "discord.js";
import { Chess } from 'chess.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { getDirname } from '../utils/paths.js';
import { Worker } from 'worker_threads';

// Obtém o diretório do arquivo atual, essencial para carregar assets e o worker
const __dirname = getDirname(import.meta.url);

// --- CONSTANTES DE CONFIGURAÇÃO DO JOGO ---

const RATINGS = {
    'beginner': 'Iniciante (ELO ~800)',
    'intermediate': 'Intermediário (ELO ~1200)',
    'advanced': 'Avançado (ELO ~1600)',
    'expert': 'Expert (ELO ~2000+)'
};

// Mapeia a dificuldade para um valor de ELO para o Stockfish
const STOCKFISH_ELO_LEVELS = {
    'beginner': 800,
    'intermediate': 1200,
    'advanced': 1600,
    'expert': 2200
};

const COLORS = {
    'white': 'Brancas',
    'black': 'Pretas'
};

const PIECES = {
    'k': 'black-king.png', 'q': 'black-queen.png', 'r': 'black-rook.png', 'b': 'black-bishop.png', 'n': 'black-knight.png', 'p': 'black-pawn.png',
    'K': 'white-king.png', 'Q': 'white-queen.png', 'R': 'white-rook.png', 'B': 'white-bishop.png', 'N': 'white-knight.png', 'P': 'white-pawn.png'
};

const PIECE_NAMES = {
    'p': '♟️ Peão', 'n': '♞ Cavalo', 'b': '♝ Bispo', 'r': '♜ Torre', 'q': '♛ Rainha', 'k': '♚ Rei'
};

export default {
    // Definição do comando slash
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Cria um jogo de xadrez contra a IA'),

    // Armazena o estado dos jogos ativos E os workers do Stockfish
    gameState: new Map(),
    stockfishWorkers: new Map(), // Mapeia channelId -> worker instance

    // Função executada quando o comando /chess é usado
    async execute(interaction) {
        try {
            // Cria uma thread para manter o jogo organizado
            const thread = await interaction.channel.threads.create({
                name: `Xadrez-${interaction.user.username}`,
                autoArchiveDuration: 60, // A thread será arquivada após 1 hora de inatividade
                reason: 'Thread para partida de xadrez',
            });
            await thread.members.add(interaction.user.id);

            // Menus de seleção para o usuário configurar a partida
            const ratingSelect = new StringSelectMenuBuilder()
                .setCustomId('rating-select')
                .setPlaceholder('Escolha o nível da IA')
                .addOptions(Object.entries(RATINGS).map(([value, label]) => ({ label, value })));

            const colorSelect = new StringSelectMenuBuilder()
                .setCustomId('color-select')
                .setPlaceholder('Escolha sua cor')
                .addOptions(Object.entries(COLORS).map(([value, label]) => ({ label, value })));

            const row1 = new ActionRowBuilder().addComponents(ratingSelect);
            const row2 = new ActionRowBuilder().addComponents(colorSelect);

            // Envia a mensagem de configuração inicial para a thread
            await thread.send({
                content: `Olá, ${interaction.user.username}! Configure sua partida de xadrez:`,
                components: [row1, row2]
            });

            // Responde ao comando original de forma efêmera (só o usuário vê)
            await interaction.reply({
                content: `Jogo de xadrez criado na thread: ${thread.toString()}`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Erro ao executar o comando /chess:', error);
            await interaction.reply({
                content: 'Houve um erro ao tentar criar o jogo de xadrez.',
                ephemeral: true
            });
        }
    },

    // Inicializa o worker do Stockfish para um canal específico
    async initializeStockfishWorker(channelId) {
        if (this.stockfishWorkers.has(channelId)) {
            return this.stockfishWorkers.get(channelId);
        }

        return new Promise((resolve, reject) => {
            try {
                // Caminho correto para o worker que você criou
                const workerPath = path.join(__dirname, '..', 'utils', 'stockfish-worker.js');
                console.log(`🚀 Inicializando Stockfish worker para canal ${channelId}`);
                console.log(`📁 Caminho do worker: ${workerPath}`);

                const worker = new Worker(workerPath);
                let isReady = false;

                worker.on('message', (data) => {
                    console.log(`📨 [${channelId}] Stockfish:`, data.type);

                    if (data.type === 'ready' && !isReady) {
                        isReady = true;
                        console.log(`✅ [${channelId}] Stockfish pronto!`);
                        this.stockfishWorkers.set(channelId, worker);
                        resolve(worker);
                    } else if (data.type === 'error') {
                        console.error(`❌ [${channelId}] Erro no Stockfish:`, data.message);
                        if (!isReady) {
                            reject(new Error(data.message));
                        }
                    }
                });

                worker.on('error', (error) => {
                    console.error(`❌ [${channelId}] Erro no worker:`, error);
                    if (!isReady) {
                        reject(error);
                    }
                });

                worker.on('exit', (code) => {
                    console.log(`🔚 [${channelId}] Worker encerrado com código: ${code}`);
                    this.stockfishWorkers.delete(channelId);
                });

                // Timeout de 10 segundos para inicialização
                setTimeout(() => {
                    if (!isReady) {
                        console.error(`⏰ [${channelId}] Timeout na inicialização do Stockfish`);
                        worker.terminate();
                        reject(new Error('Timeout na inicialização do Stockfish'));
                    }
                }, 10000);

            } catch (error) {
                console.error(`❌ [${channelId}] Erro ao criar worker:`, error);
                reject(error);
            }
        });
    },

    // Função principal que lida com todas as interações (menus e botões)
    async handleInteraction(interaction) {
        if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

        // Obtém os dados do jogo atual ou cria um objeto vazio
        const gameData = this.gameState.get(interaction.channelId) || {};

        try {
            // --- 1. LÓGICA DE CONFIGURAÇÃO INICIAL (SELEÇÃO DE MENU) ---
            if (interaction.isStringSelectMenu()) {
                await interaction.deferUpdate();

                if (interaction.customId === 'rating-select') gameData.rating = interaction.values[0];
                if (interaction.customId === 'color-select') gameData.color = interaction.values[0];

                // Salva o progresso da configuração
                this.gameState.set(interaction.channelId, gameData);

                // Se ambas as opções (dificuldade e cor) foram escolhidas, o jogo começa
                if (gameData.rating && gameData.color) {
                    // Inicializa o Stockfish antes de começar o jogo
                    try {
                        console.log(`🔧 [${interaction.channelId}] Inicializando Stockfish...`);
                        await this.initializeStockfishWorker(interaction.channelId);
                        console.log(`✅ [${interaction.channelId}] Stockfish inicializado com sucesso!`);
                    } catch (error) {
                        console.error(`❌ [${interaction.channelId}] Falha ao inicializar Stockfish:`, error);
                        await interaction.followUp({
                            content: '❌ Erro ao inicializar a IA. Tente novamente mais tarde.',
                            ephemeral: true
                        });
                        return;
                    }

                    gameData.game = new Chess();
                    gameData.playerIsWhite = gameData.color === 'white';
                    gameData.playerUser = interaction.user;

                    // Apaga as mensagens de configuração para limpar o canal
                    await interaction.channel.bulkDelete(1);

                    const updateData = await this.getUpdateData(gameData);
                    const gameMessage = await interaction.channel.send(updateData);

                    // Salva o ID da mensagem principal do jogo para poder editá-la depois
                    gameData.gameMessageId = gameMessage.id;
                    this.gameState.set(interaction.channelId, gameData);

                    // Se não for a vez do jogador (ex: jogador escolheu pretas), a IA faz o primeiro movimento
                    if (gameData.game.turn() !== gameData.color.charAt(0)) {
                        await this.performAIMove(interaction.channel);
                    }
                }
                return;
            }

            // --- 2. LÓGICA DAS INTERAÇÕES DURANTE O JOGO (BOTÕES) ---
            if (interaction.isButton()) {
                if (!gameData.game || !gameData.gameMessageId) {
                    return interaction.reply({ content: 'Este jogo não está mais ativo.', ephemeral: true });
                }
                await interaction.deferUpdate();

                const gameMessage = await interaction.channel.messages.fetch(gameData.gameMessageId);

                if (interaction.customId === 'resign') {
                    const status = `${interaction.user.username} desistiu. ${gameData.playerIsWhite ? 'As Pretas' : 'As Brancas'} venceram!`;
                    await this.endGame(interaction.channel, status);
                    return;
                }

                if (interaction.customId === 'cancel-move') {
                    const updateData = await this.getUpdateData(gameData);
                    await gameMessage.edit(updateData);
                    return;
                }

                if (interaction.customId.startsWith('piece-')) {
                    const selectedSquare = interaction.customId.split('-')[1];
                    const moves = gameData.game.moves({ square: selectedSquare, verbose: true });
                    const highlightSquares = [selectedSquare, ...moves.map(m => m.to)];

                    const boardBuffer = await this.renderBoard(gameData.game, highlightSquares);
                    const components = this.createMoveButtons(selectedSquare, moves);

                    await gameMessage.edit({
                        files: [{ attachment: boardBuffer, name: 'chess-board.png' }],
                        components: components
                    });
                }

                if (interaction.customId.startsWith('move-')) {
                    const [_, from, to] = interaction.customId.split('-');

                    // Lida com a promoção de peão, promovendo automaticamente para Rainha
                    let promotion;
                    const piece = gameData.game.get(from);
                    if (piece.type === 'p' && ((piece.color === 'w' && from[1] === '7' && to[1] === '8') || (piece.color === 'b' && from[1] === '2' && to[1] === '1'))) {
                        promotion = 'q';
                    }

                    const move = gameData.game.move({ from, to, promotion });

                    if (!move) { // Movimento inválido (prevenção de bugs)
                        const updateData = await this.getUpdateData(gameData);
                        await gameMessage.edit(updateData);
                        await interaction.followUp({ content: "Movimento inválido!", ephemeral: true });
                        return;
                    }

                    const gameStatus = this.getGameStatus(gameData.game);
                    if (gameStatus) {
                        await this.endGame(interaction.channel, gameStatus, gameData.game);
                        return;
                    }

                    // Prepara para o turno da IA
                    const updateData = await this.getUpdateData(gameData, "🤖 IA está pensando...");
                    await gameMessage.edit(updateData);

                    await this.performAIMove(interaction.channel);
                }
            }

        } catch (error) {
            console.error('Erro ao lidar com interação de xadrez:', error);
            if (interaction.channel) {
                await interaction.channel.send('❌ Ocorreu um erro inesperado. O jogo foi encerrado.');
            }
            this.gameState.delete(interaction.channelId);
            this.cleanupWorker(interaction.channelId);
        }
    },

    // Orquestra o turno da IA
    async performAIMove(channel) {
        const gameData = this.gameState.get(channel.id);
        if (!gameData || !gameData.game) return;

        try {
            console.log(`🤖 [${channel.id}] IA está calculando movimento...`);

            // Pede o melhor movimento ao worker do Stockfish
            const bestMoveUci = await this.getBestMove(gameData.game, gameData.rating, channel.id);
            if (!bestMoveUci || bestMoveUci === '(none)') {
                await this.endGame(channel, "A IA não encontrou um movimento. Jogo empatado.");
                return;
            }

            console.log(`🎯 [${channel.id}] IA escolheu: ${bestMoveUci}`);

            // Realiza o movimento no tabuleiro lógico
            const move = gameData.game.move(bestMoveUci, { sloppy: true }); // 'sloppy' aceita o formato UCI (ex: "e2e4")

            if (!move) {
                console.error(`❌ [${channel.id}] Movimento UCI inválido: ${bestMoveUci}`);
                await this.endGame(channel, "Erro na IA. Jogo encerrado.");
                return;
            }

            this.gameState.set(channel.id, gameData);

            // Verifica se o jogo terminou após o movimento da IA
            const gameStatus = this.getGameStatus(gameData.game);
            if (gameStatus) {
                await this.endGame(channel, gameStatus, gameData.game);
                return;
            }

            // Atualiza a mensagem do jogo com o novo estado (vez do jogador)
            const gameMessage = await channel.messages.fetch(gameData.gameMessageId);
            const updateData = await this.getUpdateData(gameData);
            await gameMessage.edit(updateData);

        } catch (error) {
            console.error(`❌ [${channel.id}] Erro ao executar movimento da IA:`, error);
            await channel.send('❌ Ocorreu um erro com a IA. O jogo foi encerrado.');
            this.gameState.delete(channel.id);
            this.cleanupWorker(channel.id);
        }
    },

    // Função ATUALIZADA para obter o melhor movimento do Stockfish via Worker
    getBestMove(game, rating, channelId) {
        return new Promise((resolve, reject) => {
            const worker = this.stockfishWorkers.get(channelId);

            if (!worker) {
                reject(new Error('Worker do Stockfish não encontrado'));
                return;
            }

            const elo = STOCKFISH_ELO_LEVELS[rating];
            const fen = game.fen(); // FEN é a representação textual do tabuleiro

            console.log(`📡 [${channelId}] Enviando para Stockfish: ELO ${elo}, FEN: ${fen}`);

            // Listener temporário para esta busca específica
            const messageHandler = (msg) => {
                console.log(`📨 [${channelId}] Resposta Stockfish:`, msg.type, msg.move || msg.message);

                if (msg.type === 'bestMove') {
                    worker.off('message', messageHandler);
                    resolve(msg.move);
                } else if (msg.type === 'error') {
                    worker.off('message', messageHandler);
                    reject(new Error(msg.message));
                }
            };

            worker.on('message', messageHandler);

            // Timeout de 10 segundos para a busca
            const timeout = setTimeout(() => {
                worker.off('message', messageHandler);
                reject(new Error('Timeout na busca do melhor movimento'));
            }, 10000);

            // Intercepta o resolve para limpar o timeout
            const originalResolve = resolve;
            resolve = (move) => {
                clearTimeout(timeout);
                originalResolve(move);
            };

            // Envia a posição do tabuleiro e o ELO desejado para o worker
            worker.postMessage({
                type: 'findBestMove',
                fen,
                elo,
                time: 2000 // 2 segundos de análise
            });
        });
    },

    // Limpa o worker quando o jogo termina
    cleanupWorker(channelId) {
        const worker = this.stockfishWorkers.get(channelId);
        if (worker) {
            console.log(`🧹 [${channelId}] Limpando worker do Stockfish...`);
            worker.postMessage({ type: 'quit' });
            setTimeout(() => {
                worker.terminate();
            }, 1000);
            this.stockfishWorkers.delete(channelId);
        }
    },

    // Gera o objeto completo (embed, imagem, botões) para atualizar a mensagem do jogo
    async getUpdateData(gameData, customStatus = null) {
        const turn = gameData.game.turn() === 'w' ? 'Brancas' : 'Pretas';
        let statusText = customStatus || `Vez das ${turn}`;
        if (gameData.game.inCheck()) {
            statusText += ' (Xeque!)';
        }

        const boardBuffer = await this.renderBoard(gameData.game);

        const isPlayerTurn = gameData.game.turn() === gameData.color.charAt(0);
        let components = [];
        if (isPlayerTurn && !customStatus) {
            const movablePieces = this.getMovablePieces(gameData.game, gameData.color);
            components = this.createPieceButtons(movablePieces);
        } else {
            // Se não é a vez do jogador, mostra apenas o botão de desistir
            components = [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('resign').setLabel('🏳️ Desistir').setStyle(ButtonStyle.Danger)
            )];
        }

        const embed = new EmbedBuilder()
            .setColor(isPlayerTurn && !customStatus ? '#3BA55D' : '#F04747')
            .setTitle('Partida de Xadrez vs. IA')
            .addFields(
                { name: '👤 Jogador', value: gameData.playerUser.username, inline: true },
                { name: '🎨 Cor', value: COLORS[gameData.color], inline: true },
                { name: '🤖 Nível da IA', value: RATINGS[gameData.rating], inline: true },
                { name: '⚖️ Status', value: statusText }
            )
            .setImage('attachment://chess-board.png')
            .setTimestamp();

        return { content: '', embeds: [embed], files: [{ attachment: boardBuffer, name: 'chess-board.png' }], components };
    },

    // Finaliza o jogo, atualiza a mensagem final e limpa o estado
    async endGame(channel, status, game = null) {
        const gameData = this.gameState.get(channel.id);
        if (!gameData) return;

        const gameInstance = game || gameData.game;
        const gameMessage = await channel.messages.fetch(gameData.gameMessageId);

        const boardBuffer = await this.renderBoard(gameInstance);
        const embed = EmbedBuilder.from(gameMessage.embeds[0]); // Clona o embed existente
        embed.setColor('#4f545c');
        embed.data.fields.find(f => f.name === '⚖️ Status').value = `**FIM DE JOGO**\n${status}`;

        await gameMessage.edit({
            embeds: [embed],
            files: [{ attachment: boardBuffer, name: 'chess-board.png' }],
            components: [] // Remove todos os botões
        });

        console.log(`🏁 [${channel.id}] Jogo finalizado: ${status}`);

        // Limpa o estado do jogo e o worker
        this.gameState.delete(channel.id);
        this.cleanupWorker(channel.id);
    },

    // Renderiza a imagem do tabuleiro
    async renderBoard(game, highlightSquares = []) {
        const canvas = createCanvas(400, 400);
        const ctx = canvas.getContext('2d');
        const squareSize = 50;

        // Desenha as casas do tabuleiro
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = `${String.fromCharCode(97 + j)}${8 - i}`;
                ctx.fillStyle = (i + j) % 2 === 0 ? '#f0d9b5' : '#b58863'; // Cores de madeira
                if (highlightSquares.includes(square)) {
                    ctx.globalAlpha = 0.7; // Adiciona transparência ao destaque
                    ctx.fillStyle = '#86a666';
                }
                ctx.fillRect(j * squareSize, i * squareSize, squareSize, squareSize);
                ctx.globalAlpha = 1.0; // Reseta a transparência
            }
        }

        // Desenha as peças
        try {
            const board = game.board();
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const piece = board[i][j];
                    if (piece) {
                        const pieceKey = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
                        const imagePath = path.join(__dirname, '..', 'assets', 'chess', PIECES[pieceKey]);
                        const img = await loadImage(imagePath);
                        ctx.drawImage(img, j * squareSize, i * squareSize, squareSize, squareSize);
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao carregar imagens das peças. Verifique o caminho dos assets.', error);
        }

        // Desenha as coordenadas (a1, h8, etc.)
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Arial';
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = (i % 2 === 0) ? '#f0d9b5' : '#b58863';
            ctx.fillText(String.fromCharCode(97 + i), i * squareSize + 3, 397);
            ctx.fillStyle = (i % 2 !== 0) ? '#f0d9b5' : '#b58863';
            ctx.fillText(8 - i, 2, i * squareSize + 12);
        }

        return canvas.toBuffer();
    },

    // Verifica o status do jogo (xeque-mate, empate, etc.)
    getGameStatus(game) {
        if (game.isCheckmate()) return `♟️ Xeque-mate! ${game.turn() === 'w' ? 'As Pretas' : 'As Brancas'} venceram!`;
        if (game.isDraw()) return '🤝 Empate por insuficiência de material ou regra dos 50 lances!';
        if (game.isStalemate()) return '🤝 Empate por Afogamento!';
        if (game.isThreefoldRepetition()) return '🤝 Empate por repetição!';
        return null;
    },

    // Cria os botões para o jogador selecionar uma peça
    createPieceButtons(pieces) {
        const rows = [];
        let currentRow = new ActionRowBuilder();
        const maxButtonsPerRow = 5;

        pieces.forEach((piece, index) => {
            const emoji = PIECE_NAMES[piece.type.toLowerCase()].split(' ')[0];
            const button = new ButtonBuilder()
                .setCustomId(`piece-${piece.square}`)
                .setLabel(`${emoji} ${piece.square}`)
                .setStyle(ButtonStyle.Secondary);

            currentRow.addComponents(button);

            if (currentRow.components.length === maxButtonsPerRow && index < pieces.length - 1) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        });

        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }

        // Adiciona o botão de desistir
        if (rows.length < 5) {
            const lastRow = rows[rows.length - 1];
            if (lastRow && lastRow.components.length < 5) {
                lastRow.addComponents(new ButtonBuilder().setCustomId('resign').setLabel('🏳️ Desistir').setStyle(ButtonStyle.Danger));
            } else {
                rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('resign').setLabel('🏳️ Desistir').setStyle(ButtonStyle.Danger)));
            }
        }

        return rows.slice(0, 5); // Garante o limite de 5 fileiras do Discord
    },

    // Cria os botões para o jogador selecionar o destino de uma peça
    createMoveButtons(selectedPiece, moves) {
        const rows = [];
        let currentRow = new ActionRowBuilder();
        const maxButtonsPerRow = 5;

        moves.forEach((move, index) => {
            const label = move.to + (move.promotion ? `=${move.promotion.toUpperCase()}` : '');
            const button = new ButtonBuilder()
                .setCustomId(`move-${selectedPiece}-${move.to}`)
                .setLabel(label)
                .setStyle(ButtonStyle.Success);

            currentRow.addComponents(button);

            if (currentRow.components.length === maxButtonsPerRow && index < moves.length - 1) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        });

        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }

        // Adiciona botões de controle (cancelar e desistir)
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cancel-move').setLabel('↩️ Cancelar').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('resign').setLabel('🏳️ Desistir').setStyle(ButtonStyle.Danger)
        );
        rows.push(controlRow);

        return rows.slice(0, 5);
    },

    // Obtém todas as peças do jogador que podem se mover
    getMovablePieces(game, playerColor) {
        const pieces = [];
        const colorChar = playerColor.charAt(0);

        if (game.turn() !== colorChar) return []; // Se não for o turno do jogador, não há peças móveis

        game.board().flat().forEach(piece => {
            if (piece && piece.color === colorChar) {
                const moves = game.moves({ square: piece.square, verbose: true });
                if (moves.length > 0) {
                    pieces.push({ type: piece.type, square: piece.square });
                }
            }
        });
        return pieces;
    }
};