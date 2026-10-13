import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createBot } from '../src/bootstrap/createBot.js';

test('variável de intros fornecida na inicialização tem precedência sobre o arquivo de ambiente', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'srincrivel-startup-'));
  t.after(() => {
    assert.equal(dirname(directory), tmpdir());
    return rm(directory, { recursive: true, force: true });
  });
  const fixture = join(directory, 'startup.env');
  await writeFile(fixture, 'TOKEN=offline\nGUILD_ID=123456789012345678\nINTROS_ENABLED=true\n');
  const script =
    "import { readEnvironment } from './src/config/readEnvironment.js'; console.log(readEnvironment().introsEnabled);";
  const result = spawnSync(
    process.execPath,
    ['--env-file=' + fixture, '--input-type=module', '-e', script],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      env: {
        ...process.env,
        TOKEN: 'offline',
        GUILD_ID: '123456789012345678',
        INTROS_ENABLED: 'false',
      },
      timeout: 10_000,
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'false');
});

test('sair continua disponível quando o bot foi montado sem intros', async () => {
  const bot = createBot({ token: 'offline', guildId: '123456789012345678', introsEnabled: false });

  try {
    const result = await bot.router.dependencies.music.leave({
      guildId: '123456789012345678',
      voiceChannelId: 'voice',
    });
    assert.deepEqual(result, { code: 'LEFT' });
  } finally {
    bot.destroy();
  }
});
