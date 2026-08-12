import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PUSH_TOKEN_REGISTRATION_READY,
  pushTokenRegistrationEnabled,
  unregisterPushTokenBeforeLogout,
} from '../utils/pushTokenRegistration.mjs';

function read(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('remote registration remains compile-time closed for the current privacy version', () => {
  assert.equal(PUSH_TOKEN_REGISTRATION_READY, false);
  assert.equal(pushTokenRegistrationEnabled({
    EXPO_PUBLIC_PUSH_TOKEN_REGISTRATION_ENABLED: 'true',
  }), false);
});

test('mobile registration is owner-bound and persists only after server acceptance', () => {
  const source = read('../components/modals/PushNotificationsModal.js');
  const remoteRegistration = source.indexOf('await api.registerPushToken({');
  const localPersistence = source.indexOf('await saveExpoPushToken(token)');

  assert.ok(remoteRegistration >= 0);
  assert.ok(localPersistence > remoteRegistration);
  assert.match(source, /expectedAuthUserId: expectedLease\.ownerUserId/);
  assert.match(source, /remoteRegistrationEnabled && registration\?\.registration\?\.registered !== true/);
  assert.match(source, /await api\.unregisterPushToken\(\{/);
  assert.doesNotMatch(source, /backend token registration ships/);
});

test('both ordinary sign-out paths use bounded owner-bound cleanup', () => {
  for (const path of [
    '../components/modals/SettingsModal.js',
    '../components/modals/SwitchAccountModal.js',
  ]) {
    const source = read(path);
    assert.match(source, /await unregisterPushTokenBeforeLogout\(\{/);
    assert.match(source, /ownerUserId: expected(?:Operation|Lease)\.ownerUserId/);
    assert.match(source, /unregister: api\.unregisterPushToken/);
    assert.match(source, /clearLocal: clearExpoPushToken/);
    assert.ok(source.indexOf('await unregisterPushTokenBeforeLogout({') < source.indexOf('await logout()'));
  }
});

test('dormant registration performs no logout network or local cleanup', async () => {
  let remoteCalls = 0;
  let localCalls = 0;
  const outcome = await unregisterPushTokenBeforeLogout({
    token: 'ExponentPushToken[test_token_123456]',
    ownerUserId: 'did:privy:owner',
    unregister: async () => { remoteCalls += 1; },
    clearLocal: async () => { localCalls += 1; },
    isCurrent: () => true,
  });
  assert.equal(outcome, 'skipped');
  assert.equal(remoteCalls, 0);
  assert.equal(localCalls, 0);
});

test('enabled logout cleanup is owner-bound and clears locally after remote success', async () => {
  let request;
  let localCalls = 0;
  const outcome = await unregisterPushTokenBeforeLogout({
    registrationEnabled: true,
    token: 'ExponentPushToken[test_token_123456]',
    ownerUserId: 'did:privy:owner',
    unregister: async (options) => { request = options; },
    clearLocal: async () => { localCalls += 1; return true; },
    isCurrent: () => true,
  });
  assert.equal(outcome, 'unregistered');
  assert.equal(request.expectedAuthUserId, 'did:privy:owner');
  assert.equal(request.signal instanceof AbortSignal, true);
  assert.equal(localCalls, 1);
});

test('unregister timeout fails soft and leaves the local token for a later retry', async () => {
  let localCalls = 0;
  const outcome = await unregisterPushTokenBeforeLogout({
    registrationEnabled: true,
    timeoutMs: 1,
    token: 'ExponentPushToken[test_token_123456]',
    ownerUserId: 'did:privy:owner',
    unregister: ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
    clearLocal: async () => { localCalls += 1; return true; },
    isCurrent: () => true,
  });
  assert.equal(outcome, 'failed');
  assert.equal(localCalls, 0);
});

test('the owner-scoped device store can clear its locally retained delivery address', () => {
  const source = read('../contexts/DeviceAccountDataContext.js');
  assert.match(source, /clearExpoPushToken:\s*\(\) => clearValue\(\s*lease,/);
  assert.match(source, /DEVICE_ACCOUNT_DATA_SLOT\.expoPushToken/);
  assert.match(source, /\[field\]: null/);
});
