import { getDirname } from './paths.js';
import { GatewayIntentBits } from 'discord.js';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { YouTubePlugin } from '@distube/youtube';

export const __dirname = getDirname(import.meta.url);

export const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
];

export const plugins = {
    plugins: [new YtDlpPlugin(), new YouTubePlugin()],
    emitNewSongOnly: true,
}

export const RATINGS = {
    beginner: 'Iniciante (ELO ~800)',
    intermediate: 'Intermediário (ELO ~1200)',
    advanced: 'Avançado (ELO ~1600)',
    expert: 'Expert (ELO ~2000+)',
};

export const STOCKFISH_ELO_LEVELS = {
    beginner: 800,
    intermediate: 1200,
    advanced: 1600,
    expert: 2200,
};

export const COLORS = {
    white: 'Brancas',
    black: 'Pretas',
};

export const PIECES = {
    k: 'black-king.png', q: 'black-queen.png', r: 'black-rook.png', b: 'black-bishop.png', n: 'black-knight.png', p: 'black-pawn.png',
    K: 'white-king.png', Q: 'white-queen.png', R: 'white-rook.png', B: 'white-bishop.png', N: 'white-knight.png', P: 'white-pawn.png'
};

export const PIECE_NAMES = {
    p: '♟️ Peão', n: '♞ Cavalo', b: '♝ Bispo', r: '♜ Torre', q: '♛ Rainha', k: '♚ Rei'
};