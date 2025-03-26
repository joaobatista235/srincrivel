import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } from "discord.js";
import { Chess } from 'chess.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RATINGS = {
    'beginner': 'Iniciante (800-1000)',
    'intermediate': 'Intermediário (1200-1400)',
    'advanced': 'Avançado (1600-1800)',
    'expert': 'Expert (2000+)'
};

const COLORS = {
    'white': 'Brancas',
    'black': 'Pretas'
};

const PIECES = {
    'k': 'black-king.png',
    'q': 'black-queen.png',
    'r': 'black-rook.png',
    'b': 'black-bishop.png',
    'n': 'black-knight.png',
    'p': 'black-pawn.png',
    'K': 'white-king.png',
    'Q': 'white-queen.png',
    'R': 'white-rook.png',
    'B': 'white-bishop.png',
    'N': 'white-knight.png',
    'P': 'white-pawn.png'
};

const PIECE_NAMES = {
    'p': '♟️ Peão',
    'n': '♞ Cavalo',
    'b': '♝ Bispo',
    'r': '♜ Torre',
    'q': '♛ Rainha',
    'k': '♚ Rei'
};

const ELO_RATINGS = {
    'beginner': 1000,
    'intermediate': 1500,
    'advanced': 2000,
    'expert': 2500
};

