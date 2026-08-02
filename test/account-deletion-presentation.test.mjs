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

  assert.match(app, /profile, canUseFallback, deletionBlocked/);
  assert.match(app, /privyReady && \(!privyUserId \|\| deletionBlocked\)/);
  assert.match(app, /privyReady && privyUserId && canUseFallback/);
  assert.match(hook, /status: outcome\.error\.deletionBlocked \? 'deletion-blocked' : 'failed'/);
  assert.match(hook, /canUseFallback: currentResolution\?\.status === 'failed'/);
  const lifecycle = readFileSync(
    new URL('../hooks/authSyncLifecycle.mjs', import.meta.url),
    'utf8',
  );
  assert.match(lifecycle, /account_deletion_guard_unavailable/);
});
