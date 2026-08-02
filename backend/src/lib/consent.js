import { z } from 'zod';

export const DEFAULT_CONSENT_VERSION = '2026-07-21';

export const consentUpdateSchema = z.object({
  consentVersion: z.string().min(1).max(50),
  termsAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
  segmentingOptIn: z.boolean(),
  marketingOptIn: z.boolean(),
}).strict();

export function getCurrentConsentVersion(env = process.env) {
  const configured = String(env.EASYGO_CONSENT_VERSION || '').trim();
  if (!configured && env.NODE_ENV === 'production') {
    throw new Error('EASYGO_CONSENT_VERSION is required in production');
  }
  const version = configured || DEFAULT_CONSENT_VERSION;
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(version)) {
    throw new Error('EASYGO_CONSENT_VERSION is invalid');
  }
  return version;
}

export function consentGrantsEnabled(env = process.env) {
  return String(env.CONSENT_GRANTS_ENABLED || '').trim().toLowerCase() === 'true';
}

export function consentUpdateAddsPermission({ existing, input, currentVersion }) {
  const sameVersion = existing?.consentVersion === currentVersion;
  const existingTerms = sameVersion && Boolean(existing?.termsAcceptedAt);
  const existingPrivacy = sameVersion && Boolean(existing?.privacyAcceptedAt);
  const existingBase = existingTerms && existingPrivacy;
  const current = {
    termsAccepted: existingTerms,
    privacyAccepted: existingPrivacy,
    segmentingOptIn: existingBase && Boolean(existing?.segmentingOptIn),
    marketingOptIn: existingBase && Boolean(existing?.marketingOptIn),
  };
  return [
    'termsAccepted',
    'privacyAccepted',
    'segmentingOptIn',
    'marketingOptIn',
  ].some((field) => Boolean(input?.[field]) && !current[field]);
}

export function consentView(record, currentVersion = getCurrentConsentVersion()) {
  const termsAccepted = Boolean(record?.termsAcceptedAt);
  const privacyAccepted = Boolean(record?.privacyAcceptedAt);
  const requiresReconsent = !record
    || record.consentVersion !== currentVersion
    || !termsAccepted
    || !privacyAccepted;

  return {
    currentVersion,
    acceptedVersion: record?.consentVersion || null,
    requiresReconsent,
    termsAccepted,
    privacyAccepted,
    // Old or incomplete consent never remains effective after a version bump.
    segmentingOptIn: requiresReconsent ? false : Boolean(record?.segmentingOptIn),
    marketingOptIn: requiresReconsent ? false : Boolean(record?.marketingOptIn),
    termsAcceptedAt: record?.termsAcceptedAt || null,
    privacyAcceptedAt: record?.privacyAcceptedAt || null,
    updatedAt: record?.updatedAt || null,
  };
}

function anyPermissionRevoked(existing, next) {
  return (
    Boolean(existing?.termsAcceptedAt) && !next.termsAccepted
    || Boolean(existing?.privacyAcceptedAt) && !next.privacyAccepted
    || Boolean(existing?.segmentingOptIn) && !next.segmentingOptIn
    || Boolean(existing?.marketingOptIn) && !next.marketingOptIn
  );
}

export function buildConsentMutation({
  existing = null,
  input,
  currentVersion = getCurrentConsentVersion(),
  now = new Date(),
}) {
  if (input.consentVersion !== currentVersion) {
    const error = new Error('consent version is stale');
    error.code = 'consent_version_mismatch';
    throw error;
  }

  if ((input.segmentingOptIn || input.marketingOptIn)
      && (!input.termsAccepted || !input.privacyAccepted)) {
    const error = new Error('base consent is required for optional processing');
    error.code = 'base_consent_required';
    throw error;
  }

  const sameVersion = existing?.consentVersion === currentVersion;
  const data = {
    consentVersion: currentVersion,
    termsAcceptedAt: input.termsAccepted
      ? (sameVersion && existing?.termsAcceptedAt || now)
      : null,
    privacyAcceptedAt: input.privacyAccepted
      ? (sameVersion && existing?.privacyAcceptedAt || now)
      : null,
    segmentingOptIn: input.segmentingOptIn,
    marketingOptIn: input.marketingOptIn,
  };

  let action = 'UPDATED';
  if (!existing && (input.termsAccepted || input.privacyAccepted)) {
    action = 'GRANTED';
  } else if (existing && !sameVersion) {
    action = 'VERSION_RESET';
  } else if (anyPermissionRevoked(existing, input)) {
    action = 'REVOKED';
  }

  return { data, action };
}
