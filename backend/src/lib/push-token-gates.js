// Compile-time brake: activation requires a new, versioned privacy document
// plus device QA. An environment typo cannot open registration in this build.
export const PUSH_TOKEN_REGISTRATION_READY = false;

export function pushTokenRegistrationEnabled(env = process.env) {
  return PUSH_TOKEN_REGISTRATION_READY
    && String(env.PUSH_TOKEN_REGISTRATION_ENABLED || '').trim() === 'true';
}
