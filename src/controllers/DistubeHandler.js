import listeners from '../components/listeners.js';

class DisTubeHandler {
    constructor(client, distube) {
        this.client = client;
        this.distube = distube;
    }

    init() {
        this.distube
            .on('playSong', (queue, song) => this.onPlaySong(queue, song))
            .on('addSong', (queue, song) => this.onAddSong(queue, song))
            .on('finish', queue => queue.textChannel?.send('🚫 Fim da fila!'))
            .on('finishSong', queue => queue.textChannel?.send('⏹️ Fim da música!'))
            .on('disconnect', queue => queue.textChannel?.send('❌ Desconectado do canal de voz.'))
            .on('empty', queue => queue.textChannel?.send('⚠️ O canal de voz está vazio. Saindo do canal...'))
            .on('error', (e, queue, song) => {
                queue.textChannel.send(`An error encountered: ${e}`);
            })
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
