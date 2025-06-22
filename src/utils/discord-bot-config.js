import { GatewayIntentBits } from 'discord.js';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { YouTubePlugin } from '@distube/youtube';

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