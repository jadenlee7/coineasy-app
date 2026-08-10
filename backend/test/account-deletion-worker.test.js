import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  accountDeletionSubjectHash,
  accountDeletionSubjectKeyFingerprint,
  encryptAccountDeletionSubject,
} from '../src/lib/account-deletion.js';
import {
  ACCOUNT_DELETION_PROVIDER_CLEANUP_READY,
  ACCOUNT_DELETION_PUBLIC_REQUEST_READY,
  accountDeletionProviderCleanupEnabled,
} from '../src/lib/account-deletion-gates.js';
import { AccountDeletionProviderError } from '../src/lib/account-deletion-providers.js';
import {
  accountDeletionRetryDelayMs,
  abortableWait,
  claimAccountDeletionRequest,
  getAccountDeletionWorkerConfig,
  processClaimedAccountDeletion,
  runAccountDeletionCleanupCycle,
} from '../src/lib/account-deletion-worker.js';
import { validateDeployEnvironment } from '../scripts/preflight.js';

const NOW = new Date('2026-08-08T12:00:00.000Z');
const PRIVY_DID = 'did:privy:provider-worker-user';
const TEST_ENV = Object.freeze({
  ACCOUNT_DELETION_ENABLED: 'true',
  ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED: 'true',
  ACCOUNT_DELETION_SUBJECT_HMAC_KEY: 'h'.repeat(32),
  ACCOUNT_DELETION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
});
const SUBJECT_HASH = accountDeletionSubjectHash(PRIVY_DID, TEST_ENV);
const KEY_FINGERPRINT = accountDeletionSubjectKeyFingerprint(TEST_ENV);
const CIPHERTEXT = encryptAccountDeletionSubject(PRIVY_DID, SUBJECT_HASH, TEST_ENV, {
  bytes: (length) => Buffer.alloc(length, 9),
});

function claimedRequest(state, overrides = {}) {
  return {
    id: 'deletion_request_1',
    state,
    stateVersion: 4,
    attemptCount: 1,
    subjectHash: SUBJECT_HASH,
    subjectHashKeyVersion: 1,
    subjectHashKeyFingerprint: KEY_FINGERPRINT,
    privyDidCiphertext: CIPHERTEXT,
    encryptionKeyVersion: 1,
    leaseToken: 'a'.repeat(64),
    leaseExpiresAt: new Date(NOW.getTime() + 60_000),
    ...overrides,
  };
}

function transitionDb({ count = 1 } = {}) {
  const updates = [];
  return {
    updates,
    db: {
      async $executeRawUnsafe(sql, ...params) {
        updates.push({ sql, params });
        return count;
      },
    },
  };
}

function assignedValue(update, column) {
  const match = update.sql.match(
    new RegExp(`(?:SET |,\\n    )"${column}" = \\$(\\d+)`, 'u'),
  );
  return match ? update.params[Number(match[1]) - 1] : undefined;
}

function fenceValue(update, column) {
  const match = update.sql.match(
    new RegExp(`(?:WHERE|AND) "${column}" = \\$(\\d+)`, 'u'),
  );
  return match ? update.params[Number(match[1]) - 1] : undefined;
}

function retryDelayValue(update) {
  const match = update.sql.match(
    /"nextAttemptAt" = CURRENT_TIMESTAMP \+ \(\$(\d+)::integer \* INTERVAL '1 millisecond'\)/u,
  );
  return match ? update.params[Number(match[1]) - 1] : undefined;
}

test('public requests and provider cleanup have separate compile-time brakes that remain closed', () => {
  assert.equal(ACCOUNT_DELETION_PUBLIC_REQUEST_READY, false);
  assert.equal(ACCOUNT_DELETION_PROVIDER_CLEANUP_READY, false);
  assert.equal(accountDeletionProviderCleanupEnabled(TEST_ENV), false);
});

