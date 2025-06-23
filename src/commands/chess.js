import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } from "discord.js";
import ChessHandler, { RATINGS, COLORS, PIECE_NAMES } from '../controllers/ChessHandler.js';
import StockfishHandler from '../controllers/StockfishHandler.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { getDirname } from '../utils/paths.js';

const __dirname = getDirname(import.meta.url);

const games = new Map();
const stockfishHandler = new StockfishHandler();

export default {
    data: new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Cria um jogo de xadrez contra a IA'),

    async execute(interaction) {
        try {
            // Cria uma thread para manter o jogo organizado
            const thread = await interaction.channel.threads.create({
                name: `Xadrez-${interaction.user.username}`,
                autoArchiveDuration: 60,
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

            await thread.send({
                content: `Olá, ${interaction.user.username}! Configure sua partida de xadrez:`,
                components: [row1, row2]
            });

            await interaction.reply({
                content: `Jogo de xadrez criado na thread: ${thread.toString()}`,
                ephemeral: true
            });
        } catch (error) {
            await interaction.reply({
                content: 'Houve um erro ao tentar criar o jogo de xadrez.',
                ephemeral: true
            });
        }
    },

    // Handler para menus e botões
    async handleInteraction(interaction) {
        const channelId = interaction.channelId;
        let game = games.get(channelId);

        // Configuração inicial
        if (interaction.isStringSelectMenu()) {
            await interaction.deferUpdate();
            if (!game) {
                game = new ChessHandler(stockfishHandler);
                games.set(channelId, game);
            }
            if (interaction.customId === 'rating-select') game.rating = interaction.values[0];
            if (interaction.customId === 'color-select') game.playerColor = interaction.values[0];
            if (game.rating && game.playerColor) {
                game.startGame({ playerColor: game.playerColor, rating: game.rating, channelId });
                await interaction.channel.bulkDelete(1);
                const updateData = await getUpdateData(game);
                const gameMessage = await interaction.channel.send(updateData);
                game.gameMessageId = gameMessage.id;
                if (!game.isPlayerTurn()) {
                    await performAIMove(game, interaction.channel);
                }
            }
            return;
        }

        // Durante o jogo
        if (interaction.isButton()) {
            if (!game || !game.gameMessageId) {
                return interaction.reply({ content: 'Este jogo não está mais ativo.', ephemeral: true });
            }
            await interaction.deferUpdate();
            const gameMessage = await interaction.channel.messages.fetch(game.gameMessageId);
            if (interaction.customId === 'resign') {
                game.resign();
                await endGame(game, interaction.channel, gameMessage, `${interaction.user.username} desistiu. ${game.playerColor === 'white' ? 'As Pretas' : 'As Brancas'} venceram!`);
                games.delete(channelId);
                return;
            }
            if (interaction.customId === 'cancel-move') {
                const updateData = await getUpdateData(game);
                await gameMessage.edit(updateData);
                return;
            }
            if (interaction.customId.startsWith('piece-')) {
                const selectedSquare = interaction.customId.split('-')[1];
                const moves = game.getMovesForPiece(selectedSquare);
                const highlightSquares = [selectedSquare, ...moves.map(m => m.to)];
                const boardBuffer = await renderBoard(game, highlightSquares);
                const components = createMoveButtons(selectedSquare, moves);
                await gameMessage.edit({
                    files: [{ attachment: boardBuffer, name: 'chess-board.png' }],
                    components: components
                });
            }
            if (interaction.customId.startsWith('move-')) {
                const [_, from, to] = interaction.customId.split('-');
                let promotion;
                const piece = game.chess.get(from);
                if (piece.type === 'p' && ((piece.color === 'w' && from[1] === '7' && to[1] === '8') || (piece.color === 'b' && from[1] === '2' && to[1] === '1'))) {
                    promotion = 'q';
                }
                const move = game.movePiece(from, to, promotion);
                if (!move) {
                    const updateData = await getUpdateData(game);
                    await gameMessage.edit(updateData);
                    await interaction.followUp({ content: "Movimento inválido!", ephemeral: true });
                    return;
                }

                if (game.getGameStatus() !== 'playing' && game.getGameStatus() !== 'check') {
                    await endGame(game, interaction.channel, gameMessage, getStatusText(game));
                    games.delete(channelId);
                    return;
                }
                const updateData = await getUpdateData(game, "🤖 IA está pensando...");
                await gameMessage.edit(updateData);
                await performAIMove(game, interaction.channel);
            }
        }
    }
};

// Funções utilitárias para o comando (Discord only)
function createPieceButtons(game) {
    const pieces = game.getMovablePieces(game.playerColor);
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

function createMoveButtons(selectedPiece, moves) {
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

async function getUpdateData(game, customStatus = null) {
    const turn = game.chess.turn() === 'w' ? 'Brancas' : 'Pretas';
    let statusText = customStatus || `Vez das ${turn}`;
    if (game.chess.inCheck()) {
        statusText += ' (Xeque!)';
    }
    const boardBuffer = await renderBoard(game);
    const isPlayerTurn = game.isPlayerTurn();
    let components = [];
    if (isPlayerTurn && !customStatus) {
        components = createPieceButtons(game);
    } else {
        components = [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('resign').setLabel('🏳️ Desistir').setStyle(ButtonStyle.Danger)
        )];
    }
    const embed = new EmbedBuilder()
        .setColor(isPlayerTurn && !customStatus ? '#3BA55D' : '#F04747')
        .setTitle('Partida de Xadrez vs. IA')
        .addFields(
            { name: '🎨 Cor', value: COLORS[game.playerColor], inline: true },
            { name: '🤖 Nível da IA', value: RATINGS[game.rating], inline: true },
            { name: '⚖️ Status', value: statusText }
        )
        .setImage('attachment://chess-board.png')
        .setTimestamp();

    const personality = game.getCurrentPersonality();
    if (personality) {
        embed.setAuthor({
            name: personality.name,
            iconURL: `attachment://${personality.avatar}`
        });
    }

    return {
        content: '', embeds: [embed], files: [
            { attachment: boardBuffer, name: 'chess-board.png' },
            ...(personality ? [{ attachment: path.join(__dirname, '..', 'assets', 'avatars', personality.avatar), name: personality.avatar }] : [])
        ], components
    };
}

async function renderBoard(game, highlightSquares = []) {
    const canvas = createCanvas(400, 400);
    const ctx = canvas.getContext('2d');
    const squareSize = 50;
    highlightSquares = highlightSquares || [];
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
        const board = game.chess.board();
        const PIECES = {
            'k': 'black-king.png', 'q': 'black-queen.png', 'r': 'black-rook.png', 'b': 'black-bishop.png', 'n': 'black-knight.png', 'p': 'black-pawn.png',
            'K': 'white-king.png', 'Q': 'white-queen.png', 'R': 'white-rook.png', 'B': 'white-bishop.png', 'N': 'white-knight.png', 'P': 'white-pawn.png'
        };
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
        // Se der erro, só ignora
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

async function performAIMove(game, channel) {
    const move = await game.aiMove();
    if (!move) {
        const gameMessage = await channel.messages.fetch(game.gameMessageId);
        await endGame(game, channel, gameMessage, 'A IA não encontrou um movimento. Jogo empatado.');
        games.delete(channel.id);
        return;
    }

    if (game.getGameStatus() === 'check') {
        await interaction.channel.send(`**Check!**`);
    } else if (game.getGameStatus() !== 'playing' && game.getGameStatus() !== 'check') {
        const gameMessage = await channel.messages.fetch(game.gameMessageId);
        await endGame(game, channel, gameMessage, getStatusText(game));
        games.delete(channel.id);
        return;
    }

    const gameMessage = await channel.messages.fetch(game.gameMessageId);
    const updateData = await getUpdateData(game);
    await gameMessage.edit(updateData);
    const personality = game.getCurrentPersonality();

    if (personality && Array.isArray(personality.messages) && personality.messages.length > 0) {
        if (!game._lastMessageIndex) game._lastMessageIndex = -1;
        let messageIndex;
        do {
            messageIndex = Math.floor(Math.random() * personality.messages.length);
        } while (messageIndex === game._lastMessageIndex && personality.messages.length > 1);
        game._lastMessageIndex = messageIndex;
        const message = personality.messages[messageIndex];
        const combinedMessage = `**${personality.name}**: ${message}\n**Jogada da IA:** ${move.san}`;

        try {
            if (game.lastPersonalityMessageId) {
                const previousMessage = await channel.messages.fetch(game.lastPersonalityMessageId);
                await previousMessage.edit(combinedMessage);
            } else {
                const newMessage = await channel.send(combinedMessage);
                game.lastPersonalityMessageId = newMessage.id;
            }
        } catch (error) {
            console.error("Erro ao editar ou enviar mensagem da personalidade:", error);
            const fallback = await channel.send(combinedMessage);
            game.lastPersonalityMessageId = fallback.id;
        }
    } else {
        const moveMsg = `**Jogada da IA:** ${move.san}`;
        try {
            if (game.lastPersonalityMessageId) {
                const previousMessage = await channel.messages.fetch(game.lastPersonalityMessageId);
                await previousMessage.edit(moveMsg);
            } else {
                const fallback = await channel.send(moveMsg);
                game.lastPersonalityMessageId = fallback.id;
            }
        } catch (error) {
            console.error("Erro ao editar ou enviar mensagem da IA:", error);
        }
    }
}

async function endGame(game, _channel, gameMessage, statusText) {
    const boardBuffer = await renderBoard(game);
    const embed = EmbedBuilder.from(gameMessage.embeds[0]);
    embed.setColor('#4f545c');
    embed.data.fields.find(f => f.name === '⚖️ Status').value = `**FIM DE JOGO**\n${statusText}`;
    await gameMessage.edit({
        embeds: [embed],
        files: [{ attachment: boardBuffer, name: 'chess-board.png' }],
        components: []
    });
    game.cleanup();
}

function getStatusText(game) {
    switch (game.getGameStatus()) {
        case 'checkmate':
            return `♟️ Xeque-mate! ${game.chess.turn() === 'w' ? 'As Pretas' : 'As Brancas'} venceram!`;
        case 'draw':
            return '🤝 Empate por insuficiência de material ou regra dos 50 lances!';
        case 'stalemate':
            return '🤝 Empate por Afogamento!';
        case 'threefold':
            return '🤝 Empate por repetição!';
        case 'resigned':
            return 'Jogador desistiu!';
        default:
            return 'Jogo encerrado.';
    }
}