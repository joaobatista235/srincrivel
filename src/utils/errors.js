export class UserError extends Error {}

export function musicErrorMessage(error) {
  const messages = {
    NO_QUEUE: 'Não há músicas na fila.',
    NO_PREVIOUS: 'Não há música anterior.',
    NO_UP_NEXT: 'Não há próxima música na fila.',
    NO_RELATED: 'Não foi possível encontrar músicas para o autoplay.',
    NO_RESULT: 'Nenhuma música encontrada.',
    CANNOT_RESOLVE_SONG: 'Não foi possível encontrar essa música.',
    CANNOT_GET_STREAM: 'Não foi possível obter o áudio dessa música.',
    NOT_SUPPORTED_URL: 'Este link não é suportado.',
    VOICE_CONNECT_FAILED: 'Não foi possível conectar ao canal de voz.',
    VOICE_MISSING_PERMS: 'O bot precisa das permissões Conectar e Falar no canal.',
    YTDLP_ERROR: 'Não foi possível obter o áudio. Verifique o link e tente novamente.',
  };
  return messages[error?.code] ?? 'Não foi possível concluir a operação. Tente novamente.';
}
