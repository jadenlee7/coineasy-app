import assert from 'node:assert/strict';
import test from 'node:test';

import { hashModerationApiKey } from '../src/lib/moderation-auth.js';
import {
  ModerationActivationConfigError,
  resolveModerationActivationConfig,
} from '../src/lib/moderation-config.js';

const KEY = `eg_mod_${'a'.repeat(32)}`;

function validEnv(overrides = {}) {
  return {
    MODERATION_API_KEY_HASHES_JSON: JSON.stringify({
      'primary-reviewer': hashModerationApiKey(KEY),
    }),
    MODERATION_RESPONSE_SLA_HOURS: '24',
    MODERATION_POLICY_VERSION: '2026-08-26-v1',
    MODERATION_RETENTION_POLICY_VERSION: '2026-08-26-v1',
    MODERATION_OWNER: 'EasyGo Trust and Safety',
    MODERATION_ESCALATION_CONTACT: 'safety@coineasy.xyz',
    ...overrides,
  };
}

test('runtime moderation activation requires the complete approved contract', () => {
  assert.deepEqual(resolveModerationActivationConfig(validEnv()), {
    responseSlaHours: 24,
    policyVersion: '2026-08-26-v1',
    retentionPolicyVersion: '2026-08-26-v1',
    owner: 'EasyGo Trust and Safety',
    escalationContact: 'safety@coineasy.xyz',
  });
});

test('runtime moderation activation rejects every missing or placeholder dependency', () => {
  for (const overrides of [
    { MODERATION_API_KEY_HASHES_JSON: '' },
    { MODERATION_RESPONSE_SLA_HOURS: '0' },
    { MODERATION_POLICY_VERSION: 'unapproved' },
    { MODERATION_RETENTION_POLICY_VERSION: 'draft-v1' },
    { MODERATION_OWNER: 'unassigned' },
    { MODERATION_ESCALATION_CONTACT: 'http://insecure.invalid' },
    { MODERATION_ESCALATION_CONTACT: 'https://user:secret@example.com/escalate' },
  ]) {
    assert.throws(
      () => resolveModerationActivationConfig(validEnv(overrides)),
      ModerationActivationConfigError,
    );
  }
});
