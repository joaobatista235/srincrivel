import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const SNOWFLAKE = /^\d{17,20}$/;

export function readIntroConfiguration(file = new URL('../utils/usuarios.json', import.meta.url)) {
  let contents;

  try {
    contents = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};

    throw error;
  }

  let users;

  try {
    users = JSON.parse(contents);
  } catch {
    throw new Error('usuarios.json deve conter JSON válido.');
  }

  if (!users || typeof users !== 'object' || Array.isArray(users)) {
    throw new Error('usuarios.json deve associar IDs de usuário a arquivos de áudio.');
  }

  for (const [id, user] of Object.entries(users)) {
    if (
      !SNOWFLAKE.test(id) ||
      typeof user?.audio !== 'string' ||
      user.audio.includes('/') ||
      user.audio.includes('\\') ||
      basename(user.audio) !== user.audio
    ) {
      throw new Error(
        'usuarios.json contém uma entrada inválida. Use um ID Discord e um nome de arquivo.',
      );
    }
  }

  return users;
}
