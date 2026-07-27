import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  authenticatedUiIsGated,
  authBridgeHasProviderScope,
  expoPublicEnvInliningIsConfigured,
  parseEnvText,
  privyAutomaticMigrationIsDisabled,
  privyProviderUsesVersionedStorage,
  privyPolyfillsLoadFirst,
  singletonPrivyClientIsConfigured,
  startupDiagnosticPersistsPhases,
  startupBoundaryProtectsApp,
  startupKeepsOnePrivyProvider,
  validateMobileEnvironment,
  versionedPrivyStorageIsSafe,
} from '../scripts/mobile-preflight.mjs';

const appConfig = {
  expo: {
    scheme: 'coineasyapp',
    ios: { bundleIdentifier: 'com.coineasy.coineasysocial', usesAppleSignIn: true },
    android: { package: 'com.coineasy.coineasy' },
  },
};

test('env parser reads values without treating comments as configuration', () => {
  assert.deepEqual(parseEnvText(`
# comment
EXPO_PUBLIC_PRIVY_APP_ID=app-id
EXPO_PUBLIC_PRIVY_CLIENT_ID="client-id"
`), {
    EXPO_PUBLIC_PRIVY_APP_ID: 'app-id',
    EXPO_PUBLIC_PRIVY_CLIENT_ID: 'client-id',
  });
});

test('local preflight accepts Privy IDs but warns while backend is disconnected', () => {
  const result = validateMobileEnvironment({
    EXPO_PUBLIC_PRIVY_APP_ID: 'app-id',
    EXPO_PUBLIC_PRIVY_CLIENT_ID: 'client-id',
  }, appConfig);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.some((item) => item.name === 'backend URL'), true);
});

test('staging preflight requires an HTTPS backend and preserves native identity', () => {
  const missing = validateMobileEnvironment({
    EXPO_PUBLIC_PRIVY_APP_ID: 'app-id',
    EXPO_PUBLIC_PRIVY_CLIENT_ID: 'client-id',
  }, appConfig, { target: 'staging' });
  assert.equal(missing.errors.some((item) => item.name === 'backend URL'), true);

  const insecure = validateMobileEnvironment({
    EXPO_PUBLIC_PRIVY_APP_ID: 'app-id',
    EXPO_PUBLIC_PRIVY_CLIENT_ID: 'client-id',
    EXPO_PUBLIC_BACKEND_URL: 'http://api.easygo.example',
  }, appConfig, { target: 'staging' });
  assert.equal(insecure.errors.some((item) => item.name === 'backend URL format'), true);

  const ready = validateMobileEnvironment({
    EXPO_PUBLIC_PRIVY_APP_ID: 'app-id',
    EXPO_PUBLIC_PRIVY_CLIENT_ID: 'client-id',
    EXPO_PUBLIC_BACKEND_URL: 'https://api.easygo.example',
  }, appConfig, { target: 'staging' });
  assert.deepEqual(ready.errors, []);
});

test('native identifiers and scheme fail if the configured app identity drifts', () => {
  const result = validateMobileEnvironment({
    EXPO_PUBLIC_PRIVY_APP_ID: 'app-id',
    EXPO_PUBLIC_PRIVY_CLIENT_ID: 'client-id',
  }, {
    expo: {
      scheme: 'wrong',
      ios: { bundleIdentifier: 'com.example.wrong' },
      android: {},
    },
  });
  assert.equal(result.errors.some((item) => item.name === 'URL scheme'), true);
  assert.equal(result.errors.some((item) => item.name === 'iOS bundle identifier'), true);
  assert.equal(result.errors.some((item) => item.name === 'Android package'), true);
});

test('AuthBridge stays inside the state provider it writes to', () => {
  const appSource = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.equal(authBridgeHasProviderScope(appSource), true);
  assert.equal(authBridgeHasProviderScope(`
    <GlobalContext.Provider value={{}} />
    <AuthBridge />
  `), false);
});

test('startup failures are contained and authenticated UI stays off the login path', () => {
  const appSource = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.equal(startupBoundaryProtectsApp(appSource), true);
  assert.equal(authenticatedUiIsGated(appSource), true);
  assert.equal(startupBoundaryProtectsApp('<EasyGoApp />'), false);
  assert.equal(authenticatedUiIsGated('<Login /><PostboxModal />'), false);
});

test('Privy polyfills evaluate before the application module', () => {
  const bootstrapSource = readFileSync(new URL('../BootstrapApp.js', import.meta.url), 'utf8');
  assert.equal(privyPolyfillsLoadFirst(bootstrapSource), true);
  assert.equal(privyPolyfillsLoadFirst(`
    import('./App');
    import('fast-text-encoding');
    import('react-native-get-random-values');
    import('@ethersproject/shims');
  `), false);
});

test('build 94 persists risky startup phases and disables automatic wallet migration', () => {
  const bootstrapSource = readFileSync(new URL('../BootstrapApp.js', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  const probeSource = readFileSync(new URL('../PrivyStartupProbe.js', import.meta.url), 'utf8');
  const clientSource = readFileSync(new URL('../utils/privyClient.js', import.meta.url), 'utf8');
  const storageSource = readFileSync(new URL('../utils/privyStorage.js', import.meta.url), 'utf8');

  assert.equal(startupDiagnosticPersistsPhases(bootstrapSource), true);
  assert.equal(privyAutomaticMigrationIsDisabled(appSource), true);
  assert.equal(privyAutomaticMigrationIsDisabled(probeSource), true);
  assert.equal(privyProviderUsesVersionedStorage(appSource), true);
  assert.equal(privyProviderUsesVersionedStorage(probeSource), true);
  assert.equal(singletonPrivyClientIsConfigured(clientSource), true);
  assert.equal(versionedPrivyStorageIsSafe(storageSource), true);
  assert.equal(startupKeepsOnePrivyProvider(bootstrapSource, probeSource, appSource), true);
  assert.equal(privyAutomaticMigrationIsDisabled(`
    <PrivyProvider appId="example">
      <App />
    </PrivyProvider>
  `), false);
});

test('release bundling uses the Expo preset that inlines EXPO_PUBLIC values', () => {
  const babelSource = readFileSync(new URL('../babel.config.js', import.meta.url), 'utf8');
  assert.equal(expoPublicEnvInliningIsConfigured(babelSource), true);
  assert.equal(expoPublicEnvInliningIsConfigured(`
    module.exports = { presets: ['module:metro-react-native-babel-preset'] };
  `), false);
});
