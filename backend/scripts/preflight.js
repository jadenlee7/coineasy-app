#!/usr/bin/env node
import 'dotenv/config';
import { fileURLToPath } from 'node:url';

const BOOLEAN_FLAGS = [
  'SIWE_AUTH_ENABLED',
  'JUSTANAME_ENABLED',
  'SEGMENTS_ENABLED',
  'QUESTS_ENABLED',
  'ADVERTISER_ADMIN_ENABLED',
  'CONSENT_GRANTS_ENABLED',
  'ACCOUNT_DELETION_ENABLED',
  'ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED',
];

// Keep this independent from environment input. It moves to true only in the
// reviewed release that includes provider cleanup and the mobile deletion
// marker; until then no Railway flag combination may activate deletion.
const ACCOUNT_DELETION_ACTIVATION_READY = false;

function clean(value) {
  return String(value || '').trim();
}

function enabled(env, name) {
  return clean(env[name]).toLowerCase() === 'true';
}

function validUrl(value, { https = false, protocols = [] } = {}) {
  try {
    const parsed = new URL(value);
    if (https && parsed.protocol !== 'https:') return false;
    if (protocols.length && !protocols.includes(parsed.protocol)) return false;
    return true;
  } catch {
    return false;
  }
}

function validBase64Key(value, byteLength) {
  const encoded = clean(value);
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) return false;
  const decoded = Buffer.from(encoded, 'base64');
  return decoded.length === byteLength
    && decoded.toString('base64').replace(/=+$/u, '') === encoded.replace(/=+$/u, '');
}

function parseTarget(argv = process.argv.slice(2), env = process.env) {
  const argument = argv.find((item) => item.startsWith('--target='));
  const value = clean(argument?.slice('--target='.length) || env.EASYGO_DEPLOY_TARGET || 'local');
  return ['local', 'staging', 'production'].includes(value) ? value : 'invalid';
}

