import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOUNT_DELETION_MARKER_PHASE,
  accountDeletionMarkerStorageKey,
  createAccountDeletionMarkerStore,
  parseAccountDeletionMarker,
} from '../utils/accountDeletionMarker.mjs';
import {
  canConfirmAccountDeletion,
  reconcileAccountDeletionStatus,
  submitAccountDeletionRequest,
} from '../utils/accountDeletionFlow.mjs';
import {
  accountDeletionLocalDataKeys,
  purgeAccountDeletionLocalData,
} from '../utils/accountDeletionLocalData.mjs';

const USER_A = 'did:privy:user-a';
const USER_B = 'did:privy:user-b';
const SUBJECT_A = 'a'.repeat(64);
const SUBJECT_B = 'b'.repeat(64);
const CLIENT_A = '11111111-1111-4111-8111-111111111111';
const CLIENT_B = '22222222-2222-4222-8222-222222222222';
const FIXED_NOW = new Date('2026-08-02T12:00:00.000Z');

function memoryStore({ failWrites = false, events = [] } = {}) {
  const values = new Map();
  return {
    values,
    storage: {
      async getItem(key) {
        events.push(['get', key]);
        return values.get(key) ?? null;
      },
      async setItem(key, value) {
        events.push(['set', key]);
        if (failWrites) throw new Error('keychain unavailable');
        values.set(key, value);
      },
      async removeItem(key) {
        events.push(['remove', key]);
        values.delete(key);
      },
    },
  };
}

function markerStore(options = {}) {
  const memory = memoryStore(options);
  return {
    ...memory,
    markerStore: createAccountDeletionMarkerStore({
      storage: memory.storage,
      hashSubject: async (userId) => userId === USER_A ? SUBJECT_A : SUBJECT_B,
      now: () => FIXED_NOW,
    }),
  };
}

test('only a missing marker is clear; corrupt or mismatched data fails closed', async () => {
  assert.equal(parseAccountDeletionMarker(null), null);
  assert.throws(() => parseAccountDeletionMarker('{'), /account_deletion_marker_invalid/);
  assert.throws(
    () => parseAccountDeletionMarker('x'.repeat(1_025)),
    /account_deletion_marker_invalid/,
  );

  const { markerStore: store, values } = markerStore();
  assert.deepEqual(await store.load(USER_A), {
    status: 'clear',
    marker: null,
    subjectKey: SUBJECT_A,
  });
  values.set(accountDeletionMarkerStorageKey(SUBJECT_A), JSON.stringify({ version: 99 }));
  await assert.rejects(() => store.load(USER_A), /account_deletion_marker_invalid/);
});

test('the SecureStore key is a digest and markers stay isolated by account', async () => {
  const { markerStore: store, values } = markerStore();
  await store.begin({ userId: USER_A, clientRequestId: CLIENT_A });

  const storedKeys = [...values.keys()];
  assert.equal(storedKeys.length, 1);
  assert.equal(storedKeys[0].includes(USER_A), false);
  assert.match(storedKeys[0], new RegExp(`${SUBJECT_A}$`, 'u'));
  assert.equal(values.get(storedKeys[0]).includes(USER_A), false);

  assert.equal((await store.load(USER_A)).status, 'blocked');
  assert.deepEqual(await store.load(USER_B), {
    status: 'clear',
    marker: null,
    subjectKey: SUBJECT_B,
  });
});

test('a marker is durably written before the destructive request', async () => {
  const events = [];
  const { markerStore: store } = markerStore({ events });
  const result = await submitAccountDeletionRequest({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_A,
    walletRiskAcknowledged: true,
    request: async (clientRequestId) => {
      events.push(['request', clientRequestId]);
      return {
        requestId: 'delete_1',
        state: 'LOCAL_PURGED',
        localDataDeleted: true,
      };
    },
    purgeLocalData: async () => events.push(['purge']),
    logout: async () => events.push(['logout']),
  });

  assert.equal(result.status, 'accepted');
  assert.ok(events.findIndex(([name]) => name === 'set') < events.findIndex(([name]) => name === 'request'));
  assert.deepEqual(events.slice(-2), [['purge'], ['logout']]);
  const loaded = await store.load(USER_A);
  assert.equal(loaded.marker.phase, ACCOUNT_DELETION_MARKER_PHASE.accepted);
  assert.equal(loaded.marker.requestId, 'delete_1');
});

