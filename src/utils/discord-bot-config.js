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
    plugins: [new YouTubePlugin(), new YtDlpPlugin()],
    emitNewSongOnly: true,
    savePreviousSongs: true, // Salvar músicas anteriores para comando previous
    nsfw: false, // Desabilitar conteúdo NSFW
    emitAddSongWhenCreatingQueue: false, // Evitar eventos duplicados
    emitAddListWhenCreatingQueue: false, // Evitar eventos duplicados
}

export const RATINGS = {
    beginner: 'Iniciante (ELO ~800)',
    intermediate: 'Intermediário (ELO ~1200)',
    advanced: 'Avançado (ELO ~1600)',
    expert: 'Expert (ELO ~2000+)',
    srincrivel: 'Sr Incrivel – Final BOSS',
    guiham: 'Guilherme HAM',
    igor: 'Igor Vinier',
    lucas: 'Lucas Potter'
};

export const STOCKFISH_ELO_LEVELS = {
    beginner: 800,
    intermediate: 1200,
    advanced: 1600,
    expert: 2200,
    srincrivel: 3000,
    guiham: 1100,
    igor: 1000,
    lucas: 1500
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

export const PERSONALITIES = {
    srincrivel: {
        name: 'Sr Incrível',
        avatar: 'srincrivel.webp',
        messages: [
            'Sério que essa foi sua jogada?',
            'Já vi crianças jogando melhor...',
            'Você tem certeza que sabe jogar xadrez?',
            'Interessante… de um jeito completamente errado.',
            'Já posso comemorar ou vai tentar algo decente?',
            'Essa jogada foi... corajosa. Ruim, mas corajosa.',
            'Você está tentando me distrair com esses erros?',
            'Ah, entendi. Você está me dando vantagem de propósito, né?',
            'Nem o computador entendeu o que você tentou fazer aí.',
            'Você tem um plano ou só tá empurrando peças?',
            'Isso foi um blefe? Porque não funcionou.',
            'Uau... isso foi criativo. Péssimo, mas criativo.',
            'Você acabou de inventar uma nova forma de perder.',
            'Se eu fechar os olhos, ainda ganho essa.',
            'Eu esperava mais de você... na verdade, nem tanto.'
        ]
    },
    guiham: {
        name: 'Guilherme HAM',
        avatar: 'guiham.png',
        messages: [
            'Cavalo no canto só traz desencanto.',
            'Roque não pode ser mal jamais!',
            'Essa jogada tá errada até no multiverso.',
            'Peão dobrado é alma penada.',
            'Jogou sem rocar? Já pode chorar.',
            'Essa sua abertura é mais aberta que portão de sítio.',
            'Tá jogando gambito da ignorância!',
            'Rei no centro? Isso é cheque moral.',
            'Equatrino... o favorito de Bobby Fischer!',
            'A bomba vai estourar, meu parceiro!'
        ]
    },
    igor: {
        name: 'Igor Vinier',
        avatar: 'igor.png',
        messages: [
            'Essa jogada? Eu já vi pior... em raio-X.',
            'Confia em mim, sou "quase" especialista.',
            'Você precisa de um diagnóstico urgente: falta de noção estratégica.',
            'Com esse nível, te receito paciência... e um milagre.',
            'Relaxa, já perdi pacientes em situação pior... digo, partidas!',
            'Essa jogada foi tão ruim que até meu estetoscópio desmaiou.',
            'Cuidado! Isso parece um caso grave de "cegueira tática".',
            'Você jogando assim, eu prescrevo: desistência em 3 lances.',
            'Isso foi xadrez ou uma cirurgia mal feita?',
            'Ah, sim... técnica avançada da escola paraguaia de xadrez duvidoso.',
            'Se isso fosse um transplante, o rei já estaria no necrotério.'
        ]
    },
    lucas: {
        name: 'Lucas Potter',
        avatar: 'lucas.png',
        messages: [
            'Você não sabe o que é crescer sozinho, sendo ignorado por todos...',
            'A dor de ser rejeitado me ensinou a nunca desistir de ninguém!',
            'Mesmo que me odeiem, eu vou proteger todos com o que eu tenho!',
            'Eu era um fracassado... mas nunca deixei de tentar!',
            'Meu nome é Naruto Uzumaki... e eu nunca volto atrás com minha palavra!',
            'Eu sei o que é sofrer... por isso luto com todo o meu coração.',
            'Ninjas de verdade nunca desistem... mesmo quando tudo parece perdido!',
            'A solidão me ensinou o valor de lutar pelos outros!',
            'Se você acha que pode me vencer só com estratégia... é porque nunca lutou com o coração!',
            'Eu não corro mais... não fujo mais... esse é o meu jeito ninja de ser!',
            'Mesmo que eu esteja machucado, mesmo que tudo pareça impossível... eu vou continuar em frente!',
            'Você pode ter técnica, mas eu tenho determinação!',
            'Eu prometi que nunca mais veria alguém sofrer o que eu sofri!',
            'Se eu cair mil vezes, vou me levantar mil e uma — é isso que faz de mim um ninja!',
            'A força de um ninja vem de como ele protege os outros, não só de vencer.'
        ]
    }
}