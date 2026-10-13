import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import CommandHandler from '../src/controllers/CommandHandler.js';
import { UserError } from '../src/utils/errors.js';
import { rollDice } from '../src/commands/roll.js';
import { readConfig, readIntroUsers } from '../src/config.js';
import DiscordBot from '../src/entities/DiscordBot.js';

function interaction(name, button = false) {
  const calls = [];
  return {
    commandName: name, customId: name, calls, deferred: false,
    isButton: () => button, isChatInputCommand: () => !button, inGuild: () => true,
    options: { getString: () => '2d6' },
    user: { username: 'Jogador', displayAvatarURL: () => 'https://cdn.discordapp.com/test.png' },
    async deferReply(options) { calls.push(['deferReply', options]); this.deferred = true; },
    async deferUpdate() { calls.push(['deferUpdate']); this.deferred = true; },
    async editReply(payload) { calls.push(['editReply', payload]); },
    async followUp(payload) { calls.push(['followUp', payload]); },
    async reply(payload) { calls.push(['reply', payload]); },
  };
}

async function handler(music = {}) {
  const result = new CommandHandler({}, { music });
  await result.loadCommands();
  return result;
}

test('a inicialização offline carrega apenas os 9 comandos ativos e encerra sem conexões', async () => {
  const bot = new DiscordBot({ token: 'offline', guildId: '123456789012345678' });
  try {
    await bot.commandHandler.loadCommands();
    assert.equal(bot.commandHandler.commands.size, 9);
    assert.equal(bot.commandHandler.commands.has('chat'), false);
    assert.equal(bot.commandHandler.commands.has('ouvir'), false);
    assert.equal(bot.commandHandler.commands.has('guiham'), false);
    for (const command of bot.commandHandler.commands.values()) command.data.toJSON();
  } finally { bot.destroy(); }
});

for (const name of ['pause', 'resume', 'autoplay', 'previous', 'skip', 'stop']) {
  test(`/${name} reconhece a interação antes de executar a ação e responde como slash command`, async () => {
    const event = interaction(name);
    const router = await handler({ control: async (_event, action) => {
      assert.equal(event.calls[0][0], 'deferReply');
      return { content: action };
    } });
    await router.handleInteraction(event);
    assert.deepEqual(event.calls.map(call => call[0]), ['deferReply', 'editReply']);
    assert.equal(event.calls[0][1].flags, MessageFlags.Ephemeral);
  });
}

test('um botão reconhece sua mensagem sem usar deferReply', async () => {
  const router = await handler({ control: async () => ({ content: 'Pausada' }) });
  const event = interaction('pause', true);
  await router.handleInteraction(event);
  assert.deepEqual(event.calls.map(call => call[0]), ['deferUpdate']);
});

test('erro de autorização em botão usa followUp efêmero e preserva a mensagem da música', async () => {
  const router = await handler({ control: async () => { throw new UserError('Mesmo canal'); } });
  const event = interaction('stop', true);
  await router.handleInteraction(event);
  assert.deepEqual(event.calls.map(call => call[0]), ['deferUpdate', 'followUp']);
  assert.equal(event.calls[1][1].flags, MessageFlags.Ephemeral);
});

test('controle removido recebe uma resposta sem executar comandos arbitrários', async () => {
  const event = interaction('ouvir', true);
  await (await handler()).handleInteraction(event);
  assert.equal(event.calls[0][0], 'reply');
});

test('comandos não são executados em mensagens diretas', async () => {
  const event = interaction('pause');
  event.inGuild = () => false;
  await (await handler()).handleInteraction(event);
  assert.equal(event.calls[0][0], 'reply');
});

test('a rolagem permanece pública e cabe nos limites do embed', async () => {
  const event = interaction('roll');
  event.options.getString = () => '100d1000000';
  await (await handler()).handleInteraction(event);
  assert.deepEqual(event.calls[0], ['deferReply', {}]);
  const embed = event.calls[1][1].embeds[0].toJSON();
  assert.ok(embed.fields[0].value.length <= 1024);
});

test('dados rejeitam limites inválidos e números que estourariam o encoder', () => {
  for (const value of ['0d6', '101d6', '1d0', '1d1000001', '1dInfinity', '2D6', '2d6 lixo']) {
    assert.throws(() => rollDice(value), UserError);
  }
  assert.deepEqual(rollDice('3d1').results, [1, 1, 1]);
  const result = rollDice('100d6');
  assert.ok(result.results.every(value => value >= 1 && value <= 6));
});

test('configuração valida TOKEN e GUILD_ID sem expor o token', () => {
  assert.throws(() => readConfig({}), /TOKEN/);
  assert.throws(() => readConfig({ TOKEN: 'secret', GUILD_ID: 'invalid' }), /GUILD_ID/);
  assert.equal(readConfig({ TOKEN: 'secret', GUILD_ID: '123456789012345678' }).token, 'secret');
});

test('o bot pode iniciar sem cadastro pessoal de intros', () => {
  assert.deepEqual(readIntroUsers(new URL('./arquivo-inexistente.json', import.meta.url)), {});
});

test('o exemplo anônimo de configuração das intros é válido', () => {
  const users = readIntroUsers(new URL('../src/utils/usuarios.example.json', import.meta.url));
  assert.equal(Object.keys(users).length, 1);
});

test('um áudio vazio desativa a intro do usuário sem impedir a inicialização', () => {
  const users = readIntroUsers(new URL('./fixtures/disabled-intro.json', import.meta.url));
  assert.equal(users['123456789012345678'].audio, '');
});
