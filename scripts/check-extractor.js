import YtDlpExtractor from '../src/adapters/audio/YtDlpExtractor.js';

const plugin = new YtDlpExtractor();

try {
  const song = await plugin.resolve(
    process.argv[2] || 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  );
  const first = song.songs?.[0] ?? song;
  const stream = await plugin.getStreamURL(first);

  if (!['http:', 'https:'].includes(new URL(stream).protocol))
    throw new Error('URL de áudio inválida.');

  console.log(`Metadados e URL de áudio: OK (${first.name}). Nenhum áudio baixado.`);
} catch (error) {
  console.error('Falha na extração:', error.message);
  process.exitCode = 1;
}
