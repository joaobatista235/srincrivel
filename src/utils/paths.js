import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Obtém o caminho do arquivo para o módulo chamador
 * @param {string} importMetaUrl - import.meta.url do módulo chamador
 * @returns {string} Caminho do arquivo
 */
export function getFilename(importMetaUrl) {
  return fileURLToPath(importMetaUrl);
}

/**
 * Obtém o diretório do módulo chamador
 * @param {string} importMetaUrl - import.meta.url do módulo chamador
 * @returns {string} Caminho do diretório
 */
export function getDirname(importMetaUrl) {
  const filename = getFilename(importMetaUrl);
  return path.dirname(filename);
}

/**
 * Resolve um caminho relativo ao diretório raiz do projeto
 * @param {...string} pathSegments - Segmentos de caminho para resolver
 * @returns {string} Caminho absoluto resolvido
 */
export function resolveProjectPath(...pathSegments) {
  const projectRoot = path.resolve(getDirname(import.meta.url), '..', '..');
  return path.resolve(projectRoot, ...pathSegments);
} 