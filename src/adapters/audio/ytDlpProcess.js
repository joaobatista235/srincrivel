import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);

const pluginDir = dirname(fileURLToPath(import.meta.resolve('@distube/yt-dlp')));

export const ytDlpPath = resolve(
  pluginDir,
  '..',
  'bin',
  process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp',
);

export async function extractMetadata(input, flags = {}, options = {}) {
  const argumentsList = [
    '--dump-single-json',
    '--skip-download',
    '--simulate',
    '--no-warnings',
    '--socket-timeout',
    '15',
    '--retries',
    '1',
    '--js-runtimes',
    `node:${process.execPath}`,
  ];

  for (const [name, value] of Object.entries(flags)) {
    const flag = '--' + name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());

    if (value === true) argumentsList.push(flag);
    else if (value !== false && value != null) argumentsList.push(flag, String(value));
  }

  argumentsList.push('--', input);
  const { stdout } = await execute(ytDlpPath, argumentsList, {
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });

  return JSON.parse(stdout);
}