test('a dormant cycle performs zero database and provider initialization', async () => {
  let databaseCalls = 0;
  let providerInitializations = 0;
  const result = await runAccountDeletionCleanupCycle({
    db: {
      async $queryRawUnsafe() { databaseCalls += 1; throw new Error('must not run'); },
    },
    env: TEST_ENV,
    providerFactory: async () => {
      providerInitializations += 1;
      throw new Error('must not initialize');
    },
  });

  assert.equal(result.dormant, true);
  assert.equal(databaseCalls, 0);
  assert.equal(providerInitializations, 0);
});

test('the executable checks the gate before dynamically importing database and worker modules', () => {
  const source = readFileSync(
    new URL('../src/account-deletion-worker.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /^import .*\.\/lib\/db\.js/mu);
  assert.doesNotMatch(source, /^import .*\.\/lib\/account-deletion-worker\.js/mu);
  assert.match(source, /if \(!accountDeletionProviderCleanupEnabled\(process\.env\)\)/u);
  assert.match(source, /import\('\.\/lib\/db\.js'\)/u);
  assert.doesNotMatch(source, /allowFoundationExecution/u);
});

test('the dedicated process contract never routes cleanup through the segment worker', () => {
  const railway = JSON.parse(readFileSync(
    new URL('../railway.account-deletion-worker.json', import.meta.url),
    'utf8',
  ));
  const packageJson = JSON.parse(readFileSync(
    new URL('../package.json', import.meta.url),
    'utf8',
  ));
  const procfile = readFileSync(new URL('../Procfile', import.meta.url), 'utf8');
  assert.equal(railway.deploy.startCommand, 'node src/account-deletion-worker.js');
  assert.equal(
    packageJson.scripts['worker:account-deletion:once'],
    'node src/account-deletion-worker.js --once',
  );
  assert.match(
    procfile,
    /^account-deletion-worker: node src\/account-deletion-worker\.js$/mu,
  );
});

test('worker configuration is bounded and requires a two-times timeout lease margin', () => {
  assert.deepEqual(getAccountDeletionWorkerConfig({}), {
    intervalMs: 30_000,
    batchSize: 10,
    leaseMs: 60_000,
    providerTimeoutMs: 10_000,
  });
  assert.throws(
    () => getAccountDeletionWorkerConfig({ ACCOUNT_DELETION_WORKER_BATCH_SIZE: '101' }),
    /account_deletion_worker_config_invalid/u,
  );
  assert.throws(
    () => getAccountDeletionWorkerConfig({
      ACCOUNT_DELETION_WORKER_LEASE_MS: '30000',
      ACCOUNT_DELETION_PROVIDER_TIMEOUT_MS: '20000',
    }),
    /account_deletion_worker_lease_too_short/u,
  );
});

test('deploy preflight applies the same worker bounds even while cleanup is disabled', () => {
  const result = validateDeployEnvironment({
    ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED: 'false',
    ACCOUNT_DELETION_WORKER_LEASE_MS: '30000',
    ACCOUNT_DELETION_PROVIDER_TIMEOUT_MS: '20000',
  }, { target: 'local' });
  assert.equal(
    result.errors.some(
      (item) => item.name === 'account deletion worker lease safety margin',
    ),
    true,
  );
});

test('full-jitter retry is capped and never returns an immediate retry', () => {
  assert.equal(accountDeletionRetryDelayMs(1, { random: () => 0 }), 1_000);
  assert.equal(accountDeletionRetryDelayMs(2, { random: () => 0.5 }), 30_000);
  assert.equal(
    accountDeletionRetryDelayMs(99, { random: () => 0.999999999 }),
    21_599_999,
  );
});

test('claiming is atomic, skips locked rows, and issues an opaque expiring lease', async () => {
  let observed;
  const leaseBytes = Buffer.alloc(32, 11);
  const db = {
    async $queryRawUnsafe(...args) {
      observed = args;
      return [{
        ...claimedRequest('APPLE_REVOKED'),
        leaseToken: leaseBytes.toString('hex'),
      }];
    },
  };
  const claimed = await claimAccountDeletionRequest({
    db,
    // This deliberately skewed client time must not reach the lease query.
    now: new Date('2099-01-01T00:00:00.000Z'),
    leaseMs: 60_000,
    bytes: () => leaseBytes,
  });

  assert.match(observed[0], /FOR UPDATE SKIP LOCKED/u);
  assert.match(observed[0], /NOT \("id" = ANY\(\$3::text\[\]\)\)/u);
  assert.match(observed[0], /"stateVersion" = request\."stateVersion" \+ 1/u);
  assert.match(observed[0], /"nextAttemptAt" <= CURRENT_TIMESTAMP/u);
  assert.match(observed[0], /"leaseExpiresAt" <= CURRENT_TIMESTAMP/u);
  assert.match(
    observed[0],
    /CURRENT_TIMESTAMP\s*\+ \(\$1::integer \* INTERVAL '1 millisecond'\)/u,
  );
  assert.equal(observed[1], 60_000);
  assert.equal(observed[2], leaseBytes.toString('hex'));
  assert.deepEqual(observed[3], []);
  assert.equal(observed.slice(1).some((value) => value instanceof Date), false);
  assert.equal(claimed.leaseToken, leaseBytes.toString('hex'));
});

test('past and future client clocks cannot alter claim eligibility or expiry', async () => {
  const calls = [];
  const db = {
    async $queryRawUnsafe(...args) {
      calls.push(args);
      return [];
    },
  };
  for (const now of [
    new Date('1970-01-01T00:00:00.000Z'),
    new Date('2099-01-01T00:00:00.000Z'),
  ]) {
    await claimAccountDeletionRequest({
      db,
      now,
      leaseMs: 60_000,
      bytes: () => Buffer.alloc(32, 12),
    });
  }

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0].slice(1).some((value) => value instanceof Date), false);
  assert.match(calls[0][0], /"updatedAt" = CURRENT_TIMESTAMP/u);
});

