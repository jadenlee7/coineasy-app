// Keep the mobile caller dormant until the matching versioned privacy copy,
// server gate, and physical-device QA are approved together.
export const PUSH_TOKEN_REGISTRATION_READY = false;

export function pushTokenRegistrationEnabled(env = process.env) {
  return PUSH_TOKEN_REGISTRATION_READY
    && String(env.EXPO_PUBLIC_PUSH_TOKEN_REGISTRATION_ENABLED || '').trim() === 'true';
}
