import { Events } from 'distube';
import listeners from '../config/listeners.js';

class DisTubeHandler {
    constructor(client, playAudioUseCase) {
        this.client = client;
    }

    init() {
        this.client.distube
            .on('playSong', (queue, song) => this.onPlaySong(queue, song))
            .on('addSong', (queue, song) => this.onAddSong(queue, song))
            .on(Events.ERROR, (queue, err) => console.error(err))
            .on('finish', queue => queue.textChannel?.send('Fim da fila!'))
            .on('finishSong', queue => queue.textChannel?.send('Fim da música!'))
            .on('disconnect', queue => queue.textChannel?.send('Desconectado!'))
            .on('empty', queue => queue.textChannel?.send('O canal de voz está vazio! Saindo do canal...'));
    }

    onPlaySong(queue, song) {
        listeners.onPlaySong(this.client.user.username, null, song.name, song.thumbnail, song.formattedDuration, queue.textChannel);
    }

    onAddSong(queue, song) {
        listeners.onAddSong(song.name, queue.textChannel);
    }
}

export default DisTubeHandler;
