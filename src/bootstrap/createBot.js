import { Client, GatewayIntentBits } from 'discord.js';
import { DisTube } from 'distube';
import ffmpegPath from 'ffmpeg-static';
import DiscordBot from '../adapters/discord/DiscordBot.js';
import CommandRegistry from '../adapters/discord/CommandRegistry.js';
import InteractionRouter from '../adapters/discord/InteractionRouter.js';
import VoiceStateListener from '../adapters/discord/VoiceStateListener.js';
import MusicPanel from '../adapters/discord/presentation/MusicPanel.js';
import DisTubePlayer from '../adapters/audio/DisTubePlayer.js';
import DisTubeEvents from '../adapters/audio/DisTubeEvents.js';
import IntroAudioPlayer from '../adapters/audio/IntroAudioPlayer.js';
import YtDlpExtractor from '../adapters/audio/YtDlpExtractor.js';
import MusicActions from '../application/music/MusicActions.js';
import IntroActions from '../application/intros/IntroActions.js';
import VoiceSessionCoordinator from '../application/audio/VoiceSessionCoordinator.js';
import { readIntroConfiguration } from '../config/readIntroConfiguration.js';

export function createBot(config, { loadIntroConfiguration = readIntroConfiguration } = {}) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  const distube = new DisTube(client, {
    plugins: [new YtDlpExtractor()],
    ffmpeg: { path: ffmpegPath },
    emitNewSongOnly: true,
    savePreviousSongs: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    joinNewVoiceChannel: false,
  });

  const panels = new MusicPanel(client);

  const player = new DisTubePlayer({
    client,
    distube,
    transition: (guildId, operation) =>
      panels.transition(guildId, operation, () => player.state(guildId)),
  });

  const coordinator = new VoiceSessionCoordinator(guildId => player.state(guildId));

  const introPlayer = (config.introsEnabled ?? true) ? new IntroAudioPlayer({ client }) : null;

  const intros = introPlayer
    ? new IntroActions({ users: loadIntroConfiguration(), player: introPlayer, coordinator })
    : null;

  const music = new MusicActions({
    player,
    coordinator,
    stopIntro: guildId => intros?.stop(guildId),
  });

  const registry = new CommandRegistry();

  const router = new InteractionRouter(registry, { music, panels, player });

  const events = new DisTubeEvents(distube, {
    playing: event => panels.show(event),
    added: event => panels.added(event),
    error: event => panels.error(event),
    cleared: event => panels.clear(event.guildId),
    finished: async ({ guildId }) => {
      await panels.clear(guildId);

      if (!player.state(guildId)?.hasQueue) await player.leave(guildId);
    },
  });

  events.init();

  return new DiscordBot({
    client,
    config,
    registry,
    router,
    voiceListener: intros ? new VoiceStateListener(intros) : null,
    shutdown: () => {
      events.destroy();
      panels.destroy();
      introPlayer?.destroy();
      player.destroy();
    },
  });
}
