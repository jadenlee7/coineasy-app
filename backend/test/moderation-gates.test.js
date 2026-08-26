import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateDeployEnvironment } from '../scripts/preflight.js';
import { hashModerationApiKey } from '../src/lib/moderation-auth.js';
import { POST_MODERATION_READY } from '../src/lib/moderation-gates.js';
import { PHASE } from '../utils/easygo.js';

const MODERATOR_KEY = `eg_mod_${'a'.repeat(32)}`;

function enabledModerationEnv(overrides = {}) {
  return {
    POST_MODERATION_ENABLED: 'true',
    MODERATION_API_KEY_HASHES_JSON: JSON.stringify({
      'primary-reviewer': hashModerationApiKey(MODERATOR_KEY),
    }),
    MODERATION_RESPONSE_SLA_HOURS: '24',
    MODERATION_POLICY_VERSION: '2026-08-26-candidate-v1',
    MODERATION_RETENTION_POLICY_VERSION: 'unapproved-candidate-v1',
    MODERATION_OWNER: 'unassigned',
    MODERATION_ESCALATION_CONTACT: 'contact@coineasy.xyz',
    ...overrides,
  };
}

test('the moderation source brake masks the runtime flag until release gates are approved', () => {
  assert.equal(POST_MODERATION_READY, false);
  assert.equal(PHASE.POST_MODERATION_ENABLED, false);

  const source = readFileSync(
    new URL('../utils/easygo.js', import.meta.url),
    'utf8',
  );
  assert.match(
    source,
    /POST_MODERATION_ENABLED:\s*POST_MODERATION_READY\s*&&\s*enabled\('POST_MODERATION_ENABLED'\)/,
  );
});

test('deploy preflight refuses moderation activation even with candidate configuration', () => {
  const result = validateDeployEnvironment(enabledModerationEnv(), { target: 'local' });
  assert.equal(
    result.errors.some((item) => item.name === 'post moderation implementation readiness'),
    true,
  );
  assert.equal(
    result.errors.some((item) => item.name === 'moderation key digests'),
    false,
  );
  assert.equal(
    result.errors.some((item) => item.name === 'MODERATION_RETENTION_POLICY_VERSION approval'),
    true,
  );
  assert.equal(
    result.errors.some((item) => item.name === 'moderation owner assignment'),
    true,
  );
});

test('deploy preflight validates every moderation activation dependency without exposing keys', () => {
  const malformed = validateDeployEnvironment(enabledModerationEnv({
    MODERATION_API_KEY_HASHES_JSON: JSON.stringify({
      'primary-reviewer': MODERATOR_KEY,
    }),
    MODERATION_RESPONSE_SLA_HOURS: '0',
    MODERATION_RETENTION_POLICY_VERSION: '',
  }), { target: 'local' });

  assert.equal(
    malformed.errors.some((item) => item.name === 'moderation key digests'),
    true,
  );
  assert.equal(
    malformed.errors.some((item) => item.name === 'MODERATION_RESPONSE_SLA_HOURS range'),
    true,
  );
  assert.equal(
    malformed.errors.some((item) => item.failure.includes('MODERATION_RETENTION_POLICY_VERSION')),
    true,
  );
  assert.equal(JSON.stringify(malformed).includes(MODERATOR_KEY), false);

  const invalidFlag = validateDeployEnvironment({
    POST_MODERATION_ENABLED: 'yes',
  }, { target: 'local' });
  assert.equal(
    invalidFlag.errors.some((item) => item.name === 'POST_MODERATION_ENABLED syntax'),
    true,
  );
});

test('moderation configuration is not required while the source remains dormant', () => {
  const result = validateDeployEnvironment({
    POST_MODERATION_ENABLED: 'false',
  }, { target: 'local' });
  assert.deepEqual(result.errors, []);
});