export function validateDeployEnvironment(
  env,
  { target = 'local', nodeVersion = process.versions.node } = {},
) {
  const checks = [];
  const add = (ok, name, failure, { warning = false } = {}) => {
    checks.push({ ok: Boolean(ok), name, failure, warning });
  };
  const requireValue = (name) => add(Boolean(clean(env[name])), name, `${name} is required`);
  const staged = target === 'staging' || target === 'production';

  add(target !== 'invalid', 'deploy target', 'target must be local, staging, or production');
  add(Number(nodeVersion.split('.')[0]) >= 20, 'Node.js version', 'Node.js 20 or newer is required');

  for (const name of BOOLEAN_FLAGS) {
    const value = clean(env[name]).toLowerCase();
    add(!value || value === 'true' || value === 'false', `${name} syntax`, `${name} must be true or false`);
  }

  const socialMode = clean(env.LEGACY_SOCIAL_MODE) || 'active';
  add(
    ['active', 'read_only', 'retired'].includes(socialMode),
    'legacy social mode',
    'LEGACY_SOCIAL_MODE must be active, read_only, or retired',
  );
  if (staged && socialMode !== 'active') {
    add(
      enabled(env, 'ALLOW_LEGACY_SOCIAL_RETIREMENT'),
      'social retirement approval',
      'non-active social mode requires ALLOW_LEGACY_SOCIAL_RETIREMENT=true',
    );
    add(
      Number.isFinite(Date.parse(clean(env.LEGACY_SOCIAL_SUNSET_AT))),
      'social sunset timestamp',
      'non-active social mode requires a valid LEGACY_SOCIAL_SUNSET_AT',
    );
  }

  if (staged) {
    add(env.NODE_ENV === 'production', 'production runtime mode', 'NODE_ENV must be production');
    for (const name of [
      'DATABASE_URL',
      'PRIVY_APP_ID',
      'PRIVY_APP_SECRET',
      'SQUID_INTEGRATOR_ID',
      'ADMIN_SECRET',
      'SERVICE_NAME',
      'RELEASE_SHA',
      'EASYGO_CONSENT_VERSION',
      'ACCOUNT_DELETION_SUBJECT_HMAC_KEY',
      'ACCOUNT_DELETION_ENCRYPTION_KEY',
    ]) requireValue(name);
    if (clean(env.DATABASE_URL)) {
      add(
        validUrl(clean(env.DATABASE_URL), { protocols: ['postgres:', 'postgresql:'] }),
        'database URL format',
        'DATABASE_URL must be a PostgreSQL URL',
      );
    }
    if (clean(env.ADMIN_SECRET)) {
      add(clean(env.ADMIN_SECRET).length >= 24, 'admin secret strength', 'ADMIN_SECRET must be at least 24 characters');
    }
    if (clean(env.RELEASE_SHA)) {
      add(
        !['local', 'unknown'].includes(clean(env.RELEASE_SHA).toLowerCase()),
        'immutable release ID',
        'RELEASE_SHA must identify the deployed revision',
      );
    }
  }

  if (enabled(env, 'SIWE_AUTH_ENABLED')) {
    for (const name of ['SIWE_DOMAIN', 'SIWE_URI', 'BASE_RPC_URL']) requireValue(name);
    add(validUrl(clean(env.SIWE_URI), { https: staged }), 'SIWE URI', 'SIWE_URI must be a valid HTTPS URL');
    add(validUrl(clean(env.BASE_RPC_URL), { https: staged }), 'Base RPC URL', 'BASE_RPC_URL must be a valid HTTPS URL');
  }

  if (enabled(env, 'JUSTANAME_ENABLED')) {
    for (const name of ['JUSTANAME_API_KEY', 'JUSTANAME_DOMAIN', 'JUSTANAME_ORIGIN']) requireValue(name);
    add(
      validUrl(clean(env.JUSTANAME_ORIGIN), { https: staged }),
      'JustaName origin',
      'JUSTANAME_ORIGIN must be a valid HTTPS URL',
    );
  }

  if (enabled(env, 'SEGMENTS_ENABLED')) {
    for (const name of ['BASE_RPC_URL', 'ETHERSCAN_API_KEY', 'EASYGO_CONSENT_VERSION']) requireValue(name);
  }

  if (enabled(env, 'QUESTS_ENABLED')) {
    for (const name of ['BASE_RPC_URL', 'EASYGO_CONSENT_VERSION']) requireValue(name);
  }

  if (enabled(env, 'ADVERTISER_ADMIN_ENABLED')) {
    for (const name of ['ADVERTISER_API_KEY_HASHES_JSON', 'EASYGO_CONSENT_VERSION']) requireValue(name);
    try {
      const mapping = JSON.parse(clean(env.ADVERTISER_API_KEY_HASHES_JSON));
      const entries = Object.entries(mapping || {});
      add(
        entries.length > 0 && entries.every(([, digest]) => /^[a-f0-9]{64}$/.test(String(digest))),
        'advertiser key digests',
        'ADVERTISER_API_KEY_HASHES_JSON must map slugs to lowercase SHA-256 digests',
      );
    } catch {
      add(false, 'advertiser key digests', 'ADVERTISER_API_KEY_HASHES_JSON must be valid JSON');
    }
  }

  const deletionEnabled = enabled(env, 'ACCOUNT_DELETION_ENABLED');
  const deletionCleanupEnabled = enabled(env, 'ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED');
  const deletionHashKey = clean(env.ACCOUNT_DELETION_SUBJECT_HMAC_KEY);
  const deletionEncryptionKey = clean(env.ACCOUNT_DELETION_ENCRYPTION_KEY);
  const deletionKeysPresent = Boolean(deletionHashKey || deletionEncryptionKey);

  if (deletionEnabled || deletionCleanupEnabled || deletionKeysPresent) {
    requireValue('ACCOUNT_DELETION_SUBJECT_HMAC_KEY');
    requireValue('ACCOUNT_DELETION_ENCRYPTION_KEY');
    if (deletionHashKey) {
      add(
        Buffer.byteLength(deletionHashKey, 'utf8') >= 32,
        'account deletion subject HMAC key strength',
        'ACCOUNT_DELETION_SUBJECT_HMAC_KEY must be at least 32 bytes',
      );
    }
    if (deletionEncryptionKey) {
      add(
        validBase64Key(deletionEncryptionKey, 32),
        'account deletion encryption key format',
        'ACCOUNT_DELETION_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
      );
    }
  }

  if (deletionEnabled) {
    add(
      ACCOUNT_DELETION_ACTIVATION_READY,
      'account deletion implementation readiness',
      'ACCOUNT_DELETION_ENABLED cannot be true until provider cleanup and the mobile deletion marker are implemented',
    );
    add(
      deletionCleanupEnabled,
      'account deletion provider cleanup',
      'ACCOUNT_DELETION_ENABLED requires ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED=true',
    );
  }

  if (deletionCleanupEnabled) {
    add(
      ACCOUNT_DELETION_ACTIVATION_READY,
      'account deletion provider implementation readiness',
      'ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED cannot be true before the cleanup worker is implemented',
    );
    const appleMode = clean(env.ACCOUNT_DELETION_APPLE_REVOCATION_MODE);
    add(
      ['privy_confirmed', 'easygo_managed'].includes(appleMode),
      'account deletion Apple revocation mode',
      'provider cleanup requires an approved ACCOUNT_DELETION_APPLE_REVOCATION_MODE',
    );
  }

  const betterToken = Boolean(clean(env.BETTER_STACK_SOURCE_TOKEN));
  const betterHost = Boolean(clean(env.BETTER_STACK_INGESTING_HOST));
  add(
    betterToken === betterHost,
    'Better Stack configuration pair',
    'configure both BETTER_STACK_SOURCE_TOKEN and BETTER_STACK_INGESTING_HOST, or neither',
  );

  if (clean(env.SENTRY_DSN)) {
    add(validUrl(clean(env.SENTRY_DSN), { https: true }), 'Sentry DSN', 'SENTRY_DSN must be a valid HTTPS URL');
  }

  if (clean(env.SENTRY_TRACES_SAMPLE_RATE)) {
    const rate = Number(env.SENTRY_TRACES_SAMPLE_RATE);
    add(Number.isFinite(rate) && rate >= 0, 'Sentry trace sample rate', 'SENTRY_TRACES_SAMPLE_RATE must be zero or greater');
  }

  if (clean(env.TELEGRAM_BOT_TOKEN) && staged) {
    requireValue('TELEGRAM_WEBHOOK_URL');
    requireValue('TELEGRAM_WEBHOOK_SECRET');
    add(
      validUrl(clean(env.TELEGRAM_WEBHOOK_URL), { https: true }),
      'Telegram webhook URL',
      'TELEGRAM_WEBHOOK_URL must be a valid HTTPS URL',
    );
    add(
      clean(env.TELEGRAM_WEBHOOK_SECRET).length >= 24,
      'Telegram webhook secret strength',
      'TELEGRAM_WEBHOOK_SECRET must be at least 24 characters',
    );
  }

  if (staged && !clean(env.SENTRY_DSN)) {
    add(false, 'Sentry activation', 'Sentry is optional but recommended before production traffic', { warning: true });
  }
  if (staged && !(betterToken && betterHost)) {
    add(false, 'Better Stack activation', 'Better Stack is optional but recommended before production traffic', { warning: true });
  }
  if (staged && !clean(env.TELEGRAM_BOT_TOKEN)) {
    add(false, 'Telegram activation', 'Telegram is disabled because no bot token is configured', { warning: true });
  }

  return {
    target,
    checks,
    errors: checks.filter((check) => !check.ok && !check.warning),
    warnings: checks.filter((check) => !check.ok && check.warning),
  };
}

function run() {
  const target = parseTarget();
  const result = validateDeployEnvironment(process.env, { target });
  console.log(`EasyGo deploy preflight: ${target}`);
  for (const check of result.checks) {
    const symbol = check.ok ? 'PASS' : check.warning ? 'WARN' : 'FAIL';
    console.log(`[${symbol}] ${check.name}${check.ok ? '' : ` — ${check.failure}`}`);
  }
  console.log(
    `Summary: ${result.errors.length} failure(s), ${result.warnings.length} warning(s)`,
  );
  if (result.errors.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) run();
