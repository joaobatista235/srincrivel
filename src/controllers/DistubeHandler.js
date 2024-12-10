import { Events } from 'distube';
import listeners from '../config/listeners.js';

class DisTubeHandler {
    constructor(client) {
        this.client = client;
    }

    init() {
        this.client.distube
            .on('playSong', (queue, song) => this.onPlaySong(queue, song))
            .on('addSong', (queue, song) => this.onAddSong(queue, song))
            .on(Events.ERROR, (queue, err) => this.onError(queue, err))
            .on('finish', queue => queue.textChannel?.send('🚫 Fim da fila!'))
            .on('finishSong', queue => queue.textChannel?.send('⏹️ Fim da música!'))
            .on('disconnect', queue => queue.textChannel?.send('❌ Desconectado do canal de voz.'))
            .on('empty', queue => queue.textChannel?.send('⚠️ O canal de voz está vazio. Saindo do canal...'));
    }

    onPlaySong(queue, song) {
        listeners.onPlaySong(this.client.user.username, null, song.name, song.thumbnail, song.formattedDuration, queue.textChannel);
    }

    onAddSong(queue, song) {
        listeners.onAddSong(song.name, queue.textChannel);
    }

    onError(queue, err) {
        console.error('Erro no DisTube:', err);
        queue.textChannel?.send(`❌ Erro no player: ${err.message}`);
    }
}

export default DisTubeHandler;
