import { ApplicationError } from '../../application/errors/ApplicationError.js';

export function mediaAccessError(error) {
  if (error instanceof ApplicationError) return error;
  const description = String(error?.stderr ?? error?.message ?? '');
  if (
    /sign in to confirm your age|age[- ]restricted|requires age verification/i.test(description)
  ) {
    return new ApplicationError('MEDIA_AGE_RESTRICTED', {}, { cause: error });
  }
  if (
    /video unavailable|this video is private|private video|video has been removed|not available in your country|members[- ]only|join this channel/i.test(
      description,
    )
  ) {
    return new ApplicationError('MEDIA_UNAVAILABLE', {}, { cause: error });
  }
  return error;
}

export function unavailableMedia(error) {
  return ['MEDIA_AGE_RESTRICTED', 'MEDIA_UNAVAILABLE'].includes(error?.code);
}
