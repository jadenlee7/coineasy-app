import {
  MODERATION_CAPABILITIES,
  MODERATION_DESTRUCTIVE_MFA_MAX_AGE_SECONDS,
} from './moderation-principal.js';

export const MODERATION_DECISION = Object.freeze({
  REMOVE_POST: 'REMOVE_POST',
  DISMISS: 'DISMISS',
});

const DECISION_POLICIES = Object.freeze({
  [MODERATION_DECISION.REMOVE_POST]: Object.freeze({
    maxMfaAgeSeconds: MODERATION_DESTRUCTIVE_MFA_MAX_AGE_SECONDS,
    requiredCapabilities: Object.freeze([
      MODERATION_CAPABILITIES.REPORT_DECIDE,
      MODERATION_CAPABILITIES.CONTENT_REMOVE,
    ]),
  }),
  [MODERATION_DECISION.DISMISS]: Object.freeze({
    maxMfaAgeSeconds: null,
    requiredCapabilities: Object.freeze([
      MODERATION_CAPABILITIES.REPORT_DECIDE,
    ]),
  }),
});

export const MODERATION_DECISIONS = Object.freeze(Object.keys(DECISION_POLICIES));

export function getModerationDecisionPolicy(value) {
  if (typeof value !== 'string' || !Object.hasOwn(DECISION_POLICIES, value)) {
    return null;
  }
  return DECISION_POLICIES[value];
}
