import { Client, GatewayIntentBits } from 'discord.js';
import { DisTube, Queue } from 'distube';
import YtDlpExtractor from '../src/adapters/audio/YtDlpExtractor.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const plugin = new YtDlpExtractor();
const distube = new DisTube(client, { plugins: [plugin], savePreviousSongs: true });

try {
  const input = process.argv.slice(2).join(' ') || 'bad omens';
  const result = await distube.handler.resolve(input);
  const first = result.songs?.[0] ?? result;
  const queue = new Queue(distube, {
    id: '123456789012345678',
    stop() {},
    channel: { guild: { members: {} } },
  });
  queue.songs.push(first);
  queue.autoplay = true;
  const played = new Set([first.id]);
  console.log('Inicial: ' + first.name);
  for (let i = 0; i < 6; i++) {
    await queue.skip();
    const current = queue.songs[0];
    if (played.has(current.id)) throw new Error('O autoplay repetiu um vídeo.');
    played.add(current.id);
    console.log('Sugestão ' + (i + 1) + ': ' + current.name);
  }
  console.log(
    'Autoplay: seis avanços distintos na fila offline. Sem login, download de mídia ou transmissão de voz.',
  );
} catch (error) {
  console.error('Falha na verificação de autoplay:', error.message);
  process.exitCode = 1;
} finally {
  client.destroy();
}
