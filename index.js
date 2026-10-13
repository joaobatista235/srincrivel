import DiscordBot from './src/entities/DiscordBot.js';
import { readConfig } from './src/config.js';

try {
  const bot = new DiscordBot(readConfig());
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
