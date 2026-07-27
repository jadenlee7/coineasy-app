import { SecureStorageAdapter } from '@privy-io/expo';

// Privy session keys live in iOS Keychain and survive an app reinstall. Keep
// authentication data in SecureStore while moving this release to a clean,
// versioned namespace so stale pre-EasyGo sessions cannot be restored.
export const EASYGO_PRIVY_STORAGE_PREFIX = 'easygo-privy-v2-';

export const easyGoPrivyStorage = Object.freeze({
  get: (key) => SecureStorageAdapter.get(`${EASYGO_PRIVY_STORAGE_PREFIX}${key}`),
  put: (key, value) => (
    SecureStorageAdapter.put(`${EASYGO_PRIVY_STORAGE_PREFIX}${key}`, value)
  ),
  del: (key) => SecureStorageAdapter.del(`${EASYGO_PRIVY_STORAGE_PREFIX}${key}`),
  getKeys: async () => [],
});