test('subscribers receive an immediate blocking event before SecureStore resolves', async () => {
  let releaseWrite;
  const written = new Map();
  const events = [];
  const store = createAccountDeletionMarkerStore({
    storage: {
      async getItem(key) { return written.get(key) ?? null; },
      async setItem(key, value) {
        events.push('write-started');
        await new Promise((resolve) => { releaseWrite = resolve; });
        written.set(key, value);
        events.push('write-finished');
      },
      async removeItem(key) { written.delete(key); },
    },
    hashSubject: async () => SUBJECT_A,
    now: () => FIXED_NOW,
  });
  store.subscribe((event) => events.push(event.type));

  const pending = store.begin({ userId: USER_A, clientRequestId: CLIENT_A });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events.slice(0, 2), ['blocking', 'write-started']);
  releaseWrite();
  await pending;
  assert.equal(events.includes('write-finished'), true);
  assert.equal(events.at(-1), 'changed');
});

test('a failed marker write prevents the destructive request', async () => {
  const { markerStore: store } = markerStore({ failWrites: true });
  let requests = 0;
  await assert.rejects(
    () => submitAccountDeletionRequest({
      markerStore: store,
      userId: USER_A,
      clientRequestId: CLIENT_A,
      walletRiskAcknowledged: true,
      request: async () => { requests += 1; },
    }),
    /account_deletion_marker_storage_unavailable/,
  );
  assert.equal(requests, 0);
});

test('an uncertain server outcome keeps the marker and bearer session for recovery', async () => {
  const { markerStore: store } = markerStore();
  let purges = 0;
  let logouts = 0;
  const result = await submitAccountDeletionRequest({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_A,
    walletRiskAcknowledged: true,
    request: async () => { throw new TypeError('network unavailable'); },
    purgeLocalData: async () => { purges += 1; },
    logout: async () => { logouts += 1; },
  });

  assert.deepEqual(result, {
    status: 'uncertain',
    code: 'account_deletion_status_unknown',
  });
  assert.equal((await store.load(USER_A)).marker.phase, 'requesting');
  assert.equal(purges, 0);
  assert.equal(logouts, 0);
});

test('a bare 410 tombstone stays requesting without purge or logout', async () => {
  const { markerStore: store } = markerStore();
  let purges = 0;
  let logouts = 0;
  const result = await submitAccountDeletionRequest({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_A,
    walletRiskAcknowledged: true,
    request: async () => {
      throw { status: 410, body: { error: 'account_deletion_in_progress' } };
    },
    purgeLocalData: async () => { purges += 1; },
    logout: async () => { logouts += 1; },
  });
  assert.deepEqual(result, {
    status: 'uncertain',
    code: 'account_deletion_status_unknown',
  });
  assert.equal((await store.load(USER_A)).marker.phase, 'requesting');
  assert.equal(purges, 0);
  assert.equal(logouts, 0);
});

test('GET MANUAL_REVIEW keeps a recovery marker and the bearer session intact', async () => {
  const { markerStore: store } = markerStore();
  await store.begin({
    userId: USER_A,
    clientRequestId: CLIENT_A,
    phase: ACCOUNT_DELETION_MARKER_PHASE.accepted,
    requestId: 'delete_old',
  });
  let purges = 0;
  let logouts = 0;

  const result = await reconcileAccountDeletionStatus({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_A,
    status: {
      requestId: 'delete_manual',
      state: 'MANUAL_REVIEW',
      localDataDeleted: false,
      completed: false,
    },
    purgeLocalData: async () => { purges += 1; },
    logout: async () => { logouts += 1; },
  });

  assert.deepEqual(result, {
    status: 'recovery',
    code: 'account_deletion_manual_review',
    requestId: 'delete_manual',
    state: 'MANUAL_REVIEW',
    localDataPurged: false,
    loggedOut: false,
  });
  const loaded = await store.load(USER_A);
  assert.equal(loaded.status, 'blocked');
  assert.equal(loaded.marker.phase, ACCOUNT_DELETION_MARKER_PHASE.requesting);
  assert.equal(loaded.marker.requestId, 'delete_manual');
  assert.equal(purges, 0);
  assert.equal(logouts, 0);
});

test('a 202 body without local purge proof remains uncertain and blocking', async () => {
  const { markerStore: store } = markerStore();
  let purges = 0;
  let logouts = 0;
  const result = await submitAccountDeletionRequest({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_A,
    walletRiskAcknowledged: true,
    request: async () => ({
      requestId: 'delete_manual',
      state: 'MANUAL_REVIEW',
      localDataDeleted: false,
    }),
    purgeLocalData: async () => { purges += 1; },
    logout: async () => { logouts += 1; },
  });

  assert.deepEqual(result, {
    status: 'uncertain',
    code: 'account_deletion_status_unknown',
  });
  assert.equal((await store.load(USER_A)).marker.phase, 'requesting');
  assert.equal(purges, 0);
  assert.equal(logouts, 0);
});

