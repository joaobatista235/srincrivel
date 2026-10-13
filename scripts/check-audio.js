import { generateDependencyReport } from '@discordjs/voice';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
import { ytDlpPath } from '../src/adapters/audio/ytDlpProcess.js';

console.log(generateDependencyReport());

const require = createRequire(import.meta.url);

try {
  const OpusScript = require('opusscript');

  const encoder = new OpusScript(48_000, 2, OpusScript.Application.AUDIO);
  const packet = encoder.encode(Buffer.alloc(960 * 2 * 2), 960);

  if (!packet.length) throw new Error('Encoder Opus não produziu áudio.');

  encoder.delete();
  console.log('Encoder Opus: OK.');
} catch (error) {
  console.error('Encoder Opus:', error.message);
  process.exitCode = 1;
}

for (const [name, binary, args] of [
  ['FFmpeg', ffmpeg, ['-version']],
  ['yt-dlp', ytDlpPath, ['--version']],
]) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 15_000 });

  if (result.status !== 0) {
    console.error(`${name} indisponível:`, result.error?.message || result.stderr);
    process.exitCode = 1;
  } else console.log(`${name}: ${result.stdout.split('\n')[0]}`);
}