test('deterministic provider configuration is validated before a row is leased', async () => {
  let databaseCalls = 0;
  await assert.rejects(
    () => runAccountDeletionCleanupCycle({
      db: { async $queryRawUnsafe() { databaseCalls += 1; return []; } },
      env: TEST_ENV,
      allowFoundationExecution: true,
      providerFactory: async () => {
        throw new AccountDeletionProviderError('provider_factory_invalid', {
          global: true,
          retryable: true,
        });
      },
    }),
    /provider_factory_invalid/u,
  );
  assert.equal(databaseCalls, 0);

  await assert.rejects(
    () => runAccountDeletionCleanupCycle({
      db: { async $queryRawUnsafe() { databaseCalls += 1; return []; } },
      env: TEST_ENV,
      allowFoundationExecution: true,
      providerFactory: async () => ({}),
    }),
    /account_deletion_provider_adapters_invalid/u,
  );
  assert.equal(databaseCalls, 0);
});

test('the test-only foundation path exercises one full fenced cycle without opening either brake', async () => {
  let claims = 0;
  let providerInitializations = 0;
  const claimExclusions = [];
  const updates = [];
  const db = {
    async $queryRawUnsafe(_query, _leaseMs, _token, exclusions) {
      claims += 1;
      claimExclusions.push(exclusions);
      return claims === 1 ? [claimedRequest('PRIVY_DELETED')] : [];
    },
    async $executeRawUnsafe(sql, ...params) {
      updates.push({ sql, params });
      return 1;
    },
  };
  const result = await runAccountDeletionCleanupCycle({
    db,
    env: { ...TEST_ENV, ACCOUNT_DELETION_WORKER_BATCH_SIZE: '2' },
    allowFoundationExecution: true,
    clock: () => NOW,
    providerFactory: async () => {
      providerInitializations += 1;
      return {
        apple: { async resolve() { throw new Error('unused'); } },
        privy: { async deleteUser() { throw new Error('unused'); } },
      };
    },
  });

  assert.equal(providerInitializations, 1);
  assert.equal(claims, 2);
  assert.deepEqual(claimExclusions, [[], ['deletion_request_1']]);
  assert.equal(updates.length, 1);
  assert.deepEqual(result, {
    dormant: false,
    claimed: 1,
    completed: 1,
    retried: 0,
    manualReview: 0,
    halted: false,
  });
  assert.equal(accountDeletionProviderCleanupEnabled(TEST_ENV), false);
});

