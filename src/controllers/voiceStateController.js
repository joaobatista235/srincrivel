import PlayAudioUseCase from '../usecases/PlayAudioUseCase.js';

class AudioController {
    constructor(client, usuarios, __dirname) {
        this.playAudioUseCase = new PlayAudioUseCase(client, usuarios, __dirname);
    }

    handleVoiceStateUpdate(oldState, newState) {
        this.playAudioUseCase.execute(oldState, newState);
    }
}

export default AudioController;
