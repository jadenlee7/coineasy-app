import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  authenticatedUiIsGated,
  authBridgeHasProviderScope,
  expoPublicEnvInliningIsConfigured,
  parseEnvText,
  privyPolyfillsLoadFirst,
  startupBoundaryProtectsApp,
  validateMobileEnvironment,
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
    await import('./App');
    await import('fast-text-encoding');
    await import('react-native-get-random-values');
    await import('@ethersproject/shims');
  `), false);
});

test('release bundling uses the Expo preset that inlines EXPO_PUBLIC values', () => {
  const babelSource = readFileSync(new URL('../babel.config.js', import.meta.url), 'utf8');
  assert.equal(expoPublicEnvInliningIsConfigured(babelSource), true);
  assert.equal(expoPublicEnvInliningIsConfigured(`
    module.exports = { presets: ['module:metro-react-native-babel-preset'] };
  `), false);
});
