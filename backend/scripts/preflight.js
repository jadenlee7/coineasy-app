#!/usr/bin/env node
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import {
  ACCOUNT_DELETION_PROVIDER_CLEANUP_READY,
  ACCOUNT_DELETION_PUBLIC_REQUEST_READY,
  ACCOUNT_DELETION_RECENT_AUTH_READY,
  ACCOUNT_DELETION_STABLE_IDENTITY_GUARD_READY,
} from '../src/lib/account-deletion-gates.js';
import {
  legalDocumentsApproved,
  LEGAL_DOCUMENT_VERSION,
} from '../src/lib/legal.js';
import { PUSH_TOKEN_REGISTRATION_READY } from '../src/lib/push-token-gates.js';
import { SWAP_EXECUTION_READY } from '../src/lib/swap-execution-gates.js';
import { POST_MODERATION_READY } from '../src/lib/moderation-gates.js';
import { parseModerationKeyHashes } from '../src/lib/moderation-auth.js';
import { resolveModerationActivationConfig } from '../src/lib/moderation-config.js';

const BOOLEAN_FLAGS = [
  'SIWE_AUTH_ENABLED',
  'JUSTANAME_ENABLED',
  'SEGMENTS_ENABLED',
  'QUESTS_ENABLED',
  'ADVERTISER_ADMIN_ENABLED',
  'POST_MODERATION_ENABLED',
  'CONSENT_GRANTS_ENABLED',
  'ACCOUNT_DELETION_ENABLED',
  'ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED',
  'ACCOUNT_DELETION_RECENT_AUTH_ENABLED',
  'PUSH_TOKEN_REGISTRATION_ENABLED',
  'SWAP_EXECUTION_ENABLED',
];

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
  const configuredInteger = (name, fallback, min, max) => {
    const raw = clean(env[name]);
    const parsed = raw ? Number(raw) : fallback;
    add(
      Number.isInteger(parsed) && parsed >= min && parsed <= max,
      `${name} range`,
      `${name} must be an integer between ${min} and ${max}`,
    );
    return parsed;
  };
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
    add(
      clean(env.EASYGO_CONSENT_VERSION) === LEGAL_DOCUMENT_VERSION,
      'consent document version alignment',
      `EASYGO_CONSENT_VERSION must exactly match bundled legal document version ${LEGAL_DOCUMENT_VERSION}`,
    );
  }

  if (enabled(env, 'CONSENT_GRANTS_ENABLED')) {
    add(
      legalDocumentsApproved(),
      'legal document approval',
      'CONSENT_GRANTS_ENABLED cannot be true while the bundled legal documents remain a staging candidate',
    );
  }

  if (enabled(env, 'PUSH_TOKEN_REGISTRATION_ENABLED')) {
    add(
      PUSH_TOKEN_REGISTRATION_READY,
      'push-token registration approval',
      'PUSH_TOKEN_REGISTRATION_ENABLED cannot be true until the matching privacy version and device QA are approved',
    );
  }

  if (enabled(env, 'SWAP_EXECUTION_ENABLED')) {
    add(
      SWAP_EXECUTION_READY,
      'swap execution approval',
      'SWAP_EXECUTION_ENABLED cannot be true until execution and reward verification are approved',
    );
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

  if (enabled(env, 'POST_MODERATION_ENABLED')) {
    for (const name of [
      'MODERATION_API_KEY_HASHES_JSON',
      'MODERATION_RESPONSE_SLA_HOURS',
      'MODERATION_POLICY_VERSION',
      'MODERATION_RETENTION_POLICY_VERSION',
      'MODERATION_OWNER',
      'MODERATION_ESCALATION_CONTACT',
    ]) requireValue(name);
    try {
      parseModerationKeyHashes(clean(env.MODERATION_API_KEY_HASHES_JSON));
      add(true, 'moderation key digests', '');
    } catch {
      add(
        false,
        'moderation key digests',
        'MODERATION_API_KEY_HASHES_JSON must map opaque reviewer IDs to unique lowercase SHA-256 digests',
      );
    }
    configuredInteger('MODERATION_RESPONSE_SLA_HOURS', 24, 1, 168);
    for (const name of ['MODERATION_POLICY_VERSION', 'MODERATION_RETENTION_POLICY_VERSION']) {
      const value = clean(env[name]);
      add(
        /^[A-Za-z0-9._:-]{1,64}$/u.test(value)
          && !/(?:candidate|draft|tbd|unknown|unapproved)/iu.test(value),
        `${name} approval`,
        `${name} must be an approved non-placeholder version`,
      );
    }
    const moderationOwner = clean(env.MODERATION_OWNER);
    add(
      moderationOwner.length >= 3
        && moderationOwner.length <= 100
        && !/^(?:unassigned|undefined|tbd|unknown|none)$/iu.test(moderationOwner),
      'moderation owner assignment',
      'MODERATION_OWNER must identify an assigned owner rather than a placeholder',
    );
    const escalationContact = clean(env.MODERATION_ESCALATION_CONTACT);
    add(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(escalationContact)
        || validUrl(escalationContact, { https: true }),
      'moderation escalation contact',
      'MODERATION_ESCALATION_CONTACT must be an email address or approved URL',
    );
    add(
      POST_MODERATION_READY,
      'post moderation implementation readiness',
      'POST_MODERATION_ENABLED cannot be true until the owner, workforce identity, retention, escalation, migration, and QA gates are approved',
    );
    try {
      resolveModerationActivationConfig(env);
      add(true, 'moderation runtime contract parity', '');
    } catch {
      add(
        false,
        'moderation runtime contract parity',
        'moderation activation settings must satisfy the exact runtime contract',
      );
    }
  }

  const deletionEnabled = enabled(env, 'ACCOUNT_DELETION_ENABLED');
  const deletionCleanupEnabled = enabled(env, 'ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED');
  const deletionRecentAuthEnabled = enabled(env, 'ACCOUNT_DELETION_RECENT_AUTH_ENABLED');
  const deletionHashKey = clean(env.ACCOUNT_DELETION_SUBJECT_HMAC_KEY);
  const deletionEncryptionKey = clean(env.ACCOUNT_DELETION_ENCRYPTION_KEY);
  const deletionKeysPresent = Boolean(deletionHashKey || deletionEncryptionKey);

  if (
    deletionEnabled
    || deletionCleanupEnabled
    || deletionRecentAuthEnabled
    || deletionKeysPresent
  ) {
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
      ACCOUNT_DELETION_PUBLIC_REQUEST_READY,
      'account deletion implementation readiness',
      'ACCOUNT_DELETION_ENABLED cannot be true until every public account deletion blocker is approved',
    );
    add(
      ACCOUNT_DELETION_STABLE_IDENTITY_GUARD_READY,
      'account deletion stable identity readiness',
      'ACCOUNT_DELETION_ENABLED cannot be true until the irreversible stable identity guard is approved',
    );
    add(
      deletionCleanupEnabled,
      'account deletion provider cleanup',
      'ACCOUNT_DELETION_ENABLED requires ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED=true',
    );
    add(
      deletionRecentAuthEnabled,
      'account deletion recent authentication',
      'ACCOUNT_DELETION_ENABLED requires ACCOUNT_DELETION_RECENT_AUTH_ENABLED=true',
    );
  }

  if (deletionRecentAuthEnabled) {
    add(
      ACCOUNT_DELETION_RECENT_AUTH_READY,
      'account deletion recent authentication readiness',
      'ACCOUNT_DELETION_RECENT_AUTH_ENABLED cannot be true until recent authentication is approved',
    );
  }

  if (deletionCleanupEnabled) {
    add(
      ACCOUNT_DELETION_PROVIDER_CLEANUP_READY,
      'account deletion provider implementation readiness',
      'ACCOUNT_DELETION_PROVIDER_CLEANUP_ENABLED cannot be true until provider cleanup is approved',
    );
    const appleMode = clean(env.ACCOUNT_DELETION_APPLE_REVOCATION_MODE);
    add(
      ['privy_confirmed', 'easygo_managed'].includes(appleMode),
      'account deletion Apple revocation mode',
      'provider cleanup requires an approved ACCOUNT_DELETION_APPLE_REVOCATION_MODE',
    );
  }

  const deletionWorkerConfigPresent = [
    'ACCOUNT_DELETION_WORKER_INTERVAL_MS',
    'ACCOUNT_DELETION_WORKER_BATCH_SIZE',
    'ACCOUNT_DELETION_WORKER_LEASE_MS',
    'ACCOUNT_DELETION_PROVIDER_TIMEOUT_MS',
  ].some((name) => Boolean(clean(env[name])));
  if (deletionCleanupEnabled || deletionWorkerConfigPresent) {
    configuredInteger('ACCOUNT_DELETION_WORKER_INTERVAL_MS', 30_000, 5_000, 3_600_000);
    configuredInteger('ACCOUNT_DELETION_WORKER_BATCH_SIZE', 10, 1, 100);
    const leaseMs = configuredInteger(
      'ACCOUNT_DELETION_WORKER_LEASE_MS',
      60_000,
      30_000,
      600_000,
    );
    const providerTimeoutMs = configuredInteger(
      'ACCOUNT_DELETION_PROVIDER_TIMEOUT_MS',
      10_000,
      1_000,
      30_000,
    );
    add(
      leaseMs >= providerTimeoutMs * 2,
      'account deletion worker lease safety margin',
      'ACCOUNT_DELETION_WORKER_LEASE_MS must be at least twice ACCOUNT_DELETION_PROVIDER_TIMEOUT_MS',
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