test('Privy success advances with lease and state-version fencing and resets stage attempts', async () => {
  const { db, updates } = transitionDb();
  let receivedDid;
  const request = claimedRequest('APPLE_REVOKED');
  const result = await processClaimedAccountDeletion({
    db,
    request,
    env: TEST_ENV,
    clock: () => NOW,
    providers: {
      privy: {
        async deleteUser({ privyDid }) {
          receivedDid = privyDid;
          return { outcome: 'deleted' };
        },
      },
    },
  });

  assert.equal(receivedDid, PRIVY_DID);
  assert.deepEqual(result, {
    outcome: 'advanced',
    haltCycle: false,
    toState: 'PRIVY_DELETED',
  });
  assert.equal(updates.length, 2);
  const transition = updates.at(-1);
  assert.equal(fenceValue(transition, 'id'), request.id);
  assert.equal(fenceValue(transition, 'state'), 'APPLE_REVOKED');
  assert.equal(fenceValue(transition, 'stateVersion'), 4);
  assert.equal(fenceValue(transition, 'leaseToken'), 'a'.repeat(64));
  assert.match(transition.sql, /"leaseExpiresAt" > CURRENT_TIMESTAMP/u);
  assert.equal(assignedValue(transition, 'state'), 'PRIVY_DELETED');
  assert.equal(assignedValue(transition, 'attemptCount'), 0);
  assert.equal(assignedValue(transition, 'nextAttemptAt'), null);
  assert.match(transition.sql, /"leaseToken" = NULL/u);
  assert.equal(assignedValue(transition, 'privyDidCiphertext'), undefined);
});

test('the database clock exclusively decides fenced ownership under client clock skew', async () => {
  const futureAppleClient = transitionDb({ count: 1 });
  const futureAppleResult = await processClaimedAccountDeletion({
    db: futureAppleClient.db,
    request: claimedRequest('LOCAL_PURGED'),
    clock: () => new Date('2099-01-01T00:00:00.000Z'),
    providers: { apple: { async resolve() { return { outcome: 'revoked' }; } } },
  });
  assert.equal(futureAppleResult.outcome, 'advanced');
  assert.equal(
    assignedValue(futureAppleClient.updates.at(-1), 'nextAttemptAt'),
    null,
  );

  const futureClient = transitionDb({ count: 1 });
  const futureResult = await processClaimedAccountDeletion({
    db: futureClient.db,
    request: claimedRequest('APPLE_REVOKED', {
      leaseExpiresAt: new Date('2026-08-08T12:01:00.000Z'),
    }),
    env: TEST_ENV,
    clock: () => new Date('2099-01-01T00:00:00.000Z'),
    providers: { privy: { async deleteUser() { return { outcome: 'deleted' }; } } },
  });
  assert.equal(futureResult.outcome, 'advanced');
  assert.match(
    futureClient.updates[0].sql,
    /"leaseExpiresAt" > CURRENT_TIMESTAMP/u,
  );
  assert.equal(
    assignedValue(futureClient.updates.at(-1), 'nextAttemptAt'),
    null,
  );

  const pastClient = transitionDb({ count: 0 });
  const pastResult = await processClaimedAccountDeletion({
    db: pastClient.db,
    request: claimedRequest('APPLE_REVOKED', {
      leaseExpiresAt: new Date('2026-08-08T11:59:00.000Z'),
    }),
    env: TEST_ENV,
    clock: () => new Date('1970-01-01T00:00:00.000Z'),
    providers: { privy: { async deleteUser() { return { outcome: 'deleted' }; } } },
  });
  assert.equal(pastResult.outcome, 'lease_lost');
  assert.equal(pastResult.toState, undefined);
  assert.match(pastClient.updates[0].sql, /"leaseExpiresAt" > CURRENT_TIMESTAMP/u);

  for (const update of [
    futureAppleClient.updates[0],
    futureClient.updates[0],
    pastClient.updates[0],
  ]) {
    assert.equal(fenceValue(update, 'id'), 'deletion_request_1');
    assert.equal(
      fenceValue(update, 'state'),
      update === futureAppleClient.updates[0] ? 'LOCAL_PURGED' : 'APPLE_REVOKED',
    );
    assert.equal(fenceValue(update, 'stateVersion'), 4);
    assert.equal(fenceValue(update, 'leaseToken'), 'a'.repeat(64));
    assert.doesNotMatch(update.sql, /"leaseExpiresAt" > \$\d+/u);
  }
});

