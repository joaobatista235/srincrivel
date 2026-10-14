import { ApplicationError } from '../../../application/errors/ApplicationError.js';

const messages = {
  VOICE_REQUIRED: 'Entre em um canal de voz para usar este comando.',
  SAME_VOICE_REQUIRED: 'Entre no mesmo canal de voz do bot para controlar a música.',
  STALE_PANEL: 'Este controle está desatualizado. Use os controles da música atual.',
  INTRO_ACTIVE: 'Aguarde o áudio de entrada terminar antes de tocar música.',
  MUSIC_LOADING: 'Uma música já está sendo carregada. Aguarde e tente novamente.',
  MUSIC_TRANSITION: 'Aguarde a troca de música e a atualização dos controles.',
  ALREADY_PLAYING: 'A música já está tocando.',
  DICE_FORMAT: 'Use o formato xdy, como 2d6.',
  DICE_LIMITS: 'Use de 1 a 100 dados, com até 1.000.000 de faces.',
  MEDIA_AGE_RESTRICTED:
    'O YouTube exige verificação de idade para este vídeo. Escolha outra versão pública da música.',
  MEDIA_UNAVAILABLE:
    'Este vídeo está privado, removido ou indisponível para reprodução. Escolha outro link.',
  NO_QUEUE: 'Não há músicas na fila.',
  NO_PREVIOUS: 'Não há música anterior.',
  NO_UP_NEXT: 'Não há próxima música na fila.',
  NO_RELATED:
    'Não foi possível encontrar uma nova sugestão reproduzível agora. Adicione uma música com /play.',
  NO_RESULT: 'Nenhuma música encontrada.',
  CANNOT_RESOLVE_SONG: 'Não foi possível encontrar essa música.',
  CANNOT_GET_STREAM: 'Não foi possível obter o áudio dessa música.',
  NOT_SUPPORTED_URL: 'Este link não é suportado.',
  VOICE_CONNECT_FAILED: 'Não foi possível conectar ao canal de voz.',
  VOICE_MISSING_PERMS: 'O bot precisa das permissões Conectar e Falar no canal.',
  YTDLP_ERROR: 'Não foi possível obter o áudio. Verifique o link e tente novamente.',
};

export function errorMessage(error) {
  return error instanceof ApplicationError
    ? (messages[error.code] ?? 'Não foi possível concluir a operação. Tente novamente.')
    : 'Não foi possível concluir a operação. Tente novamente.';
}

export function musicResult(result) {
  const responses = {
    ADDED: 'Música adicionada à fila.',
    PAUSED: 'Música pausada.',
    RESUMED: 'Música retomada.',
    AUTOPLAY_ON: 'Autoplay ativado.',
    AUTOPLAY_OFF: 'Autoplay desativado.',
    SKIPPED: 'Música pulada.',
    STOPPED: 'Música parada e bot desconectado.',
    LEFT: 'Bot desconectado do canal de voz.',
  };

  return {
    content:
      result.code === 'PREVIOUS'
        ? 'Tocando a música anterior: ' + result.name + '.'
        : responses[result.code],
  };
}
