import { ButtonBuilder, ButtonStyle } from 'discord.js';

function createButton(id, label) {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)
}

export default {
    autoplay: createButton('autoplay', '❌ Autoplay'),
    next: createButton('skip', '⏭️ Próxima'),
    previous: createButton('previous', '⏮️ Anterior'),
    pause: createButton('pause', '⏸️ Pausar'),
    stop: createButton('stop', '⏹️ Parar'),
    volumeUp: createButton('volumeUp', '🔊 Aumentar'),
    volumeDown: createButton('volumeDown', '🔈 Diminuir')
}