/**
 * Compile-time account-deletion release brakes.
 *
 * Keep these constants independent from environment input. Environment flags
 * are necessary, but never sufficient, to expose destructive account deletion
 * or start its provider-cleanup worker. Each brake moves to true only in a
 * separately reviewed release after its own activation blockers are closed.
 */
export const ACCOUNT_DELETION_PUBLIC_REQUEST_READY = false;
export const ACCOUNT_DELETION_PROVIDER_CLEANUP_READY = false;
// This latch is independent from both runtime kill switches. Once deletion has
// ever been exposed, a later request/worker rollback must not let a replacement
// provider identity bypass an existing tombstone. It therefore moves to true
// only in the activation release and must never be reverted afterwards.
export const ACCOUNT_DELETION_STABLE_IDENTITY_GUARD_READY = false;

function explicitlyEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

export function accountDeletionGuardTarget(env = process.env) {
  const deployTarget = String(env.EASYGO_DEPLOY_TARGET || '').trim().toLowerCase();
  return explicitlyEnabled(env.ACCOUNT_DELETION_ENABLED)
    || String(env.NODE_ENV || '').trim().toLowerCase() === 'production'
    || deployTarget === 'staging'
    || deployTarget === 'production';
}

export function accountDeletionStableIdentityGuardEnabled(env = process.env) {
  return ACCOUNT_DELETION_STABLE_IDENTITY_GUARD_READY
    && accountDeletionGuardTarget(env);
}

export function accountDeletionPublicRequestEnabled(env = process.env) {
  return ACCOUNT_DELETION_PUBLIC_REQUEST_READY
    && ACCOUNT_DELETION_PROVIDER_CLEANUP_READY
    && ACCOUNT_DELETION_STABLE_IDENTITY_GUARD_READY
    && explicitlyEnabled(env.ACCOUNT_DELETION_ENABLED)
    && explicitlyEnabled(env.ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED);
}

export function accountDeletionProviderCleanupEnabled(env = process.env) {
  return ACCOUNT_DELETION_PROVIDER_CLEANUP_READY
    && explicitlyEnabled(env.ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED);
}
