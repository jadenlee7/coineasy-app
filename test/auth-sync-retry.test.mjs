import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTransitionSingleFlight,
  profileFromAuthSyncResult,
  runAuthSyncWithRetries,
  safeAuthSyncError,
} from '../hooks/authSyncLifecycle.mjs';

test('transient auth sync failures retry only within the finite delay budget', async () => {
  let calls = 0;
  const waits = [];
  const outcome = await runAuthSyncWithRetries({
    transitionKey: '1:did:privy:user-1',
    isCurrent: () => true,
    retryDelaysMs: [10, 20, 30],
    wait: async (delay) => { waits.push(delay); },
    syncProfile: async () => {
      calls += 1;
      if (calls < 4) throw Object.assign(new Error('not ready'), { status: 401 });
      return { user: { id: 'user-1' }, orangeBalance: 100 };
    },
  });

  assert.equal(outcome.status, 'success');
  assert.equal(outcome.attempts, 4);
  assert.equal(calls, 4);
  assert.deepEqual(waits, [10, 20, 30]);
});

test('a terminal auth sync failure does not loop and exposes no raw payload', async () => {
  let calls = 0;
  const rawError = Object.assign(new Error('email=user@example.test token=secret'), {
    status: 400,
    body: { email: 'user@example.test', token: 'secret' },
  });
  const outcome = await runAuthSyncWithRetries({
    transitionKey: '1:did:privy:user-1',
    isCurrent: () => true,
    retryDelaysMs: [0, 0, 0],
    wait: async () => {},
    syncProfile: async () => {
      calls += 1;
      throw rawError;
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(outcome.error, {
    code: 'http_400',
    status: 400,
    retryable: false,
  });
  assert.equal(JSON.stringify(outcome).includes('user@example.test'), false);
  assert.equal(JSON.stringify(outcome).includes('secret'), false);
  assert.deepEqual(safeAuthSyncError(new TypeError('Network request failed')), {
    code: 'network_unavailable',
    status: null,
    retryable: true,
  });
});

test('logout or account change during retry wait prevents another request', async () => {
  let current = true;
  let calls = 0;
  const outcome = await runAuthSyncWithRetries({
    transitionKey: '1:did:privy:user-1',
    isCurrent: () => current,
    retryDelaysMs: [10, 20],
    wait: async () => { current = false; },
    syncProfile: async () => {
      calls += 1;
      throw new TypeError('Network request failed');
    },
  });

  assert.equal(outcome.status, 'stale');
  assert.equal(calls, 1);
  assert.equal(outcome.result, null);
});

test('a response that becomes stale in flight cannot be published', async () => {
  let current = true;
  const outcome = await runAuthSyncWithRetries({
    transitionKey: '1:did:privy:user-1',
    isCurrent: () => current,
    syncProfile: async () => {
      current = false;
      return { user: { id: 'stale-user' }, orangeBalance: 100 };
    },
  });

  assert.deepEqual(outcome, { status: 'stale', attempts: 1, result: null });
});

test('same-transition concurrent callers share one logical sync operation', async () => {
  const singleFlight = createTransitionSingleFlight();
  let calls = 0;
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const operation = async () => {
    calls += 1;
    await blocked;
    return 'synced';
  };

  const first = singleFlight.run('1:did:privy:user-1', operation);
  const duplicate = singleFlight.run('1:did:privy:user-1', operation);
  assert.equal(first, duplicate);
  release();
  assert.equal(await first, 'synced');
  assert.equal(calls, 1);

  // A settled operation is still the only operation for this transition.
  assert.equal(await singleFlight.run('1:did:privy:user-1', operation), 'synced');
  assert.equal(calls, 1);

  assert.equal(await singleFlight.run('2:did:privy:user-1', operation), 'synced');
  assert.equal(calls, 2);
});

test('an explicit same-transition resync can recover after bounded failure', async () => {
  const singleFlight = createTransitionSingleFlight();
  let calls = 0;
  const operation = async () => {
    calls += 1;
    return calls === 1 ? null : 'recovered';
  };

  assert.equal(await singleFlight.run('1:did:privy:user-1', operation), null);
  assert.equal(await singleFlight.run('1:did:privy:user-1', operation), 'recovered');
  assert.equal(await singleFlight.run('1:did:privy:user-1', operation), 'recovered');
  assert.equal(calls, 2);
});

test('auth sync response retains top-level orangeBalance with the user profile', () => {
  assert.deepEqual(profileFromAuthSyncResult({
    user: { id: 'user-1', displayName: 'EasyGo' },
    orangeBalance: 100,
  }), {
    id: 'user-1',
    displayName: 'EasyGo',
    orangeBalance: 100,
  });
  assert.deepEqual(profileFromAuthSyncResult({
    user: { id: 'user-2' },
    orangeBalance: 0,
  }), {
    id: 'user-2',
    orangeBalance: 0,
  });
  assert.deepEqual(profileFromAuthSyncResult({ user: { id: 'user-3' } }), { id: 'user-3' });
});
