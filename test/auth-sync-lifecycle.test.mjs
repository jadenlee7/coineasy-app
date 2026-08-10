import assert from 'node:assert/strict';
import test from 'node:test';

import {
  apiTokenProviderFor,
  createAuthSyncLifecycle,
} from '../hooks/authSyncLifecycle.mjs';

test('same getAccessToken identity can be reconnected after logout', async () => {
  let tokenReads = 0;
  const getAccessToken = async () => `token-${++tokenReads}`;

  const firstProvider = apiTokenProviderFor({
    authenticated: true,
    userId: 'did:privy:user-1',
    getAccessToken,
  });
  assert.equal(await firstProvider(), 'token-1');

  assert.equal(
    apiTokenProviderFor({ authenticated: false, userId: null, getAccessToken }),
    null,
  );

  const reconnectedProvider = apiTokenProviderFor({
    authenticated: true,
    userId: 'did:privy:user-1',
    getAccessToken,
  });
  assert.notEqual(reconnectedProvider, firstProvider);
  assert.equal(await reconnectedProvider(), 'token-2');
});

test('logout and same-user re-login create distinct sync transitions', () => {
  const lifecycle = createAuthSyncLifecycle();

  const firstLogin = lifecycle.observe({
    ready: true,
    authenticated: true,
    userId: 'did:privy:user-1',
  });
  assert.equal(firstLogin.sessionChanged, true);
  assert.equal(lifecycle.claimAutomaticSync(firstLogin.transitionKey), true);

  const logout = lifecycle.observe({ ready: true, authenticated: false, userId: null });
  assert.equal(logout.active, false);
  assert.equal(lifecycle.isCurrent(firstLogin.transitionKey), false);

  const secondLogin = lifecycle.observe({
    ready: true,
    authenticated: true,
    userId: 'did:privy:user-1',
  });
  assert.notEqual(secondLogin.transitionKey, firstLogin.transitionKey);
  assert.equal(lifecycle.claimAutomaticSync(secondLogin.transitionKey), true);
});

test('one transition can claim only one automatic sync attempt', () => {
  const lifecycle = createAuthSyncLifecycle();
  const transition = lifecycle.observe({
    ready: true,
    authenticated: true,
    userId: 'did:privy:user-1',
  });

  assert.equal(lifecycle.claimAutomaticSync(transition.transitionKey), true);
  assert.equal(lifecycle.claimAutomaticSync(transition.transitionKey), false);

  // A failed request can rerender or readiness can flicker, but neither opens
  // another automatic attempt and therefore cannot create an infinite retry.
  lifecycle.observe({ ready: false, authenticated: true, userId: 'did:privy:user-1' });
  const readyAgain = lifecycle.observe({
    ready: true,
    authenticated: true,
    userId: 'did:privy:user-1',
  });
  assert.equal(readyAgain.transitionKey, transition.transitionKey);
  assert.equal(lifecycle.claimAutomaticSync(readyAgain.transitionKey), false);
});

test('an account change invalidates stale work and permits one new sync', () => {
  const lifecycle = createAuthSyncLifecycle();
  const firstUser = lifecycle.observe({
    ready: true,
    authenticated: true,
    userId: 'did:privy:user-1',
  });
  assert.equal(lifecycle.claimAutomaticSync(firstUser.transitionKey), true);

  const secondUser = lifecycle.observe({
    ready: true,
    authenticated: true,
    userId: 'did:privy:user-2',
  });
  assert.equal(secondUser.sessionChanged, true);
  assert.equal(lifecycle.isCurrent(firstUser.transitionKey), false);
  assert.equal(lifecycle.claimAutomaticSync(secondUser.transitionKey), true);
  assert.equal(lifecycle.claimAutomaticSync(secondUser.transitionKey), false);
});

test('readiness gates initial sync without creating a second transition', () => {
  const lifecycle = createAuthSyncLifecycle();
  const waiting = lifecycle.observe({
    ready: false,
    authenticated: true,
    userId: 'did:privy:user-1',
  });
  assert.equal(waiting.canAutoSync, false);
  assert.equal(lifecycle.claimAutomaticSync(waiting.transitionKey), false);

  const ready = lifecycle.observe({
    ready: true,
    authenticated: true,
    userId: 'did:privy:user-1',
  });
  assert.equal(ready.transitionKey, waiting.transitionKey);
  assert.equal(lifecycle.claimAutomaticSync(ready.transitionKey), true);
});
