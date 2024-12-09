import Discord from 'discord.js';
import { DisTube } from 'distube';

const client = new Discord.Client({ intents: [1, 512, 32768, 2, 128, 'GuildVoiceStates'] });
client.distube = new DisTube(client, { emitNewSongOnly: true, emitAddSongWhenCreatingQueue: false });

export default client;
