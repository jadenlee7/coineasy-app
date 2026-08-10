#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function clean(value) {
  return String(value || '').trim();
}

export function parseEnvText(text) {
  const result = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function authBridgeHasProviderScope(appSource) {
  const source = String(appSource || '');
  const providerOpen = source.indexOf('<GlobalContext.Provider');
  const bridge = source.indexOf('<AuthBridge');
  const providerClose = source.indexOf('</GlobalContext.Provider>');
  return providerOpen >= 0
    && bridge > providerOpen
    && providerClose > bridge;
}

export function startupBoundaryProtectsApp(appSource) {
  const source = String(appSource || '');
  const boundaryOpen = source.indexOf('<StartupErrorBoundary>');
  const app = source.indexOf('<EasyGoApp', boundaryOpen);
  const boundaryClose = source.indexOf('</StartupErrorBoundary>', app);
  return boundaryOpen >= 0 && app > boundaryOpen && boundaryClose > app;
}

export function authenticatedUiIsGated(appSource) {
  const source = String(appSource || '');
  const presentedOwnerDefinition = source.indexOf(
    'const presentedOwner = user?.profile?.data?.courseProgressOwner || null;',
  );
  const accountGateStart = source.indexOf('const accountUiReady = Boolean(');
  const accountGateEnd = source.indexOf(');', accountGateStart);
  const accountGate = accountGateStart >= 0 && accountGateEnd > accountGateStart
    ? source.slice(accountGateStart, accountGateEnd + 2)
    : '';
  const deletionGate = source.indexOf("accountDeletionGuard.status !== 'clear' ? (");
  const pendingScreen = source.indexOf('<AccountDeletionPending', deletionGate);
  const branchOpen = source.indexOf(': user && accountUiReady ? (', pendingScreen);
  const loginBranch = source.indexOf('<Login />', branchOpen);
  if (
    presentedOwnerDefinition < 0
    || accountGateStart < 0
    || !accountGate.includes('presentedOwner')
    || !accountGate.includes('presentedOwner === deviceAccountData.ownerUserId')
    || !accountGate.includes("deviceAccountData.status === 'ready'")
    || deletionGate < 0
    || pendingScreen <= deletionGate
    || branchOpen <= pendingScreen
    || loginBranch < 0
  ) return false;
  const authenticatedBranch = source.slice(branchOpen, loginBranch);
  return [
    'AppNavigator',
    'UpdateProfileModal',
    'NicknameModal',
    'PostboxModal',
  ].every((componentName) => (
    new RegExp(`<${componentName}(?:\\s|/?>)`, 'u').test(authenticatedBranch)
  ));
}

export function privyPolyfillsLoadFirst(bootstrapSource) {
  const source = String(bootstrapSource || '');
  const orderedImports = [
    "import('fast-text-encoding')",
    "import('react-native-get-random-values')",
    "import('@ethersproject/shims')",
  ];
  let cursor = -1;
  for (const statement of orderedImports) {
    const index = source.indexOf(statement, cursor + 1);
    if (index < 0) return false;
    cursor = index;
  }
  const appImport = source.indexOf("import('./App')", cursor + 1);
  return appImport > cursor;
}

export function startupDiagnosticPersistsPhases(bootstrapSource, probeSource) {
  const bootstrap = String(bootstrapSource || '');
  const source = `${bootstrap}\n${String(probeSource || '')}`;
  return [
    'easygo.startup-probe.v97',
    'AsyncStorage.setItem(STARTUP_STATE_KEY',
    "'privy-storage-roundtrip'",
    "'privy-client-create'",
    "'privy-client-initialize'",
    "'privy-raw-webview'",
    "'privy-provider-mount'",
    "'privy-provider-ready'",
    "'full-app-render'",
  ].every((token) => (
    token === 'AsyncStorage.setItem(STARTUP_STATE_KEY'
      ? bootstrap.includes(token)
      : source.includes(token)
  ));
}

export function startupDiagnosticReportsRuntime(bootstrapSource, probeSource) {
  const bootstrap = String(bootstrapSource || '');
  const probe = String(probeSource || '');
  return [
    'global.HermesInternal',
    'Platform.Version',
    'RUNTIME_LABEL',
    'STARTUP DIAGNOSTIC · BUILD',
  ].every((token) => bootstrap.includes(token))
    && [
      'global.HermesInternal',
      'Platform.Version',
      'RUNTIME_LABEL',
      'PRIVY ISOLATION · BUILD',
    ].every((token) => probe.includes(token));
}

export function privyIsolationStagesAreGuarded(probeSource) {
  const source = String(probeSource || '');
  const pendingWrite = source.indexOf(
    "await props.onStatus({ step, status: 'pending' });",
  );
  const action = source.indexOf('await action();', pendingWrite + 1);
  return pendingWrite >= 0
    && action > pendingWrite
    && [
      "stage === 'client-create'",
      "stage === 'client-initialize'",
      "stage === 'raw-webview'",
      "stage === 'provider-mount'",
      'rawAttemptRef.current',
      'attempt !== rawAttemptRef.current',
      'clearRawWebViewTimeout',
      'setRawWebViewMounted(false)',
      'cacheEnabled={false}',
      'cacheMode="LOAD_NO_CACHE"',
      'injectedJavaScriptObject={RAW_WEBVIEW_INJECTED_OBJECT}',
      'answerSecureStorageMessage(message)',
      'getEasyGoPrivyClient().setMessagePoster(instance)',
    ].every((token) => source.includes(token));
}

export function privyWebViewUsesSdkLoadContract(probeSource) {
  const source = String(probeSource || '');
  const handlerStart = source.indexOf('const handleRawWebViewLoad');
  if (handlerStart < 0) return false;
  const nextHandler = source.indexOf('const handleRawWebViewMount', handlerStart);
  const handler = source.slice(
    handlerStart,
    nextHandler < 0 ? source.length : nextHandler,
  );
  return handler.includes("rawStageRef.current = 'loaded'")
    && handler.includes("step: 'privy-raw-webview'")
    && handler.includes("status: 'passed'")
    && handler.includes("setStage('provider-mount')")
    && !handler.includes('.embeddedWallet.ping(')
    && source.includes('onLoad={() => handleRawWebViewLoad');
}

export function privyProviderUsesVersionedStorage(sourceText) {
  const source = String(sourceText || '');
  const providerTags = (source.match(/<PrivyProvider\b[\s\S]*?>/g) || [])
    .filter((tag) => tag.includes('appId='));
  return providerTags.length > 0 && providerTags.every((tag) => (
    tag.includes('client={getEasyGoPrivyClient()}')
    && tag.includes('storage={easyGoPrivyStorage}')
  ));
}

export function versionedPrivyStorageIsSafe(storageSource) {
  const source = String(storageSource || '');
  const prefix = source.match(/EASYGO_PRIVY_STORAGE_PREFIX\s*=\s*['"]([^'"]+)['"]/)?.[1];
  return Boolean(prefix)
    && /^[A-Za-z0-9._-]+$/.test(prefix)
    && source.includes("import { SecureStorageAdapter } from '@privy-io/expo'")
    && source.includes('SecureStorageAdapter.get(')
    && source.includes('SecureStorageAdapter.put(')
    && source.includes('SecureStorageAdapter.del(')
    && !source.includes('AsyncStorage');
}

export function singletonPrivyClientIsConfigured(clientSource) {
  const source = String(clientSource || '');
  return source.includes('let easyGoPrivyClient = null')
    && source.includes('easyGoPrivyClient = createPrivyClient({')
    && source.includes('await client.initialize()')
    && source.includes('storage: easyGoPrivyStorage');
}

export function startupKeepsOnePrivyProvider(bootstrapSource, probeSource, appSource) {
  const bootstrap = String(bootstrapSource || '');
  const probe = String(probeSource || '');
  const app = String(appSource || '');
  return bootstrap.includes('AppRoot={AppRoot}')
    && !bootstrap.includes('setProbeRoot(null)')
    && probe.includes('<PrivyProvider')
    && probe.includes('<AppRoot')
    && probe.includes('privyAlreadyMounted')
    && app.includes('if (alreadyMounted) return children');
}

export function privyAutomaticMigrationIsDisabled(sourceText, clientSource = '') {
  const source = String(sourceText || '');
  const providerTags = (source.match(/<PrivyProvider\b[\s\S]*?>/g) || [])
    .filter((openingTag) => openingTag.includes('appId='));
  return providerTags.some((openingTag) => {
    const inlineConfig = /config=\{\{\s*embedded:\s*\{\s*disableAutomaticMigration:\s*true\s*\}\s*\}\}/
      .test(openingTag);
    const sharedConfig = openingTag.includes('config={EASYGO_PRIVY_CONFIG}')
      && /EASYGO_PRIVY_CONFIG\s*=\s*\{[\s\S]*?disableAutomaticMigration:\s*true/.test(
        String(clientSource || ''),
      );
    return inlineConfig || sharedConfig;
  });
}

export function privyEmbeddedWalletCreationIsConfigured(sourceText, clientSource = '') {
  const source = String(sourceText || '');
  const providerTags = (source.match(/<PrivyProvider\b[\s\S]*?>/g) || [])
    .filter((openingTag) => openingTag.includes('appId='));
  const config = String(clientSource || '');
  return providerTags.length > 0
    && providerTags.every((openingTag) => (
      openingTag.includes('config={EASYGO_PRIVY_CONFIG}')
    ))
    && /EASYGO_PRIVY_CONFIG\s*=\s*\{[\s\S]*?ethereum:\s*\{[\s\S]*?createOnLogin:\s*['"]all-users['"]/.test(config)
    && config.includes('EASYGO_BASE_CHAIN')
    && /id:\s*8453/.test(config);
}

export function expoPublicEnvInliningIsConfigured(babelSource) {
  return /['"]babel-preset-expo['"]/.test(String(babelSource || ''));
}

export function releaseBufferAvoidsUnsupportedNativeBase64(
  babelSource,
  packageConfig,
) {
  const dependencies = packageConfig?.dependencies || {};
  return !String(babelSource || '').includes('@craftzdog/react-native-buffer')
    && !dependencies['@craftzdog/react-native-buffer']
    && !dependencies['react-native-quick-base64'];
}

export function iosReleaseUsesIsolatedJscRuntime(appConfig) {
  const expo = appConfig?.expo || {};
  const buildNumberText = String(expo.ios?.buildNumber || '');
  const buildNumber = Number(buildNumberText);
  const versionMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(expo.version || ''));
  const versionParts = versionMatch ? versionMatch.slice(1).map(Number) : null;
  const supportedVersion = Boolean(versionParts) && (
    versionParts[0] > 2
    || (versionParts[0] === 2 && versionParts[1] > 0)
    || (versionParts[0] === 2 && versionParts[1] === 0 && versionParts[2] >= 2)
  );
  return expo.ios?.jsEngine === 'jsc'
    && expo.runtimeVersion?.policy === 'appVersion'
    && supportedVersion
    && /^\d+$/.test(buildNumberText)
    && Number.isInteger(buildNumber)
    && buildNumber >= 97;
}

function validBackendUrl(value, staged) {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    return (!staged && local) || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validVersionedHttpsUrl(value, version) {
  if (!validHttpsUrl(value) || !version) return false;
  const segments = new URL(value).pathname.split('/').filter(Boolean);
  return segments.includes(version);
}

export function versionedLegalEnvironment(env = {}) {
  const consentVersion = clean(env.EXPO_PUBLIC_EASYGO_CONSENT_VERSION);
  const privacyUrl = clean(env.EXPO_PUBLIC_EASYGO_PRIVACY_URL);
  const termsUrl = clean(env.EXPO_PUBLIC_EASYGO_TERMS_URL);
  return {
    consentVersion,
    privacyUrl,
    termsUrl,
    versionValid: /^[A-Za-z0-9._-]{1,50}$/.test(consentVersion),
    privacyUrlValid: validVersionedHttpsUrl(privacyUrl, consentVersion),
    termsUrlValid: validVersionedHttpsUrl(termsUrl, consentVersion)
      && termsUrl !== privacyUrl,
  };
}

export function validateMobileEnvironment(env, appConfig, {
  target = 'local',
  appSource,
  bootstrapSource,
  babelSource,
  clientSource,
  packageConfig,
  probeSource,
  storageSource,
} = {}) {
  const checks = [];
  const add = (ok, name, failure, { warning = false } = {}) => {
    checks.push({ ok: Boolean(ok), name, failure, warning });
  };
  const staged = target === 'staging' || target === 'production';
  const expo = appConfig?.expo || {};

  add(['local', 'staging', 'production'].includes(target), 'deploy target', 'target must be local, staging, or production');
  add(Boolean(clean(env.EXPO_PUBLIC_PRIVY_APP_ID)), 'Privy app ID', 'EXPO_PUBLIC_PRIVY_APP_ID is required');
  add(Boolean(clean(env.EXPO_PUBLIC_PRIVY_CLIENT_ID)), 'Privy client ID', 'EXPO_PUBLIC_PRIVY_CLIENT_ID is required');

  const backendUrl = clean(env.EXPO_PUBLIC_BACKEND_URL);
  if (staged) {
    add(Boolean(backendUrl), 'backend URL', 'EXPO_PUBLIC_BACKEND_URL is required');
  } else if (!backendUrl) {
    add(false, 'backend URL', 'API calls are disabled until EXPO_PUBLIC_BACKEND_URL is set', { warning: true });
  }
  if (backendUrl) {
    add(validBackendUrl(backendUrl, staged), 'backend URL format', 'remote backend URLs must use HTTPS');
  }

  const legal = versionedLegalEnvironment(env);
  const legalMayRemainDormant = target === 'local';
  add(
    legal.versionValid,
    'EasyGo consent document version',
    'EXPO_PUBLIC_EASYGO_CONSENT_VERSION must match the published EasyGo policy version',
    { warning: !legal.consentVersion && legalMayRemainDormant },
  );
  add(
    legal.privacyUrlValid,
    'EasyGo privacy policy URL',
    'EXPO_PUBLIC_EASYGO_PRIVACY_URL must be the versioned HTTPS EasyGo privacy policy',
    { warning: !legal.privacyUrl && legalMayRemainDormant },
  );
  add(
    legal.termsUrlValid,
    'EasyGo terms URL',
    'EXPO_PUBLIC_EASYGO_TERMS_URL must be the versioned HTTPS EasyGo terms of service',
    { warning: !legal.termsUrl && legalMayRemainDormant },
  );

  add(expo.scheme === 'coineasyapp', 'URL scheme', 'Expo scheme must remain coineasyapp for the configured Privy client');
  add(
    expo.ios?.bundleIdentifier === 'com.coineasy.coineasysocial',
    'iOS bundle identifier',
    'iOS bundle identifier must match the configured Privy mobile client',
  );
  add(expo.ios?.usesAppleSignIn === true, 'Sign in with Apple capability', 'Expo iOS config must enable usesAppleSignIn');
  if (staged) {
    add(
      iosReleaseUsesIsolatedJscRuntime(appConfig),
      'iOS JSC runtime isolation',
      'staged iOS releases from build 97 onward must stay on JSC and app-version runtime isolation',
    );
  }
  add(Boolean(clean(expo.android?.package)), 'Android package', 'Expo Android package is required');
  add(
    false,
    'Privy native allowlist review',
    `confirm Privy allows iOS ${expo.ios?.bundleIdentifier || '(missing)'}, Android ${expo.android?.package || '(missing)'}, and scheme ${expo.scheme || '(missing)'}`,
    { warning: true },
  );
  if (appSource !== undefined) {
    add(
      authBridgeHasProviderScope(appSource),
      'AuthBridge context scope',
      'AuthBridge must render inside GlobalContext.Provider',
    );
    add(
      startupBoundaryProtectsApp(appSource),
      'startup error boundary',
      'EasyGoApp must render inside StartupErrorBoundary',
    );
    add(
      authenticatedUiIsGated(appSource),
      'authenticated UI gating',
      'authenticated modals must not render on the login path',
    );
    add(
      privyAutomaticMigrationIsDisabled(appSource, clientSource),
      'full app Privy migration safety',
      'automatic embedded-wallet migration must remain disabled during iOS startup isolation',
    );
    add(
      privyEmbeddedWalletCreationIsConfigured(appSource, clientSource),
      'full app Base embedded wallet creation',
      'headless Privy login must create one EVM embedded wallet on Base',
    );
    add(
      privyProviderUsesVersionedStorage(appSource),
      'full app Privy session storage',
      'the full app fallback provider must use the versioned SecureStore client',
    );
  }
  if (bootstrapSource !== undefined) {
    add(
      privyPolyfillsLoadFirst(bootstrapSource),
      'Privy polyfill entry order',
      'Privy polyfills must evaluate before the application imports @privy-io/expo',
    );
    add(
      startupDiagnosticPersistsPhases(bootstrapSource, probeSource),
      'persistent startup diagnostics',
      'startup diagnostics must persist every risky iOS initialization phase',
    );
  }
  if (probeSource !== undefined) {
    add(
      privyIsolationStagesAreGuarded(probeSource),
      'Privy isolation stage guards',
      'Privy storage, client, WebView, and Provider probes must remain user-gated and race-safe',
    );
    add(
      privyWebViewUsesSdkLoadContract(probeSource),
      'Privy WebView load contract',
      'the standalone WebView must follow the SDK onLoad contract without a blocking initial ping',
    );
    add(
      privyAutomaticMigrationIsDisabled(probeSource, clientSource),
      'Privy probe migration safety',
      'the Privy startup probe must not run automatic embedded-wallet migration',
    );
    add(
      privyEmbeddedWalletCreationIsConfigured(probeSource, clientSource),
      'Privy probe Base embedded wallet creation',
      'the startup probe provider must share the production embedded-wallet config',
    );
    add(
      privyProviderUsesVersionedStorage(probeSource),
      'Privy probe session storage',
      'the startup probe must use the versioned SecureStore client',
    );
  }
  if (storageSource !== undefined) {
    add(
      versionedPrivyStorageIsSafe(storageSource),
      'versioned Privy SecureStore',
      'Privy auth state must remain in a valid, versioned SecureStore namespace',
    );
  }
  if (clientSource !== undefined) {
    add(
      singletonPrivyClientIsConfigured(clientSource),
      'singleton Privy client',
      'Privy client initialization must reuse one module-level client',
    );
  }
  if (appSource !== undefined && bootstrapSource !== undefined && probeSource !== undefined) {
    add(
      startupKeepsOnePrivyProvider(bootstrapSource, probeSource, appSource),
      'single Privy provider lifetime',
      'the diagnostic probe and EasyGo shell must share one mounted Privy provider',
    );
  }
  if (babelSource !== undefined) {
    add(
      expoPublicEnvInliningIsConfigured(babelSource),
      'Expo public environment inlining',
      'babel.config.js must use babel-preset-expo so EXPO_PUBLIC_* values are embedded in release bundles',
    );
  }
  if (babelSource !== undefined && packageConfig !== undefined) {
    add(
      releaseBufferAvoidsUnsupportedNativeBase64(babelSource, packageConfig),
      'portable release Buffer implementation',
      'release bundling must not load the New-Architecture-only react-native-quick-base64 v3 module',
    );
  }

  return {
    target,
    checks,
    errors: checks.filter((check) => !check.ok && !check.warning),
    warnings: checks.filter((check) => !check.ok && check.warning),
  };
}

export function targetFromArgs(argv, env = process.env) {
  const argument = argv.find((item) => item.startsWith('--target='));
  return clean(
    argument?.slice('--target='.length)
    || env.EASYGO_DEPLOY_TARGET
    || 'local',
  );
}

function run() {
  const envPath = resolve('.env');
  const fileEnv = existsSync(envPath) ? parseEnvText(readFileSync(envPath, 'utf8')) : {};
  const env = { ...fileEnv, ...process.env };
  const appConfig = JSON.parse(readFileSync(resolve('app.json'), 'utf8'));
  const appSource = readFileSync(resolve('App.js'), 'utf8');
  const bootstrapSource = readFileSync(resolve('BootstrapApp.js'), 'utf8');
  const probeSource = readFileSync(resolve('PrivyStartupProbe.js'), 'utf8');
  const clientSource = readFileSync(resolve('utils/privyClient.js'), 'utf8');
  const storageSource = readFileSync(resolve('utils/privyStorage.js'), 'utf8');
  const babelSource = readFileSync(resolve('babel.config.js'), 'utf8');
  const packageConfig = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
  const result = validateMobileEnvironment(env, appConfig, {
    target: targetFromArgs(process.argv.slice(2), process.env),
    appSource,
    bootstrapSource,
    babelSource,
    clientSource,
    packageConfig,
    probeSource,
    storageSource,
  });

  console.log(`EasyGo mobile preflight: ${result.target}`);
  for (const check of result.checks) {
    const symbol = check.ok ? 'PASS' : check.warning ? 'WARN' : 'FAIL';
    console.log(`[${symbol}] ${check.name}${check.ok ? '' : ` — ${check.failure}`}`);
  }
  console.log(`Summary: ${result.errors.length} failure(s), ${result.warnings.length} warning(s)`);
  if (result.errors.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) run();