test('a 409 manual-review response records recovery without local cleanup', async () => {
  const { markerStore: store } = markerStore();
  let purges = 0;
  let logouts = 0;
  const result = await submitAccountDeletionRequest({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_A,
    walletRiskAcknowledged: true,
    request: async () => {
      throw {
        status: 409,
        body: {
          error: 'account_deletion_manual_review',
          requestId: 'delete_manual',
          state: 'MANUAL_REVIEW',
          localDataDeleted: false,
        },
      };
    },
    purgeLocalData: async () => { purges += 1; },
    logout: async () => { logouts += 1; },
  });

  assert.equal(result.status, 'recovery');
  assert.equal(result.state, 'MANUAL_REVIEW');
  const loaded = await store.load(USER_A);
  assert.equal(loaded.marker.phase, 'requesting');
  assert.equal(loaded.marker.requestId, 'delete_manual');
  assert.equal(purges, 0);
  assert.equal(logouts, 0);
});

test('confirmed deletion stays authenticated and blocked when local purge fails', async () => {
  const { markerStore: store } = markerStore();
  let logouts = 0;
  const result = await submitAccountDeletionRequest({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_A,
    walletRiskAcknowledged: true,
    request: async () => ({
      requestId: 'delete_1',
      state: 'LOCAL_PURGED',
      localDataDeleted: true,
    }),
    purgeLocalData: async () => { throw new Error('local purge failed'); },
    logout: async () => { logouts += 1; },
  });
  assert.equal(result.status, 'accepted');
  assert.equal(result.localDataPurged, false);
  assert.equal(result.loggedOut, false);
  assert.equal(logouts, 0);
  assert.equal((await store.load(USER_A)).marker.phase, 'accepted');
});

test('a malformed success response remains blocked and reuses the first UUID', async () => {
  const { markerStore: store } = markerStore();
  const seen = [];
  await store.begin({ userId: USER_A, clientRequestId: CLIENT_A });
  const result = await submitAccountDeletionRequest({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_B,
    walletRiskAcknowledged: true,
    request: async (clientRequestId) => {
      seen.push(clientRequestId);
      return { ok: true };
    },
  });
  assert.equal(result.status, 'uncertain');
  assert.deepEqual(seen, [CLIENT_A]);
  assert.equal((await store.load(USER_A)).marker.clientRequestId, CLIENT_A);
});

test('only a definitive pre-mutation 400 can release a requesting marker', async () => {
  const { markerStore: store } = markerStore();
  const result = await submitAccountDeletionRequest({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_A,
    walletRiskAcknowledged: true,
    request: async () => {
      throw { status: 400, body: { error: 'confirmation_required' } };
    },
  });
  assert.deepEqual(result, { status: 'rejected', code: 'confirmation_required' });
  assert.deepEqual(await store.load(USER_A), {
    status: 'clear',
    marker: null,
    subjectKey: SUBJECT_A,
  });
});

test('a 400 on a retried marker cannot erase a possibly accepted earlier request', async () => {
  const { markerStore: store } = markerStore();
  await store.begin({ userId: USER_A, clientRequestId: CLIENT_A });
  const result = await submitAccountDeletionRequest({
    markerStore: store,
    userId: USER_A,
    clientRequestId: CLIENT_B,
    walletRiskAcknowledged: true,
    request: async () => {
      throw { status: 400, body: { error: 'confirmation_required' } };
    },
  });
  assert.equal(result.status, 'uncertain');
  assert.equal((await store.load(USER_A)).marker.clientRequestId, CLIENT_A);
});

test('confirmation requires capability, wallet acknowledgement, exact text, and same owner', () => {
  const ready = {
    available: true,
    walletRiskAcknowledged: true,
    confirmationText: 'DELETE',
    expectedUserId: USER_A,
    currentUserId: USER_A,
  };
  assert.equal(canConfirmAccountDeletion(ready), true);
  assert.equal(canConfirmAccountDeletion({ ...ready, available: false }), false);
  assert.equal(canConfirmAccountDeletion({ ...ready, walletRiskAcknowledged: false }), false);
  assert.equal(canConfirmAccountDeletion({ ...ready, confirmationText: 'delete' }), false);
  assert.equal(canConfirmAccountDeletion({ ...ready, currentUserId: USER_B }), false);
});

test('local purge removes only the scoped account/device data keys', async () => {
  let removed;
  const keys = await purgeAccountDeletionLocalData({
    courseProgressOwner: USER_A,
    removeMany: async (value) => { removed = value; },
  });
  assert.deepEqual(keys, accountDeletionLocalDataKeys(USER_A));
  assert.deepEqual(removed, [
    `easygo_course_progress:${USER_A}`,
    'easygo_recent_profile_searches',
    'list_blocked_user',
    'list_muted_users',
    'list_hidden_post',
    'easygo_expo_push_token',
  ]);
  assert.equal(removed.includes('showNotificationDate'), false);
  assert.equal(removed.some((key) => key.startsWith('easygo-privy-v2-')), false);
});
