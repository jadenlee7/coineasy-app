import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  PUSH_TOKEN_REGISTRATION_READY,
  pushTokenRegistrationEnabled,
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

test('both ordinary sign-out paths attempt an owner-bound remote unregister', () => {
  for (const path of [
    '../components/modals/SettingsModal.js',
    '../components/modals/SwitchAccountModal.js',
  ]) {
    const source = read(path);
    assert.match(source, /await api\.unregisterPushToken\(\{/);
    assert.match(source, /expectedAuthUserId: expected(?:Operation|Lease)\.ownerUserId/);
    assert.match(source, /await clearExpoPushToken\(\)/);
    assert.ok(source.indexOf('await api.unregisterPushToken({') < source.indexOf('await logout()'));
  }
});

test('the owner-scoped device store can clear its locally retained delivery address', () => {
  const source = read('../contexts/DeviceAccountDataContext.js');
  assert.match(source, /clearExpoPushToken:\s*\(\) => clearValue\(\s*lease,/);
  assert.match(source, /DEVICE_ACCOUNT_DATA_SLOT\.expoPushToken/);
  assert.match(source, /\[field\]: null/);
});