test('a generic retry count or legacy already-absent result cannot prove Privy deletion', async () => {
  const { db, updates } = transitionDb();
  const result = await processClaimedAccountDeletion({
    db,
    request: claimedRequest('APPLE_REVOKED', { attemptCount: 7 }),
    env: TEST_ENV,
    clock: () => NOW,
    providers: {
      privy: {
        async deleteUser() { return { outcome: 'already_absent' }; },
      },
    },
  });

  assert.equal(result.outcome, 'manual_review');
  assert.equal(result.haltCycle, false);
  const transition = updates.at(-1);
  assert.equal(assignedValue(transition, 'state'), 'MANUAL_REVIEW');
  assert.equal(assignedValue(transition, 'lastErrorCode'), 'privy_deletion_unproven');
  assert.equal(assignedValue(transition, 'privyDeletedAt'), undefined);
});

test('an injected proven Apple revocation advances without exposing provider identity to the adapter', async () => {
  const { db, updates } = transitionDb();
  let input;
  const result = await processClaimedAccountDeletion({
    db,
    request: claimedRequest('LOCAL_PURGED', { attemptCount: 3 }),
    clock: () => NOW,
    providers: {
      apple: {
        async resolve(value) { input = value; return { outcome: 'revoked' }; },
      },
    },
  });
  assert.deepEqual(input, { requestId: 'deletion_request_1', attemptCount: 3 });
  assert.equal(JSON.stringify(input).includes(PRIVY_DID), false);
  assert.equal(result.toState, 'APPLE_REVOKED');
  const transition = updates.at(-1);
  assert.equal(assignedValue(transition, 'appleRevokedAt'), NOW);
  assert.equal(assignedValue(transition, 'attemptCount'), 0);
  assert.equal(assignedValue(transition, 'nextAttemptAt'), null);
});

test('completion clears decryptable provider identity only after PRIVY_DELETED', async () => {
  const { db, updates } = transitionDb();
  let providerCalls = 0;
  const result = await processClaimedAccountDeletion({
    db,
    request: claimedRequest('PRIVY_DELETED'),
    clock: () => NOW,
    providers: {
      apple: { async resolve() { providerCalls += 1; } },
      privy: { async deleteUser() { providerCalls += 1; } },
    },
  });

  assert.equal(result.outcome, 'completed');
  assert.equal(providerCalls, 0);
  assert.equal(assignedValue(updates[0], 'state'), 'COMPLETED');
  assert.equal(assignedValue(updates[0], 'privyDidCiphertext'), null);
  assert.equal(assignedValue(updates[0], 'encryptionKeyVersion'), null);
  assert.equal(assignedValue(updates[0], 'completedAt'), NOW);
});

test('production Apple resolution fails closed and remains retryable without mass manual review', async () => {
  const { db, updates } = transitionDb();
  const failure = new AccountDeletionProviderError('apple_disposition_not_implemented', {
    retryable: true,
    global: true,
    statusClass: 'configuration',
  });
  const result = await processClaimedAccountDeletion({
    db,
    request: claimedRequest('LOCAL_PURGED', { attemptCount: 99 }),
    clock: () => NOW,
    random: () => 1,
    providers: { apple: { async resolve() { throw failure; } } },
  });

  assert.equal(result.outcome, 'retry_scheduled');
  assert.equal(result.haltCycle, true);
  const retry = updates.at(-1);
  assert.equal(assignedValue(retry, 'state'), undefined);
  assert.equal(assignedValue(retry, 'manualReviewAt'), undefined);
  assert.equal(retryDelayValue(retry), 21_599_999);
  assert.match(retry.sql, /"nextAttemptAt" = CURRENT_TIMESTAMP/u);
  assert.equal(assignedValue(retry, 'lastErrorAt'), NOW);
});

