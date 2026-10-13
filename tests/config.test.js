import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { readEnvironment } from '../src/config/readEnvironment.js';
import { readIntroConfiguration } from '../src/config/readIntroConfiguration.js';
import { createBot } from '../src/bootstrap/createBot.js';

const env = { TOKEN: 'offline', GUILD_ID: '123456789012345678' };

test('intros ficam ligadas por padrão e aceitam valores booleanos documentados', () => {
  assert.equal(readEnvironment(env).introsEnabled, true);

  for (const value of ['true', '1', ' TRUE ']) {
    assert.equal(readEnvironment({ ...env, INTROS_ENABLED: value }).introsEnabled, true);
  }

  for (const value of ['false', '0', ' FALSE ']) {
    assert.equal(readEnvironment({ ...env, INTROS_ENABLED: value }).introsEnabled, false);
  }

  for (const value of ['', 'yes', '2', 'disabled']) {
    assert.throws(() => readEnvironment({ ...env, INTROS_ENABLED: value }), /INTROS_ENABLED/);
  }
});

test('intros desligadas não carregam cadastro nem montam listener de intros', () => {
  const bot = createBot(readEnvironment({ ...env, INTROS_ENABLED: 'false' }), {
    loadIntroConfiguration: () => {
      throw new Error('Cadastro inválido não deve ser lido');
    },
  });

  try {
    assert.equal(bot.voiceListener, null);
    assert.equal(bot.registry.commands.size, 9);
  } finally {
    bot.destroy();
  }
});

test('intros ligadas carregam o cadastro e montam o fluxo de eventos', () => {
  let loaded = 0;
  const bot = createBot(readEnvironment(env), {
    loadIntroConfiguration: () => {
      loaded++;
      return {};
    },
  });

  try {
    assert.equal(loaded, 1);
    assert.ok(bot.voiceListener);
  } finally {
    bot.destroy();
  }
});

test('cadastro rejeita JSON inválido, formatos errados e caminhos fora da pasta de áudio', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'srincrivel-config-'));
  t.after(() => {
    assert.equal(dirname(directory), tmpdir());
    return rm(directory, { recursive: true, force: true });
  });
  const file = join(directory, 'users-fixture.json');
  const invalid = [
    '{',
    'null',
    '[]',
    '"texto"',
    JSON.stringify({ invalid: { audio: 'intro.mp3' } }),
    JSON.stringify({ '123456789012345678': { audio: 1 } }),
    JSON.stringify({ '123456789012345678': { audio: '../outside.mp3' } }),
    JSON.stringify({ '123456789012345678': { audio: '..\\outside.mp3' } }),
  ];

  for (const contents of invalid) {
    await writeFile(file, contents);
    assert.throws(() => readIntroConfiguration(file), /usuarios.json/);
  }

  assert.throws(
    () => readIntroConfiguration(directory),
    error => error.code === 'EISDIR',
  );
});
