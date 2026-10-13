import { createBot } from './src/bootstrap/createBot.js';
import { readEnvironment } from './src/config/readEnvironment.js';

try {
  const bot = createBot(readEnvironment());
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      bot.destroy();
      process.exitCode = 0;
    });
  }
  await bot.initialize();
} catch (error) {
  console.error('Não foi possível iniciar o bot:', error.message);
  process.exitCode = 1;
}
