import { Client, GatewayIntentBits } from 'discord.js';
import { DisTube, Song } from 'distube';
import YtDlpExtractor from '../src/adapters/audio/YtDlpExtractor.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const plugin = new YtDlpExtractor();
const distube = new DisTube(client, { plugins: [plugin] });

try {
  const input = process.argv.slice(2).join(' ') || 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  const result = await distube.handler.resolve(input);
  const first = result.songs?.[0] ?? result;
  if (!first) throw new Error('Nenhuma música encontrada.');
  if (!plugin.validate(input) && !(result instanceof Song))
    throw new Error('Uma busca deve retornar apenas uma música.');
  const stream = await plugin.getStreamURL(first);
  if (!['http:', 'https:'].includes(new URL(stream).protocol))
    throw new Error('URL de áudio inválida.');
  console.log(
    'Metadados e URL de áudio: OK (' +
      first.name +
      '). Nenhum áudio baixado; sem login no Discord.',
  );
} catch (error) {
  console.error('Falha na extração:', error.message);
  process.exitCode = 1;
} finally {
  client.destroy();
}
