import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  authenticatedUiIsGated,
  authBridgeHasProviderScope,
  expoPublicEnvInliningIsConfigured,
  iosReleaseUsesIsolatedJscRuntime,
  parseEnvText,
  privyAutomaticMigrationIsDisabled,
  privyEmbeddedWalletCreationIsConfigured,
  privyIsolationStagesAreGuarded,
  privyProviderUsesVersionedStorage,
  privyWebViewUsesSdkLoadContract,
  privyPolyfillsLoadFirst,
  releaseBufferAvoidsUnsupportedNativeBase64,
  singletonPrivyClientIsConfigured,
  startupDiagnosticPersistsPhases,
  startupDiagnosticReportsRuntime,
  startupBoundaryProtectsApp,
  startupKeepsOnePrivyProvider,
  targetFromArgs,
  validateMobileEnvironment,
  versionedLegalEnvironment,
  versionedPrivyStorageIsSafe,
} from '../scripts/mobile-preflight.mjs';

const appConfig = {
  expo: {
    version: '2.0.2',
    scheme: 'coineasyapp',
    ios: {
      bundleIdentifier: 'com.coineasy.coineasysocial',
      buildNumber: '99',
      jsEngine: 'jsc',
      usesAppleSignIn: true,
    },
    android: { package: 'com.coineasy.coineasy' },
    runtimeVersion: { policy: 'appVersion' },
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

test('EAS profiles cannot bypass the intended preflight target', () => {
  assert.equal(targetFromArgs([], {}), 'local');
  assert.equal(targetFromArgs([], { EASYGO_DEPLOY_TARGET: 'production' }), 'production');
  assert.equal(
    targetFromArgs(['--target=staging'], { EASYGO_DEPLOY_TARGET: 'production' }),
    'staging',
  );
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
  assert.equal(
    ready.warnings.some((item) => item.name === 'EasyGo privacy policy URL'),
    true,
  );
});

test('legal policy configuration is fail-closed and mandatory for production', () => {
  assert.deepEqual(versionedLegalEnvironment({}), {
    consentVersion: '',
    privacyUrl: '',
    termsUrl: '',
    versionValid: false,
    privacyUrlValid: false,
    termsUrlValid: false,
  });

  const baseEnv = {
    EXPO_PUBLIC_PRIVY_APP_ID: 'app-id',
    EXPO_PUBLIC_PRIVY_CLIENT_ID: 'client-id',
    EXPO_PUBLIC_BACKEND_URL: 'https://api.easygo.example',
  };
  const missing = validateMobileEnvironment(baseEnv, appConfig, { target: 'production' });
  assert.equal(
    missing.errors.some((item) => item.name === 'EasyGo consent document version'),
    true,
  );

  const insecure = validateMobileEnvironment({
    ...baseEnv,
    EXPO_PUBLIC_EASYGO_CONSENT_VERSION: '2026-08-02-v1',
    EXPO_PUBLIC_EASYGO_PRIVACY_URL: 'http://easygo.example/privacy',
    EXPO_PUBLIC_EASYGO_TERMS_URL: 'https://easygo.example/terms',
  }, appConfig, { target: 'staging' });
  assert.equal(
    insecure.errors.some((item) => item.name === 'EasyGo privacy policy URL'),
    true,
  );

  const configured = validateMobileEnvironment({
    ...baseEnv,
    EXPO_PUBLIC_EASYGO_CONSENT_VERSION: '2026-08-02-v1',
    EXPO_PUBLIC_EASYGO_PRIVACY_URL: 'https://easygo.example/privacy/2026-08-02-v1',
    EXPO_PUBLIC_EASYGO_TERMS_URL: 'https://easygo.example/terms/2026-08-02-v1',
  }, appConfig, { target: 'production' });
  assert.equal(
    configured.errors.some((item) => item.name.startsWith('EasyGo ')),
    false,
  );
});

test('staging preflight keeps the iOS JSC build on an isolated OTA runtime', () => {
  assert.equal(iosReleaseUsesIsolatedJscRuntime(appConfig), true);
  assert.equal(iosReleaseUsesIsolatedJscRuntime({
    expo: { ...appConfig.expo, version: '2.0.3' },
  }), true);
  assert.equal(iosReleaseUsesIsolatedJscRuntime({
    expo: { ...appConfig.expo, version: '2.0.1' },
  }), false);
  const result = validateMobileEnvironment({
    EXPO_PUBLIC_PRIVY_APP_ID: 'app-id',
    EXPO_PUBLIC_PRIVY_CLIENT_ID: 'client-id',
    EXPO_PUBLIC_BACKEND_URL: 'https://api.easygo.example',
  }, {
    expo: {
      ...appConfig.expo,
      ios: { ...appConfig.expo.ios, jsEngine: 'hermes' },
    },
  }, { target: 'staging' });
  assert.equal(
    result.errors.some((item) => item.name === 'iOS JSC runtime isolation'),
    true,
  );
  assert.equal(iosReleaseUsesIsolatedJscRuntime({
    expo: {
      ...appConfig.expo,
      ios: { ...appConfig.expo.ios, buildNumber: '96' },
    },
  }), false);
  assert.equal(iosReleaseUsesIsolatedJscRuntime({
    expo: {
      ...appConfig.expo,
      ios: { ...appConfig.expo.ios, buildNumber: '98beta' },
    },
  }), false);
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
  assert.equal(authenticatedUiIsGated(
    appSource.replace('<AppNavigator\n', '<AppNavigatorFake\n'),
  ), false);
  assert.equal(authenticatedUiIsGated(
    appSource.replace(': user && accountUiReady ? (', ': user ? ('),
  ), false);
  assert.equal(authenticatedUiIsGated(
    appSource.replace(
      /const accountUiReady = Boolean\([\s\S]*?\n\s*\);/,
      'const accountUiReady = true;',
    ),
  ), false);
  assert.equal(authenticatedUiIsGated(
    appSource.replace(
      'presentedOwner === deviceAccountData.ownerUserId',
      'presentedOwner !== deviceAccountData.ownerUserId',
    ),
  ), false);
  assert.equal(authenticatedUiIsGated(
    appSource.replace(
      "&& deviceAccountData.status === 'ready'",
      '',
    ),
  ), false);
  assert.equal(authenticatedUiIsGated(
    appSource.replace(
      "accountDeletionGuard.status !== 'clear' ? (",
      "accountDeletionGuard.status === 'blocked' ? (",
    ),
  ), false);
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

test('build 97 persists and user-gates every risky Privy startup phase', () => {
  const bootstrapSource = readFileSync(new URL('../BootstrapApp.js', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  const probeSource = readFileSync(new URL('../PrivyStartupProbe.js', import.meta.url), 'utf8');
  const clientSource = readFileSync(new URL('../utils/privyClient.js', import.meta.url), 'utf8');
  const storageSource = readFileSync(new URL('../utils/privyStorage.js', import.meta.url), 'utf8');

  assert.equal(startupDiagnosticPersistsPhases(bootstrapSource, probeSource), true);
  assert.equal(startupDiagnosticReportsRuntime(bootstrapSource, probeSource), true);
  assert.equal(probeSource.includes("setStage('client-create')"), false);
  assert.equal(probeSource.includes("stage === 'client-create'"), true);
  assert.equal(probeSource.includes("stage === 'client-initialize'"), true);
  assert.equal(probeSource.includes("stage === 'raw-webview'"), true);
  assert.equal(probeSource.includes("stage === 'provider-mount'"), true);
  assert.equal(privyIsolationStagesAreGuarded(probeSource), true);
  assert.equal(privyWebViewUsesSdkLoadContract(probeSource), true);
  assert.equal(privyIsolationStagesAreGuarded(`
    useEffect(() => initializeEasyGoPrivyClient(), []);
    <WebView source={{ uri }} />
  `), false);
  assert.equal(privyWebViewUsesSdkLoadContract(`
    const handleRawWebViewLoad = async () => {
      rawStageRef.current = 'loaded';
      await client.embeddedWallet.ping(5000);
      await props.onStatus({ step: 'privy-raw-webview', status: 'passed' });
      setStage('provider-mount');
    };
    <WebView onLoad={() => handleRawWebViewLoad(attempt)} />
  `), false);
  assert.equal(privyAutomaticMigrationIsDisabled(appSource, clientSource), true);
  assert.equal(privyAutomaticMigrationIsDisabled(probeSource, clientSource), true);
  assert.equal(privyEmbeddedWalletCreationIsConfigured(appSource, clientSource), true);
  assert.equal(privyEmbeddedWalletCreationIsConfigured(probeSource, clientSource), true);
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
  assert.equal(privyEmbeddedWalletCreationIsConfigured(`
    <PrivyProvider appId="example" config={EASYGO_PRIVY_CONFIG}>
      <App />
    </PrivyProvider>
  `, `
    export const EASYGO_BASE_CHAIN = { id: 8453 };
    export const EASYGO_PRIVY_CONFIG = {
      embedded: { ethereum: { createOnLogin: 'users-without-wallets' } },
    };
  `), false);
});

test('release bundling uses the Expo preset that inlines EXPO_PUBLIC values', () => {
  const babelSource = readFileSync(new URL('../babel.config.js', import.meta.url), 'utf8');
  const packageConfig = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  assert.equal(expoPublicEnvInliningIsConfigured(babelSource), true);
  assert.equal(
    releaseBufferAvoidsUnsupportedNativeBase64(babelSource, packageConfig),
    true,
  );
  assert.equal(expoPublicEnvInliningIsConfigured(`
    module.exports = { presets: ['module:metro-react-native-babel-preset'] };
  `), false);
  assert.equal(releaseBufferAvoidsUnsupportedNativeBase64(`
    module.exports = {
      plugins: [['module-resolver', {
        alias: { buffer: '@craftzdog/react-native-buffer' },
      }]],
    };
  `, {
    dependencies: { '@craftzdog/react-native-buffer': '^6.0.5' },
  }), false);
});