test('retry scheduling uses a database-relative delay under past and future client clocks', async () => {
  const observed = [];
  for (const clientNow of [
    new Date('1970-01-01T00:00:00.000Z'),
    new Date('2099-01-01T00:00:00.000Z'),
  ]) {
    const { db, updates } = transitionDb();
    const result = await processClaimedAccountDeletion({
      db,
      request: claimedRequest('APPLE_REVOKED'),
      env: TEST_ENV,
      clock: () => clientNow,
      random: () => 0.5,
      providers: {
        privy: {
          async deleteUser() {
            throw new AccountDeletionProviderError('privy_unavailable', {
              retryable: true,
              statusClass: '5xx',
            });
          },
        },
      },
    });
    const retry = updates.at(-1);
    assert.equal(result.outcome, 'retry_scheduled');
    assert.equal(retryDelayValue(retry), 15_000);
    assert.equal(assignedValue(retry, 'nextAttemptAt'), undefined);
    assert.match(
      retry.sql,
      /"nextAttemptAt" = CURRENT_TIMESTAMP \+ \(\$1::integer \* INTERVAL '1 millisecond'\)/u,
    );
    observed.push(retryDelayValue(retry));
  }
  assert.deepEqual(observed, [15_000, 15_000]);
});

test('row corruption goes to MANUAL_REVIEW without making a provider call', async () => {
  const { db, updates } = transitionDb();
  let providerCalls = 0;
  const result = await processClaimedAccountDeletion({
    db,
    request: claimedRequest('APPLE_REVOKED', { privyDidCiphertext: null }),
    env: TEST_ENV,
    clock: () => NOW,
    providers: {
      privy: { async deleteUser() { providerCalls += 1; } },
    },
  });

  assert.equal(providerCalls, 0);
  assert.equal(result.outcome, 'manual_review');
  assert.equal(assignedValue(updates[0], 'state'), 'MANUAL_REVIEW');
  assert.equal(
    assignedValue(updates[0], 'lastErrorCode'),
    'account_deletion_provider_subject_missing',
  );
  assert.equal(assignedValue(updates[0], 'privyDidCiphertext'), undefined);
});

test('a subject hash mismatch is isolated to MANUAL_REVIEW instead of globally halting cleanup', async () => {
  const { db, updates } = transitionDb();
  const mismatchedHash = 'f'.repeat(64);
  const mismatchedCiphertext = encryptAccountDeletionSubject(
    PRIVY_DID,
    mismatchedHash,
    TEST_ENV,
    { bytes: (length) => Buffer.alloc(length, 10) },
  );
  let providerCalls = 0;
  const result = await processClaimedAccountDeletion({
    db,
    request: claimedRequest('APPLE_REVOKED', {
      subjectHash: mismatchedHash,
      privyDidCiphertext: mismatchedCiphertext,
    }),
    env: TEST_ENV,
    clock: () => NOW,
    providers: {
      privy: { async deleteUser() { providerCalls += 1; } },
    },
  });

  assert.equal(providerCalls, 0);
  assert.equal(result.outcome, 'manual_review');
  assert.equal(result.haltCycle, false);
  assert.equal(assignedValue(updates[0], 'state'), 'MANUAL_REVIEW');
  assert.equal(
    assignedValue(updates[0], 'lastErrorCode'),
    'account_deletion_subject_hash_mismatch',
  );
});

