import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';

class VoiceHandler {
    playAudio(user, audioPath, voiceChannel) {
        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(audioPath);

            connection.subscribe(player);

            player.play(resource);

            player.on(AudioPlayerStatus.Playing, () => {
                console.log(`Tocando áudio para o usuário ${user.id}!`);
            });

            player.on(AudioPlayerStatus.Idle, () => {
                console.log(`Áudio para o usuário ${user.id} finalizado. Desconectando...`);
                connection.destroy();
            });
        } catch (error) {
            console.error(`Erro ao tentar reproduzir o áudio para o usuário ${user.id}:`, error);
        }
    }
}

export default VoiceHandler;
