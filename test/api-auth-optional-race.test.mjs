import assert from 'node:assert/strict';
import test from 'node:test';

import {
  API_AUTH_ERROR_CODES,
  ApiAuthBindingError,
  createApiAuthRegistry,
} from '../utils/apiAuth.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function hasCode(code) {
  return (error) => {
    assert.equal(error instanceof ApiAuthBindingError, true);
    assert.equal(error.code, code);
    return true;
  };
}

function accessTokenFor(subject) {
  const payload = Buffer.from(JSON.stringify({ sub: subject }), 'utf8').toString('base64url');
  return `header.${payload}.signature`;
}

test('optional auth aborts when a deferred owner A provider returns owner B token after rebinding', async () => {
  const registry = createApiAuthRegistry();
  const tokenRead = deferred();
  let currentToken = accessTokenFor('privy:owner-a');
  const provider = async () => {
    await tokenRead.promise;
    return currentToken;
  };

  registry.setTokenProvider(provider, 'privy:owner-a');
  const pendingHeader = registry.resolveOptionalAuthHeader();

  currentToken = accessTokenFor('privy:owner-b');
  registry.setTokenProvider(provider, 'privy:owner-b');
  tokenRead.resolve();

  await assert.rejects(
    pendingHeader,
    hasCode(API_AUTH_ERROR_CODES.SESSION_CHANGED),
  );
});

test('optional auth aborts a deferred owner A provider failure after owner B is bound', async () => {
  const diagnostics = [];
  const registry = createApiAuthRegistry({
    onOptionalProviderError: (error) => diagnostics.push(error.message),
  });
  const tokenRead = deferred();
  const ownerAProvider = () => tokenRead.promise;

  registry.setTokenProvider(ownerAProvider, 'privy:owner-a');
  const pendingHeader = registry.resolveOptionalAuthHeader();

  registry.setTokenProvider(async () => accessTokenFor('privy:owner-b'), 'privy:owner-b');
  tokenRead.reject(new Error('stale owner A provider failed'));

  await assert.rejects(
    pendingHeader,
    hasCode(API_AUTH_ERROR_CODES.SESSION_CHANGED),
  );
  assert.deepEqual(diagnostics, []);
});

test('optional auth validates a token subject whenever the provider has an owner binding', async () => {
  const registry = createApiAuthRegistry();
  const ownerAToken = accessTokenFor('privy:owner-a');

  registry.setTokenProvider(async () => ownerAToken, 'privy:owner-a');
  assert.deepEqual(await registry.resolveOptionalAuthHeader(), {
    Authorization: `Bearer ${ownerAToken}`,
  });

  registry.setTokenProvider(
    async () => accessTokenFor('privy:owner-b'),
    'privy:owner-a',
  );
  await assert.rejects(
    registry.resolveOptionalAuthHeader(),
    hasCode(API_AUTH_ERROR_CODES.TOKEN_OWNER_MISMATCH),
  );
});

test('optional auth keeps anonymous and unchanged provider failures fail-soft', async () => {
  const diagnostics = [];
  const registry = createApiAuthRegistry({
    onOptionalProviderError: (error) => diagnostics.push(error.message),
  });

  assert.deepEqual(await registry.resolveOptionalAuthHeader(), {});

  registry.setTokenProvider(async () => {
    throw new Error('provider offline');
  }, 'privy:owner-a');
  assert.deepEqual(await registry.resolveOptionalAuthHeader(), {});
  assert.deepEqual(diagnostics, ['provider offline']);

  registry.setTokenProvider(async () => 'legacy-opaque-token');
  assert.deepEqual(await registry.resolveOptionalAuthHeader(), {
    Authorization: 'Bearer legacy-opaque-token',
  });
});