export default {
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Cria um jogo de xadrez contra a IA'),
    
    gameState: new Map(),

    stockfish: null,
    stockfishMove: null,

    async execute(interaction) {
        try {
            const thread = await interaction.channel.threads.create({
                name: `chess-${interaction.user.username}`,
                autoArchiveDuration: 60,
                reason: 'Chess game thread',
            });

            await thread.members.add(interaction.user.id);

            const ratingSelect = new StringSelectMenuBuilder()
                .setCustomId('rating-select')
                .setPlaceholder('Escolha o nível do adversário')
                .addOptions(Object.entries(RATINGS).map(([value, label]) => ({
                    label,
                    value,
                    description: `Nível ${label.split(' ')[0]}`
                })));

            const colorSelect = new StringSelectMenuBuilder()
                .setCustomId('color-select')
                .setPlaceholder('Escolha sua cor')
                .addOptions(Object.entries(COLORS).map(([value, label]) => ({
                    label,
                    value
                })));

            const row1 = new ActionRowBuilder().addComponents(ratingSelect);
            const row2 = new ActionRowBuilder().addComponents(colorSelect);

            await thread.send({
                content: 'Bem-vindo ao jogo de xadrez! Configure sua partida:',
                components: [row1, row2]
            });

            await interaction.reply({
                content: `Jogo criado em ${thread.toString()}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Chess command error:', error);
            await interaction.reply({
                content: 'Houve um erro ao criar o jogo de xadrez.',
                ephemeral: true
            });
        }
    },

    createPieceButtons(pieces) {
        const allRows = [];
        const maxRowsPerMessage = 5;
        
        // Agrupar peças por tipo
        const groupedPieces = {};
        pieces.forEach(piece => {
            const type = piece.type.toLowerCase();
            if (!groupedPieces[type]) {
                groupedPieces[type] = [];
            }
            groupedPieces[type].push(piece);
        });

        // Array para armazenar todas as linhas
        let currentRows = [];
        let currentRowCount = 0;

        // Função auxiliar para adicionar título
        const addTitle = (type) => {
            if (currentRowCount >= maxRowsPerMessage) {
                allRows.push(currentRows);
                currentRows = [];
                currentRowCount = 0;
            }
            
            currentRows.push(
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`title-${type}`)
                            .setLabel(PIECE_NAMES[type])
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    )
            );
            currentRowCount++;
        };

        // Função auxiliar para adicionar linha de botões
        const addPieceRow = (pieces) => {
            if (currentRowCount >= maxRowsPerMessage) {
                allRows.push(currentRows);
                currentRows = [];
                currentRowCount = 0;
            }

            const row = new ActionRowBuilder();
            pieces.forEach(piece => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`piece-${piece.square}`)
                        .setLabel(piece.square)
                        .setStyle(ButtonStyle.Secondary)
                );
            });
            currentRows.push(row);
            currentRowCount++;
        };

        // Processar todas as peças na ordem desejada
        const pieceTypes = ['k', 'q', 'r', 'b', 'n', 'p'];
        
        for (const type of pieceTypes) {
            if (groupedPieces[type] && groupedPieces[type].length > 0) {
                addTitle(type);
                
                // Dividir peças em grupos de 5 por linha
                for (let i = 0; i < groupedPieces[type].length; i += 5) {
                    const pieceGroup = groupedPieces[type].slice(i, Math.min(i + 5, groupedPieces[type].length));
                    addPieceRow(pieceGroup);
                }
            }
        }

        // Adicionar as últimas linhas se houver
        if (currentRows.length > 0) {
            // Adicionar botão de desistência na última mensagem
            if (currentRowCount < maxRowsPerMessage) {
                currentRows.push(
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('resign')
                                .setLabel('🏳️ Desistir')
                                .setStyle(ButtonStyle.Danger)
                        )
                );
            }
            allRows.push(currentRows);
        }

        return allRows;
    },

    createMoveButtons(selectedPiece, moves) {
        const rows = [];
        
        for (let i = 0; i < moves.length && rows.length < 4; i += 5) {
            const row = new ActionRowBuilder();
            moves.slice(i, i + 5).forEach(move => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`move-${selectedPiece}-${move.to}`)
                        .setLabel(move.to)
                        .setStyle(ButtonStyle.Success)
                );
            });
            rows.push(row);
        }

        if (rows.length < 5) {
            rows.push(
                new ActionRowBuilder()
                    .addComponents([
                        new ButtonBuilder()
                            .setCustomId('cancel-move')
                            .setLabel('↩️ Cancelar')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('resign')
                            .setLabel('🏳️ Desistir')
                            .setStyle(ButtonStyle.Danger)
                    ])
            );
        }

        return rows;
    },

    async renderBoard(game, highlightSquares = []) {
        const canvas = createCanvas(400, 400);
        const ctx = canvas.getContext('2d');
        const squareSize = 50;

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = `${String.fromCharCode(97 + j)}${8 - i}`;
                ctx.fillStyle = (i + j) % 2 === 0 ? '#FFFFFF' : '#4F4F4F';
                if (highlightSquares.includes(square)) {
                    ctx.fillStyle = (i + j) % 2 === 0 ? '#90EE90' : '#006400';
                }
                ctx.fillRect(j * squareSize, i * squareSize, squareSize, squareSize);
            }
        }

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
            console.error('Erro ao carregar imagens das peças:', error);
        }

        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        for (let i = 0; i < 8; i++) {
            ctx.fillText(8 - i, 5, i * squareSize + 15);
            ctx.fillText(String.fromCharCode(97 + i), i * squareSize + 40, 395);
        }

        return canvas.toBuffer();
    },

    // Adicionar função para lidar com as interações
    async handleInteraction(interaction) {
        try {
            console.log('Chess interaction:', {
                type: interaction.type,
                customId: interaction.customId,
                values: interaction.values
            });

            let gameData = this.gameState.get(interaction.channelId) || {
                rating: null,
                color: null,
                game: null
            };

            if (interaction.isStringSelectMenu()) {
                await interaction.deferUpdate();

                if (interaction.customId === 'rating-select') {
                    gameData.rating = interaction.values[0];
                    await interaction.channel.send(`Nível selecionado: ${RATINGS[interaction.values[0]]}`);
                }

                if (interaction.customId === 'color-select') {
                    gameData.color = interaction.values[0];
                    await interaction.channel.send(`Cor selecionada: ${COLORS[interaction.values[0]]}`);
                }

                this.gameState.set(interaction.channelId, gameData);

                if (gameData.rating && gameData.color) {
                    gameData.game = new Chess();
                    const boardBuffer = await this.renderBoard(gameData.game);

                    const gameEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('🎮 Nova Partida de Xadrez')
                        .setDescription(`Partida iniciada por ${interaction.user.username}`)
                        .addFields(
                            { name: '👤 Jogador', value: interaction.user.username, inline: true },
                            { name: '⚪ Cor', value: COLORS[gameData.color], inline: true },
                            { name: '📊 Nível', value: RATINGS[gameData.rating], inline: true },
                            { name: '\u200B', value: '\u200B' },
                            { name: '⏰ Status', value: gameData.color === 'white' ? '🎲 Sua vez de jogar!' : '🤖 IA está pensando...' }
                        )
                        .setImage('attachment://chess-board.png')
                        .setTimestamp()
                        .setFooter({ text: 'Use os botões abaixo para jogar' });

                    if (gameData.color === 'white') {
                        const possiblePieces = this.getMovablePieces(gameData.game, gameData.color);
                        const allButtonRows = this.createPieceButtons(possiblePieces);
                        
                        // Enviar múltiplas mensagens se necessário
                        for (let i = 0; i < allButtonRows.length; i++) {
                            await interaction.channel.send({
                                components: allButtonRows[i]
                            });
                        }
                    }
                }
            }
            else if (interaction.isButton()) {
                await interaction.deferUpdate();

                if (interaction.customId === 'resign') {
                    const resignEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('🏳️ Partida Encerrada')
                        .setDescription(`${interaction.user.username} desistiu da partida.`)
                        .setTimestamp();

                    await interaction.channel.send({ embeds: [resignEmbed] });

                    this.gameState.delete(interaction.channelId);

                    const ratingSelect = new StringSelectMenuBuilder()
                        .setCustomId('rating-select')
                        .setPlaceholder('Escolha o nível do adversário')
                        .addOptions(Object.entries(RATINGS).map(([value, label]) => ({
                            label,
                            value,
                            description: `Nível ${label.split(' ')[0]}`
                        })));

                    const colorSelect = new StringSelectMenuBuilder()
                        .setCustomId('color-select')
                        .setPlaceholder('Escolha sua cor')
                        .addOptions(Object.entries(COLORS).map(([value, label]) => ({
                            label,
                            value
                        })));

                    const row1 = new ActionRowBuilder().addComponents(ratingSelect);
                    const row2 = new ActionRowBuilder().addComponents(colorSelect);

                    await interaction.channel.send({
                        content: 'Iniciar nova partida:',
                        components: [row1, row2]
                    });

                    return;
                }

                if (!gameData.game) {
                    await interaction.channel.send('❌ Erro: Jogo não inicializado corretamente.');
                    return;
                }

                if (interaction.customId.startsWith('piece-')) {
                    const selectedPiece = interaction.customId.split('-')[1];
                    const moves = gameData.game.moves({ square: selectedPiece, verbose: true });
                    const boardBuffer = await this.renderBoard(gameData.game, moves.map(m => m.to));
                    const rows = this.createMoveButtons(selectedPiece, moves);

                    await interaction.channel.send({
                        files: [{
                            attachment: boardBuffer,
                            name: 'chess-board.png'
                        }],
                        components: rows
                    });
                }
                else if (interaction.customId.startsWith('move-')) {
                    const [_, fromSquare, toSquare] = interaction.customId.split('-');
                    
                    // Fazer o movimento do jogador
                    gameData.game.move({ from: fromSquare, to: toSquare });
                    const boardBuffer = await this.renderBoard(gameData.game);

                    await interaction.channel.send({
                        content: `Movimento realizado: ${fromSquare} → ${toSquare}`,
                        files: [{
                            attachment: boardBuffer,
                            name: 'chess-board.png'
                        }]
                    });

                    // Atualizar o estado antes do movimento da IA
                    this.gameState.set(interaction.channelId, gameData);

                    // IA faz seu movimento
                    const aiMove = await this.getBestMove(gameData.game, gameData.rating);
                    if (aiMove) {
                        gameData.game.move(aiMove);
                        const boardAfterAI = await this.renderBoard(gameData.game);
                        
                        await interaction.channel.send({
                            content: `🤖 IA moveu: ${aiMove.from} → ${aiMove.to}`,
                            files: [{
                                attachment: boardAfterAI,
                                name: 'chess-board.png'
                            }]
                        });

                        // Verificar todas as peças que podem se mover
                        const possiblePieces = this.getMovablePieces(gameData.game, gameData.color);
                        
                        if (possiblePieces.length > 0) {
                            const allButtonRows = this.createPieceButtons(possiblePieces);
                            
                            // Enviar múltiplas mensagens se necessário
                            for (let i = 0; i < allButtonRows.length; i++) {
                                await interaction.channel.send({
                                    components: allButtonRows[i]
                                });
                            }
                        } else {
                            if (gameData.game.isCheckmate()) {
                                await interaction.channel.send('♟️ Xeque-mate! A IA venceu!');
                            } else if (gameData.game.isDraw()) {
                                await interaction.channel.send('🤝 Empate!');
                            } else if (gameData.game.isStalemate()) {
                                await interaction.channel.send('🤝 Afogamento! Empate!');
                            }
                        }
                    }
                }
                else if (interaction.customId === 'cancel-move') {
                    const possiblePieces = this.getMovablePieces(gameData.game, gameData.color);
                    const allButtonRows = this.createPieceButtons(possiblePieces);
                    
                    // Enviar múltiplas mensagens se necessário
                    for (let i = 0; i < allButtonRows.length; i++) {
                        await interaction.channel.send({
                            components: allButtonRows[i]
                        });
                    }
                }
            }

            // Atualizar o estado do jogo
            this.gameState.set(interaction.channelId, gameData);

        } catch (error) {
            console.error('Chess interaction error:', error);
            try {
                if (!interaction.deferred) {
                    await interaction.deferUpdate();
                }
                await interaction.channel.send({
                    content: `❌ Erro: ${error.message}`,
                    ephemeral: true
                });
            } catch (e) {
                console.error('Error handling interaction error:', e);
            }
        }
    },

    // Obter todas as peças que podem se mover
    getMovablePieces(game, playerColor) {
        const pieces = [];
        const board = game.board();
        const color = playerColor === 'white' ? 'w' : 'b';

        // Mapear todas as peças e seus movimentos possíveis
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = board[i][j];
                if (piece && piece.color === color) {
                    const square = `${String.fromCharCode(97 + j)}${8 - i}`;
                    const moves = game.moves({ square: square, verbose: true });
                    if (moves.length > 0) {
                        pieces.push({
                            type: piece.type,
                            square: square,
                            moves: moves
                        });
                    }
                }
            }
        }

        // Ordenar peças por tipo e depois por posição
        const pieceOrder = { 'k': 1, 'q': 2, 'r': 3, 'b': 4, 'n': 5, 'p': 6 };
        pieces.sort((a, b) => {
            const orderDiff = pieceOrder[a.type.toLowerCase()] - pieceOrder[b.type.toLowerCase()];
            if (orderDiff === 0) {
                return a.square.localeCompare(b.square);
            }
            return orderDiff;
        });

        return pieces;
    },

    // Função para avaliar a posição do tabuleiro
    evaluateBoard(game) {
        const pieceValues = {
            'p': 1,   // Peão
            'n': 3,   // Cavalo
            'b': 3,   // Bispo
            'r': 5,   // Torre
            'q': 9,   // Rainha
            'k': 0    // Rei (valor baixo pois não queremos que a IA troque o rei)
        };

        let score = 0;
        const board = game.board();

        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const piece = board[i][j];
                if (piece) {
                    const value = pieceValues[piece.type.toLowerCase()];
                    if (piece.color === 'w') {
                        score += value;
                    } else {
                        score -= value;
                    }
                }
            }
        }

        return score;
    },

    // Inicializar Stockfish
    initStockfish() {
        if (!this.stockfish) {
            try {
                // Caminho direto para o arquivo stockfish.js
                const workerPath = path.join(__dirname, '..', '..', 'node_modules', 'stockfish', 'src', 'stockfish.js');
                this.stockfish = new Worker(workerPath);
                
                this.stockfish.on('message', (msg) => {
                    if (typeof msg === 'string' && msg.includes('bestmove')) {
                        const [, move] = msg.split('bestmove ');
                        if (move) {
                            this.stockfishMove = {
                                from: move.substring(0, 2),
                                to: move.substring(2, 4),
                                promotion: move.length > 4 ? move[4] : undefined
                            };
                        }
                    }
                });

                // Configuração inicial do Stockfish
                this.stockfish.postMessage('uci');
                this.stockfish.postMessage('isready');
                this.stockfish.postMessage('ucinewgame');
            } catch (error) {
                console.error('Error initializing Stockfish:', error);
                this.stockfish = null;
            }
        }
    },

    // Enviar comando para o Stockfish
    sendToStockfish(command) {
        if (this.stockfish) {
            try {
                this.stockfish.postMessage(command);
            } catch (error) {
                console.error('Error sending command to Stockfish:', error);
            }
        }
    },

    // Obter movimento do Stockfish
    async getBestMove(game, rating) {
        return new Promise((resolve) => {
            try {
                if (!this.stockfish) {
                    this.initStockfish();
                }

                if (!this.stockfish) {
                    throw new Error('Stockfish not initialized');
                }

                // Configurações baseadas no rating
                const elo = ELO_RATINGS[rating];
                const depth = Math.min(Math.floor(elo / 400), 5); // Reduzido para melhor performance
                const moveTime = Math.min(Math.floor(elo / 4), 500); // Tempo máximo em ms

                // Limpar movimento anterior
                this.stockfishMove = null;

                // Configurar engine
                this.stockfish.postMessage(`setoption name Skill Level value ${Math.floor((elo - 800) / 200)}`);
                this.stockfish.postMessage(`position fen ${game.fen()}`);
                this.stockfish.postMessage(`go depth ${depth} movetime ${moveTime}`);

                // Aguardar resposta com timeout reduzido
                const checkMove = setInterval(() => {
                    if (this.stockfishMove) {
                        clearInterval(checkMove);
                        clearTimeout(timeoutId);
                        resolve(this.stockfishMove);
                    }
                }, 50);

                // Timeout reduzido para 2 segundos
                const timeoutId = setTimeout(() => {
                    clearInterval(checkMove);
                    console.log('Using quick move calculation...');
                    
                    // Se timeout, usar movimento rápido
                    const moves = game.moves({ verbose: true });
                    resolve(moves[Math.floor(Math.random() * moves.length)]);
                }, 2000);

            } catch (error) {
                console.error('Stockfish error:', error);
                const moves = game.moves({ verbose: true });
                resolve(moves[Math.floor(Math.random() * moves.length)]);
            }
        });
    },

    // Limpar recursos do Stockfish quando necessário
    cleanup() {
        if (this.stockfish) {
            try {
                this.stockfish.terminate();
                this.stockfish = null;
            } catch (error) {
                console.error('Error cleaning up Stockfish:', error);
            }
        }
    }
}