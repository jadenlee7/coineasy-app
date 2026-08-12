// Keep the mobile caller dormant until the matching versioned privacy copy,
// server gate, and physical-device QA are approved together.
export const PUSH_TOKEN_REGISTRATION_READY = false;
export const PUSH_TOKEN_UNREGISTER_TIMEOUT_MS = 3_000;

export function pushTokenRegistrationEnabled(env = process.env) {
  return PUSH_TOKEN_REGISTRATION_READY
    && String(env.EXPO_PUBLIC_PUSH_TOKEN_REGISTRATION_ENABLED || '').trim() === 'true';
}

/**
 * Best-effort remote cleanup that can never make ordinary logout unbounded.
 * The local value is removed only after the matching owner was unregistered.
 */
export async function unregisterPushTokenBeforeLogout({
  clearLocal,
  isCurrent,
  ownerUserId,
  registrationEnabled = pushTokenRegistrationEnabled(),
  timeoutMs = PUSH_TOKEN_UNREGISTER_TIMEOUT_MS,
  token,
  unregister,
}) {
  if (
    !registrationEnabled
    || typeof token !== 'string'
    || !token.trim()
    || typeof ownerUserId !== 'string'
    || !ownerUserId.trim()
  ) return 'skipped';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await unregister({
      token,
      signal: controller.signal,
      expectedAuthUserId: ownerUserId,
    });
    if (!isCurrent()) return 'stale';
    return await clearLocal() ? 'unregistered' : 'local_clear_failed';
  } catch {
    return 'failed';
  } finally {
    clearTimeout(timeout);
  }
}
