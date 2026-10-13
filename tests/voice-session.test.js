import { test } from 'node:test';
import assert from 'node:assert/strict';
import VoiceSessionCoordinator from '../src/application/audio/VoiceSessionCoordinator.js';
import MusicActions from '../src/application/music/MusicActions.js';
import IntroActions from '../src/application/intros/IntroActions.js';

test('busca, fila pausada, intro e saída compartilham a mesma coordenação sem sobrepor áudio', async () => {
  let musicState = null;
  let finishLoading;
  let endIntro;
  let introStarts = 0;
  const player = {
    state: () => musicState,
    play: () =>
      new Promise(resolve => {
        finishLoading = () => {
          musicState = { channelId: 'voice', hasQueue: true, paused: false };
          resolve();
        };
      }),
    pause: async () => {
      musicState.paused = true;
    },
    stop: async () => {
      musicState = null;
    },
    leave: async () => {
      musicState = null;
    },
  };
  const coordinator = new VoiceSessionCoordinator(id => player.state(id));
  const intros = new IntroActions({
    coordinator,
    users: { user: { audio: 'intro.mp3' } },
    player: {
      play: async (_input, onEnd) => {
        introStarts++;
        endIntro = onEnd;
      },
      stop: () => {
        endIntro?.();
        endIntro = null;
      },
    },
  });
  const music = new MusicActions({ player, coordinator, stopIntro: id => intros.stop(id) });
  const input = { guildId: 'guild', voiceChannelId: 'voice', query: 'Song' };
  const voiceChange = {
    guildId: 'guild',
    userId: 'user',
    channelId: 'voice',
    previousChannelId: null,
    isBot: false,
  };

  const loading = music.play(input);
  await intros.onVoiceChange(voiceChange);
  assert.equal(introStarts, 0);
  finishLoading();
  await loading;
  await music.pause(input);
  await intros.onVoiceChange(voiceChange);
  assert.equal(introStarts, 0);

  await music.stop(input);
  await intros.onVoiceChange(voiceChange);
  assert.equal(introStarts, 1);
  assert.equal(coordinator.state('guild').kind, 'intro');
  await assert.rejects(music.play(input), { code: 'INTRO_ACTIVE' });
  await music.leave(input);
  assert.equal(coordinator.state('guild'), null);

  const next = music.play(input);
  finishLoading();
  await next;
  assert.equal(coordinator.state('guild').hasQueue, true);
});

test('falha ao iniciar intro libera a reserva mesmo quando o adaptador não chama onEnd', async () => {
  const coordinator = new VoiceSessionCoordinator(() => null);
  const cause = new Error('arquivo indisponível');
  const intros = new IntroActions({
    coordinator,
    users: { user: { audio: 'intro.mp3' } },
    player: {
      play: async () => {
        throw cause;
      },
    },
  });
  await assert.rejects(
    intros.onVoiceChange({ guildId: 'guild', userId: 'user', channelId: 'voice' }),
    error => error === cause,
  );
  assert.equal(coordinator.state('guild'), null);
  assert.ok(coordinator.reserveMusic({ guildId: 'guild', voiceChannelId: 'voice' }));
});
