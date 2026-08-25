import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ACTIVE_SOCIAL_AUTHOR_LABEL,
  DELETED_SOCIAL_AUTHOR_LABEL,
  normalizeSocialAuthor,
  socialAuthorDisplayName,
} from '../utils/socialAuthor.mjs';

test('a redacted post with no author remains renderable as a deleted account', () => {
  assert.deepEqual(normalizeSocialAuthor(null), {});
  assert.deepEqual(normalizeSocialAuthor(undefined), {});
  assert.deepEqual(normalizeSocialAuthor({ id: 'user_1' }), { id: 'user_1' });

  const adapter = readFileSync(
    new URL('../utils/socialPostAdapter.js', import.meta.url),
    'utf8',
  );
  assert.match(adapter, /normalizeSocialAuthor\(author\)/);
  assert.match(adapter, /socialAuthorDisplayName\(safeAuthor\)/);
  assert.match(adapter, /deleted: Boolean\(row\.deleted \|\| row\.deletedAt\)/);
});

test('active unnamed authors are never presented as deleted accounts', () => {
  assert.equal(
    socialAuthorDisplayName({ id: 'active-user', displayName: null, username: null }),
    ACTIVE_SOCIAL_AUTHOR_LABEL,
  );
  assert.equal(socialAuthorDisplayName(null), DELETED_SOCIAL_AUTHOR_LABEL);
  assert.equal(
    socialAuthorDisplayName({ id: 'named-user', displayName: '  Jaden  ' }),
    'Jaden',
  );
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
  assert.match(settings, /accountDeletionAvailabilityMessage\(error\)/);
  assert.match(settings, /제공자 계정 정리와 최근 로그인 확인이 아직 릴리스 승인되지 않아 새 삭제 요청이 잠겨 있습니다/);
  assert.match(settings, /삭제 요청은 전송되지 않았고 데이터는 변경되지 않았습니다/);
  assert.match(settings, /이 메뉴에서 삭제를 시작할 수 있습니다/);
  assert.match(settings, /로그인 제공자·Privy 연결 정리/);
  assert.doesNotMatch(settings, /Apple 계정 정리/);
  assert.match(settings, /walletRiskAcknowledged/);
  assert.match(settings, /confirmationText: deletionConfirmation/);
  assert.match(settings, /submitAccountDeletionRequest/);
  assert.match(settings, /reconcileAccountDeletionStatus/);
  assert.match(settings, /expectedAuthUserId: ownerUserId/);
  assert.doesNotMatch(settings, /phase:\s*['"]accepted['"]/);
  assert.match(api, /boundAuth: true/);
  assert.match(api, /expectedAuthUserId/);
  assert.match(api, /expectedPrivyDid: expectedAuthUserId/);
  assert.match(pending, /const marker = guard\.marker/);
  assert.match(pending, /clientRequestId: marker\.clientRequestId/);
  assert.match(pending, /accountDeletionStatus\(\{/);
  assert.match(pending, /reconcileAccountDeletionStatus/);
  assert.ok(
    pending.indexOf('accountDeletionStatus({')
      < pending.indexOf('reauthRef.current.run({'),
  );
  assert.match(pending, /challengeId,[\s\S]*reauthProof,[\s\S]*walletRiskAcknowledged/);
  assert.match(pending, /isCurrentOwner: isCurrentOperation/);
  assert.match(pending, /'server-error', 'server-blocked'/);

  const app = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.match(app, /account_deletion_in_progress[\s\S]*phase:\s*['"]requesting['"]/);
  assert.doesNotMatch(app, /phase:\s*['"]accepted['"]/);
});
