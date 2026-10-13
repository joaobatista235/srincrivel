import { SlashCommandBuilder } from 'discord.js';
import { musicResult } from '../../presentation/errorMessages.js';
const actions = new Set(['play', 'pause', 'resume', 'autoplay', 'previous', 'skip', 'stop', 'leave']);
export function createMusicCommand(name, description, action = name) {
  if (!actions.has(action)) throw new Error('Ação de música inválida: ' + action);
  return {
    data: new SlashCommandBuilder().setName(name).setDescription(description),
    button: !['play', 'resume', 'leave'].includes(action),
    async execute(interaction, { music, panels, player }) {
      if (interaction.isButton()) panels.validate(interaction.guildId, interaction.message.id);
      const input = { guildId: interaction.guildId, userId: interaction.user.id,
        voiceChannelId: interaction.member?.voice?.channelId ?? interaction.member?.voice?.channel?.id,
        textChannelId: interaction.channelId };
      if (action === 'play') input.query = interaction.options.getString('musica', true);
      const result = await music[action](input);
      if (['pause', 'resume', 'autoplay'].includes(action)) await panels.update(input.guildId, player.state(input.guildId));
      if (['stop', 'leave'].includes(action)) await panels.clear(input.guildId);
      return musicResult(result);
    },
  };
}
