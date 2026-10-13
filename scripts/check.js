import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(entry =>
      entry.isDirectory() ? filesIn(join(directory, entry.name)) : [join(directory, entry.name)],
    ),
  );

  return files.flat().filter(file => file.endsWith('.js'));
}

const files = [
  'index.js',
  ...(await filesIn('src')),
  ...(await filesIn('scripts')),
  ...(await filesIn('tests')),
];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });

  if (result.status !== 0) {
    console.error(result.stderr || result.error);
    process.exitCode = 1;
  }
}

if (!process.exitCode)
  console.log(`Sintaxe válida em ${files.length} arquivos no Node ${process.versions.node}.`);
