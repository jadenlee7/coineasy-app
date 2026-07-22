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
  const app = source.indexOf('<EasyGoApp />', boundaryOpen);
  const boundaryClose = source.indexOf('</StartupErrorBoundary>', app);
  return boundaryOpen >= 0 && app > boundaryOpen && boundaryClose > app;
}

export function authenticatedUiIsGated(appSource) {
  const source = String(appSource || '');
  const branchOpen = source.indexOf('{user ? (');
  const loginBranch = source.indexOf(') : (', branchOpen);
  if (branchOpen < 0 || loginBranch < 0) return false;
  return [
    '<AppNavigator />',
    '<UpdateProfileModal />',
    '<NicknameModal />',
    '<PostboxModal />',
  ].every((component) => {
    const index = source.indexOf(component, branchOpen);
    return index > branchOpen && index < loginBranch;
  });
}

export function privyPolyfillsLoadFirst(bootstrapSource) {
  const source = String(bootstrapSource || '');
  const orderedImports = [
    "await import('fast-text-encoding');",
    "await import('react-native-get-random-values');",
    "await import('@ethersproject/shims');",
  ];
  let cursor = -1;
  for (const statement of orderedImports) {
    const index = source.indexOf(statement, cursor + 1);
    if (index < 0) return false;
    cursor = index;
  }
  const appImport = source.indexOf("await import('./App');", cursor + 1);
  return appImport > cursor;
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

export function validateMobileEnvironment(env, appConfig, {
  target = 'local',
  appSource,
  bootstrapSource,
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

  add(expo.scheme === 'coineasyapp', 'URL scheme', 'Expo scheme must remain coineasyapp for the configured Privy client');
  add(
    expo.ios?.bundleIdentifier === 'com.coineasy.coineasysocial',
    'iOS bundle identifier',
    'iOS bundle identifier must match the configured Privy mobile client',
  );
  add(expo.ios?.usesAppleSignIn === true, 'Sign in with Apple capability', 'Expo iOS config must enable usesAppleSignIn');
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
  }
  if (bootstrapSource !== undefined) {
    add(
      privyPolyfillsLoadFirst(bootstrapSource),
      'Privy polyfill entry order',
      'Privy polyfills must evaluate before the application imports @privy-io/expo',
    );
  }

  return {
    target,
    checks,
    errors: checks.filter((check) => !check.ok && !check.warning),
    warnings: checks.filter((check) => !check.ok && check.warning),
  };
}

function targetFromArgs(argv) {
  const argument = argv.find((item) => item.startsWith('--target='));
  return clean(argument?.slice('--target='.length) || 'local');
}

function run() {
  const envPath = resolve('.env');
  const fileEnv = existsSync(envPath) ? parseEnvText(readFileSync(envPath, 'utf8')) : {};
  const env = { ...fileEnv, ...process.env };
  const appConfig = JSON.parse(readFileSync(resolve('app.json'), 'utf8'));
  const appSource = readFileSync(resolve('App.js'), 'utf8');
  const bootstrapSource = readFileSync(resolve('BootstrapApp.js'), 'utf8');
  const result = validateMobileEnvironment(env, appConfig, {
    target: targetFromArgs(process.argv.slice(2)),
    appSource,
    bootstrapSource,
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
