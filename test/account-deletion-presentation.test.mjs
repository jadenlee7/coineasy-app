import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { normalizeSocialAuthor } from '../utils/socialAuthor.mjs';

test('a redacted post with no author remains renderable as a deleted account', () => {
  assert.deepEqual(normalizeSocialAuthor(null), {});
  assert.deepEqual(normalizeSocialAuthor(undefined), {});
  assert.deepEqual(normalizeSocialAuthor({ id: 'user_1' }), { id: 'user_1' });

  const adapter = readFileSync(
    new URL('../utils/socialPostAdapter.js', import.meta.url),
    'utf8',
  );
  assert.match(adapter, /normalizeSocialAuthor\(author\)/);
  assert.match(adapter, /Deleted account/);
  assert.match(adapter, /deleted: Boolean\(row\.deleted \|\| row\.deletedAt\)/);
});

test('authenticated fallback UI waits for sync and never opens for a deletion guard', () => {
  const app = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../hooks/useAuthSync.js', import.meta.url), 'utf8');

  assert.match(app, /canUseFallback,[\s\S]*deletionBlocked,[\s\S]*error,/);
  assert.match(app, /markerBlocked \|\| \(privyReady && \(!privyUserId \|\| deletionBlocked\)\)/);
  assert.match(app, /privyReady && privyUserId && canUseFallback/);
  assert.match(app, /accountDeletionGuard\.status !== 'clear'/);
  assert.match(app, /<AccountDeletionPending guard=\{accountDeletionGuard\}/);
  assert.match(app, /retry: retryDeletionGuard/);
  assert.match(hook, /useAuthSync\(privy, \{ enabled = true \} = \{\}\)/);
  assert.match(hook, /syncAllowedRef\.current && lifecycle\.current\.isCurrent/);
  assert.match(hook, /canUseFallback: Boolean\(enabled\)/);
  assert.match(hook, /status: outcome\.error\.deletionBlocked \? 'deletion-blocked' : 'failed'/);
  const lifecycle = readFileSync(
    new URL('../hooks/authSyncLifecycle.mjs', import.meta.url),
    'utf8',
  );
  assert.match(lifecycle, /account_deletion_guard_unavailable/);
});

test('account deletion is capability-gated and binds the destructive request to one owner', () => {
  const settings = readFileSync(
    new URL('../components/modals/SettingsModal.js', import.meta.url),
    'utf8',
  );
  const api = readFileSync(new URL('../utils/api.js', import.meta.url), 'utf8');
  const pending = readFileSync(
    new URL('../screens/AccountDeletionPending.js', import.meta.url),
    'utf8',
  );

  assert.match(settings, /status\?\.available !== true/);
  assert.match(settings, /walletRiskAcknowledged/);
  assert.match(settings, /confirmationText: deletionConfirmation/);
  assert.match(settings, /submitAccountDeletionRequest/);
  assert.match(settings, /reconcileAccountDeletionStatus/);
  assert.match(settings, /expectedAuthUserId: ownerUserId/);
  assert.doesNotMatch(settings, /phase:\s*['"]accepted['"]/);
  assert.match(api, /boundAuth: true/);
  assert.match(api, /expectedAuthUserId/);
  assert.match(api, /expectedPrivyDid: expectedAuthUserId/);
  assert.match(pending, /guard\.marker\.clientRequestId/);
  assert.match(pending, /accountDeletionStatus\(\{/);
  assert.match(pending, /reconcileAccountDeletionStatus/);
  assert.match(pending, /'server-error', 'server-blocked'/);

  const app = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.match(app, /account_deletion_in_progress[\s\S]*phase:\s*['"]requesting['"]/);
  assert.doesNotMatch(app, /phase:\s*['"]accepted['"]/);
});
