import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { Events } from 'discord.js';
import DiscordBot from '../src/adapters/discord/DiscordBot.js';
import CommandRegistry from '../src/adapters/discord/CommandRegistry.js';

function setup(voice = true) {
  const calls = [];
  const client = new EventEmitter();
  client.user = { tag: 'Offline' };
  client.login = async token => calls.push(['login', token]);
  client.destroy = () => calls.push(['destroy']);
  const registry = {
    register: async (registeredClient, guildId) =>
      calls.push(['register', registeredClient, guildId]),
  };
  const router = {
    handleInteraction: async interaction => calls.push(['interaction', interaction]),
  };
  const voiceListener = voice
    ? { handle: async (...states) => calls.push(['voice', ...states]) }
    : null;
  const bot = new DiscordBot({
    client,
    config: { token: 'offline', guildId: 'guild' },
    registry,
    router,
    voiceListener,
    shutdown: () => calls.push(['shutdown']),
  });

  return { bot, client, registry, router, calls };
}

test('login conecta roteamento, voz e registro após Ready, e destroy remove listeners uma vez', async t => {
  t.mock.method(console, 'log', () => {});
  const { bot, client, calls } = setup();
  await bot.initialize();
  client.emit(Events.ClientReady, client);
  client.emit(Events.InteractionCreate, { id: 'interaction' });
  client.emit(Events.VoiceStateUpdate, { channelId: null }, { channelId: 'voice' });
  await setImmediate();

  assert.deepEqual(
    calls.map(call => call[0]),
    ['login', 'register', 'interaction', 'voice'],
  );
  assert.equal(calls[1][2], 'guild');
  bot.destroy();
  bot.destroy();
  assert.equal(calls.filter(call => call[0] === 'shutdown').length, 1);
  assert.equal(calls.filter(call => call[0] === 'destroy').length, 1);
  assert.equal(client.listenerCount(Events.InteractionCreate), 0);
  assert.equal(client.listenerCount(Events.VoiceStateUpdate), 0);
});

test('intros desligadas não recebem eventos de voz, mantendo comandos ativos', async () => {
  const { bot, client, calls } = setup(false);
  await bot.initialize();

  try {
    assert.equal(client.listenerCount(Events.VoiceStateUpdate), 0);
    client.emit(Events.InteractionCreate, { id: 'command' });
    await setImmediate();
    assert.ok(calls.some(call => call[0] === 'interaction'));
  } finally {
    bot.destroy();
  }
});

test('falha de login limpa os recursos e propaga o erro', async () => {
  const { bot, client, calls } = setup();
  const cause = new Error('offline');
  client.login = async () => {
    throw cause;
  };
  await assert.rejects(bot.initialize(), error => error === cause);
  assert.deepEqual(calls, [['shutdown'], ['destroy']]);
});

test('falha de registro encerra o bot e indica falha do processo', async t => {
  t.mock.method(console, 'error', () => {});
  const previous = process.exitCode;
  t.after(() => {
    process.exitCode = previous;
  });
  const { bot, client, registry, calls } = setup();
  registry.register = async () => {
    throw new Error('sem permissão');
  };
  await bot.initialize();
  client.emit(Events.ClientReady, client);
  await setImmediate();

  assert.equal(process.exitCode, 1);
  assert.deepEqual(
    calls.map(call => call[0]),
    ['login', 'shutdown', 'destroy'],
  );
});

test('eventos já enfileirados não executam ações depois do encerramento', async () => {
  const { bot, client, calls } = setup();
  await bot.initialize();
  client.emit(Events.InteractionCreate, {});
  client.emit(Events.VoiceStateUpdate, {}, {});
  bot.destroy();
  await setImmediate();
  assert.equal(
    calls.some(call => ['interaction', 'voice'].includes(call[0])),
    false,
  );
});

test('erros assíncronos do roteador são registrados sem derrubar o cliente', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  const { bot, client, router, calls } = setup();
  router.handleInteraction = async () => {
    throw new Error('erro de resposta');
  };
  await bot.initialize();

  try {
    client.emit(Events.InteractionCreate, {});
    client.emit(Events.Error, new Error('gateway'));
    await setImmediate();
    assert.equal(logs.length, 2);
    assert.equal(
      calls.some(call => call[0] === 'destroy'),
      false,
    );
  } finally {
    bot.destroy();
  }
});

test('registro envia definições com seus nomes públicos, sem funções execute', async () => {
  const registry = new CommandRegistry();
  let sent;
  await registry.register({ user: { id: '123456789012345678' } }, '123456789012345678', {
    put: async (route, payload) => {
      sent = { route, ...payload };
    },
  });

  assert.equal(sent.body.length, 9);
  assert.ok(sent.route.endsWith('/guilds/123456789012345678/commands'));
  assert.ok(sent.body.some(command => command.name === 'sair'));
  assert.equal(
    sent.body.some(command => command.name === 'leave'),
    false,
  );
  assert.equal(
    sent.body.some(command => 'execute' in command),
    false,
  );
});
