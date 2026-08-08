import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AccountDeletionProviderError,
  classifyPrivyDeletionError,
  createFailClosedAppleDeletionProvider,
  createPrivyDeletionProvider,
} from '../src/lib/account-deletion-providers.js';

const PRIVATE_DID = 'did:privy:private-provider-test-user';

function failingClient(error) {
  return { async deleteUser() { throw error; } };
}

test('Privy deletion resolves a successful provider response without returning identity data', async () => {
  let receivedDid;
  const provider = createPrivyDeletionProvider({
    clientFactory: async () => ({
      async deleteUser(privyDid) { receivedDid = privyDid; },
    }),
    timeoutMs: 100,
  });

  const result = await provider.deleteUser({ privyDid: PRIVATE_DID, attemptCount: 1 });
  assert.equal(receivedDid, PRIVATE_DID);
  assert.deepEqual(result, { outcome: 'deleted' });
  assert.equal(JSON.stringify(result).includes(PRIVATE_DID), false);
});

test('every Privy 404 is unproven regardless of the generic claim attempt count', async () => {
  const raw = Object.assign(new Error(`DELETE /v1/users/${PRIVATE_DID}`), {
    status: 404,
    response: { body: { user: PRIVATE_DID } },
  });
  const provider = createPrivyDeletionProvider({
    clientFactory: async () => failingClient(raw),
    timeoutMs: 100,
  });

  for (const attemptCount of [1, 2, 99]) {
    await assert.rejects(
      () => provider.deleteUser({ privyDid: PRIVATE_DID, attemptCount }),
      (error) => {
        assert.equal(error.code, 'privy_absence_unproven');
        assert.equal(error.retryable, false);
        assert.equal(error.message.includes(PRIVATE_DID), false);
        assert.equal('cause' in error, false);
        return true;
      },
    );
  }
});

test('a prior retryable provider failure cannot make a later Privy 404 successful', async () => {
  let calls = 0;
  const provider = createPrivyDeletionProvider({
    clientFactory: async () => ({
      async deleteUser() {
        calls += 1;
        throw Object.assign(new Error(`provider failure ${PRIVATE_DID}`), {
          status: calls === 1 ? 503 : 404,
        });
      },
    }),
    timeoutMs: 100,
  });

  await assert.rejects(
    () => provider.deleteUser({ privyDid: PRIVATE_DID, attemptCount: 1 }),
    (error) => error.code === 'privy_unavailable' && error.retryable,
  );
  await assert.rejects(
    () => provider.deleteUser({ privyDid: PRIVATE_DID, attemptCount: 2 }),
    (error) => error.code === 'privy_absence_unproven' && !error.retryable,
  );
});

test('a prior configuration claim cannot make a post-restart Privy 404 successful', async () => {
  const beforeRestart = createPrivyDeletionProvider({
    clientFactory: async () => {
      const error = new Error(`bad configuration ${PRIVATE_DID}`);
      error.name = 'PrivyConfigurationError';
      throw error;
    },
    timeoutMs: 100,
  });
  await assert.rejects(
    () => beforeRestart.deleteUser({ privyDid: PRIVATE_DID, attemptCount: 1 }),
    (error) => error.code === 'privy_not_configured' && error.retryable && error.global,
  );

  const afterRestart = createPrivyDeletionProvider({
    clientFactory: async () => failingClient(Object.assign(new Error(PRIVATE_DID), {
      status: 404,
    })),
    timeoutMs: 100,
  });
  await assert.rejects(
    () => afterRestart.deleteUser({ privyDid: PRIVATE_DID, attemptCount: 2 }),
    (error) => error.code === 'privy_absence_unproven' && !error.retryable,
  );
});

test('credential failures are sanitized global failures that halt the cycle', async () => {
  for (const status of [401, 403]) {
    const raw = Object.assign(new Error(`credential leaked for ${PRIVATE_DID}`), {
      status,
      response: { data: { secret: 'provider-secret' } },
    });
    const failure = classifyPrivyDeletionError(raw);
    assert.equal(failure.code, 'privy_credentials_rejected');
    assert.equal(failure.retryable, true);
    assert.equal(failure.global, true);
    assert.equal(failure.haltCycle, true);
    assert.equal(JSON.stringify(failure).includes(PRIVATE_DID), false);
    assert.equal(JSON.stringify(failure).includes('provider-secret'), false);
  }
});

test('provider status classes map to bounded retry or permanent review without raw errors', () => {
  const rateLimit = classifyPrivyDeletionError({ status: 429, message: PRIVATE_DID });
  assert.equal(rateLimit.code, 'privy_rate_limited');
  assert.equal(rateLimit.retryable, true);
  assert.equal(rateLimit.haltCycle, true);

  const unavailable = classifyPrivyDeletionError({ status: 503, message: PRIVATE_DID });
  assert.equal(unavailable.code, 'privy_unavailable');
  assert.equal(unavailable.retryable, true);
  assert.equal(unavailable.haltCycle, true);

  const rejected = classifyPrivyDeletionError({ status: 400, message: PRIVATE_DID });
  assert.equal(rejected.code, 'privy_request_rejected');
  assert.equal(rejected.retryable, false);

  const network = classifyPrivyDeletionError(new Error(`socket failed ${PRIVATE_DID}`));
  assert.equal(network.code, 'privy_network_failure');
  assert.equal(network.retryable, true);
  assert.equal(network.message.includes(PRIVATE_DID), false);
});

test('provider initialization failures are sanitized and never retain the raw cause', async () => {
  const provider = createPrivyDeletionProvider({
    clientFactory: async () => {
      const error = new Error(`missing secret ${PRIVATE_DID}`);
      error.name = 'PrivyConfigurationError';
      throw error;
    },
    timeoutMs: 100,
  });
  await assert.rejects(
    () => provider.deleteUser({ privyDid: PRIVATE_DID, attemptCount: 1 }),
    (error) => {
      assert.equal(error.code, 'privy_not_configured');
      assert.equal(error.global, true);
      assert.equal(error.message.includes(PRIVATE_DID), false);
      assert.equal('cause' in error, false);
      return true;
    },
  );
});

test('Privy deletion has a bounded timeout and exposes only a safe retry code', async () => {
  const provider = createPrivyDeletionProvider({
    clientFactory: async () => ({
      async deleteUser() { return new Promise(() => {}); },
    }),
    timeoutMs: 5,
  });
  await assert.rejects(
    () => provider.deleteUser({ privyDid: PRIVATE_DID, attemptCount: 1 }),
    (error) => {
      assert.equal(error.code, 'privy_delete_timeout');
      assert.equal(error.retryable, true);
      assert.equal(error.haltCycle, true);
      assert.equal(error.message.includes(PRIVATE_DID), false);
      return true;
    },
  );
});

test('the production Apple adapter always fails closed without an explicit disposition', async () => {
  await assert.rejects(
    () => createFailClosedAppleDeletionProvider().resolve(),
    (error) => {
      assert.equal(error instanceof AccountDeletionProviderError, true);
      assert.equal(error.code, 'apple_disposition_not_implemented');
      assert.equal(error.global, true);
      assert.equal(error.retryable, true);
      return true;
    },
  );
});
