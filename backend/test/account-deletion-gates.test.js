import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOUNT_DELETION_PROVIDER_CLEANUP_READY,
  ACCOUNT_DELETION_PUBLIC_REQUEST_READY,
  ACCOUNT_DELETION_RECENT_AUTH_READY,
  ACCOUNT_DELETION_STABLE_IDENTITY_GUARD_READY,
  accountDeletionGuardTarget,
  accountDeletionProviderCleanupEnabled,
  accountDeletionPublicRequestEnabled,
  accountDeletionRecentAuthEnabled,
  accountDeletionStableIdentityGuardEnabled,
} from '../src/lib/account-deletion-gates.js';

test('all destructive account-deletion brakes remain compile-time closed', () => {
  const fullyRequested = {
    NODE_ENV: 'production',
    EASYGO_DEPLOY_TARGET: 'production',
    ACCOUNT_DELETION_ENABLED: 'true',
    ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED: 'true',
    ACCOUNT_DELETION_RECENT_AUTH_ENABLED: 'true',
  };

  assert.equal(ACCOUNT_DELETION_PUBLIC_REQUEST_READY, false);
  assert.equal(ACCOUNT_DELETION_PROVIDER_CLEANUP_READY, false);
  assert.equal(ACCOUNT_DELETION_RECENT_AUTH_READY, false);
  assert.equal(ACCOUNT_DELETION_STABLE_IDENTITY_GUARD_READY, false);
  assert.equal(accountDeletionPublicRequestEnabled(fullyRequested), false);
  assert.equal(accountDeletionProviderCleanupEnabled(fullyRequested), false);
  assert.equal(accountDeletionRecentAuthEnabled(fullyRequested), false);
  assert.equal(accountDeletionStableIdentityGuardEnabled(fullyRequested), false);
});

test('guard target detection is separate from the irreversible readiness latch', () => {
  assert.equal(accountDeletionGuardTarget({ NODE_ENV: 'production' }), true);
  assert.equal(accountDeletionGuardTarget({ EASYGO_DEPLOY_TARGET: 'staging' }), true);
  assert.equal(accountDeletionGuardTarget({ ACCOUNT_DELETION_ENABLED: 'true' }), true);
  assert.equal(accountDeletionGuardTarget({ NODE_ENV: 'development' }), false);
});
