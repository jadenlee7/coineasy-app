const MODERATION_CREDENTIAL = /eg_mod_[A-Za-z0-9_-]{32,220}/giu;
const MODERATION_CREDENTIAL_DETECTOR = /eg_mod_[A-Za-z0-9_-]{32,220}/iu;

export function containsModerationCredential(value) {
  return typeof value === 'string' && MODERATION_CREDENTIAL_DETECTOR.test(value);
}

export function sanitizeModerationCredentialText(value) {
  if (!value) return value;
  return String(value).replace(MODERATION_CREDENTIAL, '[REDACTED]');
}

export function sanitizeRequestUrl(value) {
  if (!value) return value;
  const withoutQuery = String(value).split(/[?#]/, 1)[0];
  return sanitizeModerationCredentialText(withoutQuery);
}
