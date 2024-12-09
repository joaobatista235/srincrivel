import { ButtonBuilder, ButtonStyle } from 'discord.js';

function createButton(id, label) {
    let botao = new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary)

    return botao
}

const autoplayButton = createButton('autoplay', '❌ Autoplay')
const nextButton = createButton('skip', '⏭️ Próxima')
const previousButton = createButton('previous', '⏮️ Anterior')
const pauseButton = createButton('pause', '⏸️ Pausar')
const stopButton = createButton('stop', '⏹️ Parar')
const volumeUp = createButton('volumeUp', '🔊 Aumentar')
const volumeDown = createButton('volumeDown', '🔈 Diminuir')

export default {
    autoplay: autoplayButton,
    next: nextButton,
    previous: previousButton,
    pause: pauseButton,
    stop: stopButton,
    volumeUp: volumeUp,
    volumeDown: volumeDown
}
