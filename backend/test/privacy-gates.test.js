import assert from 'node:assert/strict';
import test from 'node:test';

import { validateDeployEnvironment } from '../scripts/preflight.js';

const base = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://easygo.invalid/db?sslmode=require',
  DIRECT_URL: 'postgresql://easygo.invalid/db?sslmode=require',
  PRIVY_APP_ID: 'app-id',
  PRIVY_APP_SECRET: 'app-secret',
  SQUID_INTEGRATOR_ID: 'easygo-integrator',
  ADMIN_SECRET: 'a'.repeat(32),
  SERVICE_NAME: 'easygo-web-staging',
  RELEASE_SHA: 'abcdef1',
  EASYGO_CONSENT_VERSION: '2026-07-21-staging-v1',
  LEGACY_SOCIAL_MODE: 'active',
  SIWE_AUTH_ENABLED: 'false',
  JUSTANAME_ENABLED: 'false',
  SEGMENTS_ENABLED: 'false',
  QUESTS_ENABLED: 'false',
  ADVERTISER_ADMIN_ENABLED: 'false',
  AMA_CAMPAIGN_ENABLED: 'false',
};

test('privacy release gates accept only explicit boolean values', () => {
  const safe = validateDeployEnvironment({
    ...base,
    CONSENT_GRANTS_ENABLED: 'false',
    ACCOUNT_DELETION_ENABLED: 'false',
  }, { target: 'staging' });
  assert.equal(safe.errors.length, 0);

  for (const name of ['CONSENT_GRANTS_ENABLED', 'ACCOUNT_DELETION_ENABLED']) {
    const invalid = validateDeployEnvironment({ ...base, [name]: 'yes' }, { target: 'staging' });
    assert.equal(
      invalid.errors.some((item) => item.name === `${name} syntax`),
      true,
    );
  }
});
