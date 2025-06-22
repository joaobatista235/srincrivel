import { Chess } from 'chess.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { __dirname, RATINGS, STOCKFISH_ELO_LEVELS, COLORS, PIECES, PIECE_NAMES } from '../utils/discord-bot-config.js';

class ChessHandler {
    constructor(stockfishHandler) {
        this.stockfishHandler = stockfishHandler;
        this.chess = null;
        this.playerColor = null;
        this.aiColor = null;
        this.rating = null;
        this.channelId = null;
        this.status = null;
        this.resigned = false;
    }

    startGame({ playerColor, rating, channelId }) {
        this.chess = new Chess();
        this.playerColor = playerColor;
        this.aiColor = playerColor === 'white' ? 'black' : 'white';
        this.rating = rating;
        this.channelId = channelId;
        this.status = null;
        this.resigned = false;
    }

    getGameState() {
        return {
            fen: this.chess.fen(),
            turn: this.chess.turn(),
            playerColor: this.playerColor,
            aiColor: this.aiColor,
            status: this.getGameStatus(),
            resigned: this.resigned,
            moves: this.chess.history({ verbose: true }),
            board: this.chess.board(),
        };
    }

    isPlayerTurn() {
        return this.chess.turn() === this.playerColor[0];
    }

    movePiece(from, to, promotion) {
        if (this.resigned) return false;
        const move = this.chess.move({ from, to, promotion });
        if (!move) return false;
        this.status = this.getGameStatus();
        return move;
    }

    async aiMove() {
        if (this.resigned) return null;
        await this.stockfishHandler.initWorker(this.channelId);
        const fen = this.chess.fen();
        const elo = STOCKFISH_ELO_LEVELS[this.rating];
        const bestMove = await this.stockfishHandler.getBestMove(fen, elo, this.channelId);
        if (!bestMove || bestMove === '(none)') {
            this.status = 'draw';
            return null;
        }
        const move = this.chess.move(bestMove, { sloppy: true });
        this.status = this.getGameStatus();
        return move;
    }

    resign() {
        this.resigned = true;
        this.status = 'resigned';
    }

    getMovablePieces(color) {
        const colorChar = color[0];
        if (this.chess.turn() !== colorChar) return [];
        const pieces = [];
        this.chess.board().flat().forEach(piece => {
            if (piece && piece.color === colorChar) {
                const moves = this.chess.moves({ square: piece.square, verbose: true });
                if (moves.length > 0) {
                    pieces.push({ type: piece.type, square: piece.square });
                }
            }
        });
        return pieces;
    }

    getMovesForPiece(square) {
        return this.chess.moves({ square, verbose: true });
    }

    getGameStatus() {
        if (this.resigned) return 'resigned';
        if (this.chess.isCheckmate()) return 'checkmate';
        if (this.chess.isDraw()) return 'draw';
        if (this.chess.isStalemate()) return 'stalemate';
        if (this.chess.isThreefoldRepetition()) return 'threefold';
        if (this.chess.inCheck()) return 'check';
        return 'playing';
    }

    cleanup() {
        if (this.channelId) {
            this.stockfishHandler.terminateWorker(this.channelId);
        }
    }

    async renderBoard(game, highlightSquares = []) {
        const canvas = createCanvas(400, 400);
        const ctx = canvas.getContext('2d');
        const squareSize = 50;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const square = `${String.fromCharCode(97 + j)}${8 - i}`;
                ctx.fillStyle = (i + j) % 2 === 0 ? '#f0d9b5' : '#b58863';
                if (highlightSquares.includes(square)) {
                    ctx.globalAlpha = 0.7;
                    ctx.fillStyle = '#86a666';
                }
                ctx.fillRect(j * squareSize, i * squareSize, squareSize, squareSize);
                ctx.globalAlpha = 1.0;
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
            console.error('Erro ao carregar imagens das peças. Verifique o caminho dos assets.', error);
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Arial';
        for (let i = 0; i < 8; i++) {
            ctx.fillStyle = (i % 2 === 0) ? '#f0d9b5' : '#b58863';
            ctx.fillText(String.fromCharCode(97 + i), i * squareSize + 3, 397);
            ctx.fillStyle = (i % 2 !== 0) ? '#f0d9b5' : '#b58863';
            ctx.fillText(8 - i, 2, i * squareSize + 12);
        }
        return canvas.toBuffer();
    }

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
        if (rows.length < 5) {
            const lastRow = rows[rows.length - 1];
            if (lastRow && lastRow.components.length < 5) {
                lastRow.addComponents(new ButtonBuilder().setCustomId('resign').setLabel('🏳️ Desistir').setStyle(ButtonStyle.Danger));
            } else {
                rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('resign').setLabel('🏳️ Desistir').setStyle(ButtonStyle.Danger)));
            }
        }
        return rows.slice(0, 5);
    }

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
        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('cancel-move').setLabel('↩️ Cancelar').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('resign').setLabel('🏳️ Desistir').setStyle(ButtonStyle.Danger)
        );
        rows.push(controlRow);
        return rows.slice(0, 5);
    }
}

export { RATINGS, COLORS, PIECE_NAMES };
export default ChessHandler;
