import { parseModerationKeyHashes } from './moderation-auth.js';

const APPROVED_VERSION_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/u;
const PLACEHOLDER_PATTERN = /(?:candidate|draft|tbd|unknown|unapproved)/iu;
const OWNER_PLACEHOLDER_PATTERN = /^(?:unassigned|undefined|tbd|unknown|none)$/iu;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/u;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function approvedVersion(value) {
  return APPROVED_VERSION_PATTERN.test(value) && !PLACEHOLDER_PATTERN.test(value);
}

function approvedContact(value) {
  if (EMAIL_PATTERN.test(value)) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && Boolean(parsed.hostname)
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

export class ModerationActivationConfigError extends Error {
  constructor() {
    super('moderation activation configuration is invalid');
    this.name = 'ModerationActivationConfigError';
  }
}

export function resolveModerationActivationConfig(env = process.env) {
  try {
    parseModerationKeyHashes(clean(env.MODERATION_API_KEY_HASHES_JSON));
  } catch {
    throw new ModerationActivationConfigError();
  }

  const responseSlaHours = Number(clean(env.MODERATION_RESPONSE_SLA_HOURS));
  const policyVersion = clean(env.MODERATION_POLICY_VERSION);
  const retentionPolicyVersion = clean(env.MODERATION_RETENTION_POLICY_VERSION);
  const owner = clean(env.MODERATION_OWNER);
  const escalationContact = clean(env.MODERATION_ESCALATION_CONTACT);

  if (
    !Number.isInteger(responseSlaHours)
    || responseSlaHours < 1
    || responseSlaHours > 168
    || !approvedVersion(policyVersion)
    || !approvedVersion(retentionPolicyVersion)
    || owner.length < 3
    || owner.length > 100
    || OWNER_PLACEHOLDER_PATTERN.test(owner)
    || !approvedContact(escalationContact)
  ) {
    throw new ModerationActivationConfigError();
  }

  return Object.freeze({
    responseSlaHours,
    policyVersion,
    retentionPolicyVersion,
    owner,
    escalationContact,
  });
}
