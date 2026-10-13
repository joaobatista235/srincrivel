import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const git = (...args) =>
  execFileSync('git', args, {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });

const tracked = git('ls-files', '-z').split('\0').filter(Boolean);

const privateFile = file =>
  /(?:^|\/)usuarios\.json$/.test(file) ||
  (/^src\/(?:intros\/|assets\/avatars\/|engine\/)/.test(file) && file !== 'src/intros/.gitkeep') ||
  (/(?:^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example') ||
  /(?:^|\/)(?:node_modules|__pycache__|temp|coverage)\//.test(file) ||
  /\.(?:zip|pyc|pem|key|p12|pfx|sqlite\w*|db|log)$/i.test(file) ||
  /(?:^|\/)cookies[^/]*\.txt$/i.test(file);

let failed = false;

for (const file of tracked.filter(privateFile)) {
  console.error(`Arquivo privado ou gerado ainda rastreado pelo Git: ${file}`);
  failed = true;
}

const patterns = [
  /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{24,32}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{25,110}(?![A-Za-z0-9_-])/,
  /AIza[0-9A-Za-z_-]{35}/,
  /\bsk-(?:proj-|svcacct-)?[0-9A-Za-z_-]{20,200}/,
  /\b(?:gh[pousr]_[0-9A-Za-z]{30,255}|github_pat_[0-9A-Za-z_]{50,255})/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACM', '-z')
  .split('\0')
  .filter(Boolean);

for (const file of staged) {
  const contents = git('show', `:${file}`);

  if (patterns.some(pattern => pattern.test(contents))) {
    console.error(`Possível credencial no conteúdo staged de ${file}. Valor não exibido.`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
else
  console.log(
    'Arquivos rastreados e conteúdo staged: sem os dados privados ou padrões de credenciais verificados.',
  );
