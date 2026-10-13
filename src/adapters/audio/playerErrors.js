import { ApplicationError } from '../../application/errors/ApplicationError.js';

const codes = new Set([
  'NO_QUEUE',
  'NO_PREVIOUS',
  'NO_UP_NEXT',
  'NO_RELATED',
  'NO_RESULT',
  'CANNOT_RESOLVE_SONG',
  'CANNOT_GET_STREAM',
  'NOT_SUPPORTED_URL',
  'VOICE_CONNECT_FAILED',
  'VOICE_MISSING_PERMS',
  'YTDLP_ERROR',
]);

export function playerError(error) {
  if (error instanceof ApplicationError) return error;

  return new ApplicationError(
    codes.has(error?.code) ? error.code : 'PLAYER_FAILED',
    {},
    { cause: error },
  );
}
