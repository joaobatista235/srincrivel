import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import DisTubeEvents from '../src/adapters/audio/DisTubeEvents.js';
import DisTubePlayer from '../src/adapters/audio/DisTubePlayer.js';

test('eventos nativos são traduzidos sem passar Queue, Song ou canal para apresentação', async () => {
  const distube = new EventEmitter();
  let received;

  const events = new DisTubeEvents(distube, {
    playing: event => {
      received = event;
    },
  });

  events.init();
  distube.emit(
    'playSong',
    { id: 'guild', textChannel: { id: 'text' }, paused: false, autoplay: true },
    {
      name: 'Song',
      formattedDuration: '01:00',
      thumbnail: 'https://example.com/image.png',
      secretNativeField: {},
    },
  );
  await Promise.resolve();
  assert.deepEqual(received, {
    guildId: 'guild',
    textChannelId: 'text',
    state: { paused: false, autoplay: true },
    song: { name: 'Song', duration: '01:00', thumbnail: 'https://example.com/image.png' },
  });
  events.destroy();
  assert.equal(distube.listenerCount('playSong'), 0);
});

test('encerramento durante carregamento encerra também a conexão criada tardiamente', async () => {
  let resolvePlay;
  const leaves = [];
  const voice = { isVoiceBased: () => true };

  const player = new DisTubePlayer({
    client: {
      guilds: {
        cache: {
          get: () => ({
            channels: { cache: { get: () => voice } },
            members: { fetch: async () => ({}) },
          }),
        },
      },
    },
    distube: {
      play: () =>
        new Promise(resolve => {
          resolvePlay = resolve;
        }),
      voices: { collection: new Map(), leave: id => leaves.push(id) },
    },
  });
  const pending = player.play({ guildId: 'guild', voiceChannelId: 'voice', userId: 'user' });

  await Promise.resolve();
  player.destroy();
  resolvePlay();
  await pending;
  assert.deepEqual(leaves, ['guild']);
});
