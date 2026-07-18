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
    savePreviousSongs: true,
    nsfw: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
}
