import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getModerationDecisionPolicy,
  MODERATION_DECISION,
  MODERATION_DECISIONS,
} from '../src/lib/moderation-decisions.js';
import {
  MODERATION_CAPABILITIES,
  MODERATION_DESTRUCTIVE_MFA_MAX_AGE_SECONDS,
} from '../src/lib/moderation-principal.js';

test('decision policy is the frozen source for service values and route authorization', () => {
  assert.deepEqual(MODERATION_DECISIONS, ['REMOVE_POST', 'DISMISS']);
  assert.equal(Object.isFrozen(MODERATION_DECISIONS), true);
  assert.equal(Object.isFrozen(MODERATION_DECISION), true);

  const dismiss = getModerationDecisionPolicy(MODERATION_DECISION.DISMISS);
  assert.deepEqual(dismiss, {
    maxMfaAgeSeconds: null,
    requiredCapabilities: [MODERATION_CAPABILITIES.REPORT_DECIDE],
  });

  const remove = getModerationDecisionPolicy(MODERATION_DECISION.REMOVE_POST);
  assert.deepEqual(remove, {
    maxMfaAgeSeconds: MODERATION_DESTRUCTIVE_MFA_MAX_AGE_SECONDS,
    requiredCapabilities: [
      MODERATION_CAPABILITIES.REPORT_DECIDE,
      MODERATION_CAPABILITIES.CONTENT_REMOVE,
    ],
  });
  assert.equal(Object.isFrozen(dismiss), true);
  assert.equal(Object.isFrozen(remove), true);
  assert.equal(Object.isFrozen(remove.requiredCapabilities), true);
});

test('unknown or malformed decisions do not receive an authorization policy', () => {
  for (const value of [undefined, null, '', 'BAN_USER', {}, ['DISMISS']]) {
    assert.equal(getModerationDecisionPolicy(value), null);
  }
});