test('a retryable row failure becomes MANUAL_REVIEW only after the per-stage budget', async () => {
  const { db, updates } = transitionDb();
  const result = await processClaimedAccountDeletion({
    db,
    request: claimedRequest('APPLE_REVOKED', { attemptCount: 8 }),
    env: TEST_ENV,
    clock: () => NOW,
    providers: {
      privy: {
        async deleteUser() {
          throw new AccountDeletionProviderError('privy_unavailable', {
            retryable: true,
            statusClass: '5xx',
          });
        },
      },
    },
  });

  assert.equal(result.outcome, 'manual_review');
  const transition = updates.at(-1);
  assert.equal(assignedValue(transition, 'state'), 'MANUAL_REVIEW');
  assert.equal(assignedValue(transition, 'lastErrorCode'), 'privy_unavailable');
});

test('a stale lease is rejected by the database before either external provider call', async () => {
  for (const state of ['LOCAL_PURGED', 'APPLE_REVOKED']) {
    const { db, updates } = transitionDb({ count: 0 });
    let providerCalls = 0;
    const result = await processClaimedAccountDeletion({
      db,
      request: claimedRequest(state),
      env: TEST_ENV,
      clock: () => new Date('1970-01-01T00:00:00.000Z'),
      providers: {
        apple: {
          async resolve() { providerCalls += 1; return { outcome: 'revoked' }; },
        },
        privy: {
          async deleteUser() { providerCalls += 1; return { outcome: 'deleted' }; },
        },
      },
    });

    assert.equal(providerCalls, 0);
    assert.equal(updates.length, 1);
    assert.equal(result.outcome, 'lease_lost');
    assert.equal(result.toState, undefined);
    assert.match(updates[0].sql, /"leaseExpiresAt" > CURRENT_TIMESTAMP/u);
    assert.match(
      updates[0].sql,
      /"leaseExpiresAt" = CURRENT_TIMESTAMP\s*\+ \(\$1::integer \* INTERVAL '1 millisecond'\)/u,
    );
  }
});

test('worker logging is allowlisted and excludes every identity, digest, ciphertext, and lease', async () => {
  const { db } = transitionDb();
  const chunks = [];
  const logger = {
    warn(fields, message) { chunks.push(JSON.stringify({ fields, message })); },
    error(fields, message) { chunks.push(JSON.stringify({ fields, message })); },
    info(fields, message) { chunks.push(JSON.stringify({ fields, message })); },
  };
  await processClaimedAccountDeletion({
    db,
    request: claimedRequest('APPLE_REVOKED'),
    env: TEST_ENV,
    clock: () => NOW,
    logger,
    providers: {
      privy: {
        async deleteUser() {
          throw new AccountDeletionProviderError('privy_request_rejected', {
            retryable: false,
            statusClass: '4xx',
          });
        },
      },
    },
  });
  const output = chunks.join('');
  for (const secret of [
    PRIVY_DID,
    SUBJECT_HASH,
    KEY_FINGERPRINT,
    CIPHERTEXT,
    'a'.repeat(64),
  ]) assert.equal(output.includes(secret), false);
  assert.equal(output.includes('privy_request_rejected'), true);
});

test('repeated interval waits remove abort listeners after timeout and abort', async () => {
  const listeners = new Set();
  let added = 0;
  let removed = 0;
  const signal = {
    aborted: false,
    addEventListener(type, listener) {
      assert.equal(type, 'abort');
      added += 1;
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      assert.equal(type, 'abort');
      removed += 1;
      listeners.delete(listener);
    },
    abort() {
      this.aborted = true;
      for (const listener of [...listeners]) listener();
    },
  };

  for (let index = 0; index < 32; index += 1) {
    await abortableWait(0, signal);
    assert.equal(listeners.size, 0);
  }

  const pending = abortableWait(60_000, signal);
  assert.equal(listeners.size, 1);
  signal.abort();
  signal.abort();
  await pending;
  assert.equal(listeners.size, 0);
  await abortableWait(60_000, signal);
  assert.equal(listeners.size, 0);
  assert.equal(added, 33);
  assert.equal(removed, 33);
});
