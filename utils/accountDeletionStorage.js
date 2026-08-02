import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import {
  createAccountDeletionMarkerStore,
} from './accountDeletionMarker.mjs';

const SECURE_STORE_OPTIONS = Object.freeze({
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
});

const secureStorage = Object.freeze({
  getItem: (key) => SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS),
  removeItem: (key) => SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS),
});

async function hashAccountDeletionSubject(userId) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId,
  );
}

export const accountDeletionMarkerStore = createAccountDeletionMarkerStore({
  storage: secureStorage,
  hashSubject: hashAccountDeletionSubject,
});

export function createAccountDeletionClientRequestId() {
  return Crypto.randomUUID();
}
