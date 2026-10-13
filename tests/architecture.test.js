import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import CommandRegistry from '../src/adapters/discord/CommandRegistry.js';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(entry =>
      entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
    ),
  );

  return nested.flat().filter(file => file.endsWith('.js'));
}

test('aplicação depende somente da própria camada e de módulos nativos', async () => {
  const root = fileURLToPath(new URL('../src/application', import.meta.url));

  for (const file of await files(root)) {
    const source = await readFile(file, 'utf8');

    for (const match of source.matchAll(/(?:from\s*|import\s*\()['"]([^'"]+)['"]/g)) {
      const specifier = match[1];

      assert.ok(
        specifier.startsWith('node:') || specifier.startsWith('.'),
        file + ': ' + specifier,
      );
      assert.doesNotMatch(specifier, /adapters|bootstrap|config/);

      if (specifier.startsWith('.'))
        assert.ok(resolve(dirname(file), specifier).startsWith(root + sep));
    }

    assert.doesNotMatch(source, /interaction\.|\bEmbedBuilder\b|\bDisTube\b|readFileSync/);
  }
});

test('registro explícito rejeita definições inválidas e duplicadas', () => {
  const registry = new CommandRegistry();
  const command = registry.get('play');

  assert.throws(() => new CommandRegistry([command, command]), /duplicado/);
  assert.throws(() => new CommandRegistry([{}]), /inválido/);
  assert.equal(registry.commands.size, 9);
});
