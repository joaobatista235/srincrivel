import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function musicControls(queue) {
  const button = (id, label) =>
    new ButtonBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(Boolean(queue.busy));

  return [
    new ActionRowBuilder().addComponents(
      button('previous', '⏮ Anterior'),
      button('pause', queue.paused ? '▶ Retomar' : '⏸ Pausar'),
      button('stop', '⏹ Parar'),
      button('skip', '⏭ Próxima'),
    ),
    new ActionRowBuilder().addComponents(
      button('autoplay', queue.autoplay ? '✅ Autoplay' : '❌ Autoplay'),
    ),
  ];
}
