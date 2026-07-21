import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildConsentMutation,
  consentUpdateSchema,
  consentView,
  getCurrentConsentVersion,
} from '../src/lib/consent.js';

const CURRENT_VERSION = '2026-07-21';
const NOW = new Date('2026-07-21T12:00:00.000Z');

function acceptedRecord(overrides = {}) {
  return {
    consentVersion: CURRENT_VERSION,
    termsAcceptedAt: new Date('2026-07-20T10:00:00.000Z'),
    privacyAcceptedAt: new Date('2026-07-20T10:00:00.000Z'),
    segmentingOptIn: true,
    marketingOptIn: true,
    updatedAt: new Date('2026-07-20T10:00:00.000Z'),
    ...overrides,
  };
}

test('missing and stale consent is effective deny-by-default', () => {
  assert.deepEqual(consentView(null, CURRENT_VERSION), {
    currentVersion: CURRENT_VERSION,
    acceptedVersion: null,
    requiresReconsent: true,
    termsAccepted: false,
    privacyAccepted: false,
    segmentingOptIn: false,
    marketingOptIn: false,
    termsAcceptedAt: null,
    privacyAcceptedAt: null,
    updatedAt: null,
  });

  const stale = consentView(acceptedRecord({ consentVersion: '2026-01-01' }), CURRENT_VERSION);
  assert.equal(stale.requiresReconsent, true);
  assert.equal(stale.segmentingOptIn, false);
  assert.equal(stale.marketingOptIn, false);
});

test('current complete consent exposes only the stored choices', () => {
  const view = consentView(acceptedRecord({ marketingOptIn: false }), CURRENT_VERSION);
  assert.equal(view.requiresReconsent, false);
  assert.equal(view.segmentingOptIn, true);
  assert.equal(view.marketingOptIn, false);
});

test('consent update requires the exact current version and base consent', () => {
  const base = {
    consentVersion: CURRENT_VERSION,
    termsAccepted: true,
    privacyAccepted: true,
    segmentingOptIn: false,
    marketingOptIn: false,
  };

  assert.throws(
    () => buildConsentMutation({
      input: { ...base, consentVersion: 'stale' },
      currentVersion: CURRENT_VERSION,
    }),
    (error) => error.code === 'consent_version_mismatch',
  );
  assert.throws(
    () => buildConsentMutation({
      input: { ...base, privacyAccepted: false, segmentingOptIn: true },
      currentVersion: CURRENT_VERSION,
    }),
    (error) => error.code === 'base_consent_required',
  );
});

test('consent mutations preserve timestamps and classify grants and revocations', () => {
  const grant = buildConsentMutation({
    input: {
      consentVersion: CURRENT_VERSION,
      termsAccepted: true,
      privacyAccepted: true,
      segmentingOptIn: false,
      marketingOptIn: false,
    },
    currentVersion: CURRENT_VERSION,
    now: NOW,
  });
  assert.equal(grant.action, 'GRANTED');
  assert.equal(grant.data.termsAcceptedAt, NOW);

  const existing = acceptedRecord();
  const revoke = buildConsentMutation({
    existing,
    input: {
      consentVersion: CURRENT_VERSION,
      termsAccepted: true,
      privacyAccepted: true,
      segmentingOptIn: false,
      marketingOptIn: true,
    },
    currentVersion: CURRENT_VERSION,
    now: NOW,
  });
  assert.equal(revoke.action, 'REVOKED');
  assert.equal(revoke.data.termsAcceptedAt, existing.termsAcceptedAt);
});

test('version changes produce a reset audit action and fresh timestamps', () => {
  const mutation = buildConsentMutation({
    existing: acceptedRecord({ consentVersion: '2026-01-01' }),
    input: {
      consentVersion: CURRENT_VERSION,
      termsAccepted: true,
      privacyAccepted: true,
      segmentingOptIn: true,
      marketingOptIn: false,
    },
    currentVersion: CURRENT_VERSION,
    now: NOW,
  });
  assert.equal(mutation.action, 'VERSION_RESET');
  assert.equal(mutation.data.termsAcceptedAt, NOW);
  assert.equal(mutation.data.privacyAcceptedAt, NOW);
});

test('consent payload is complete and strict', () => {
  assert.equal(consentUpdateSchema.safeParse({}).success, false);
  assert.equal(consentUpdateSchema.safeParse({
    consentVersion: CURRENT_VERSION,
    termsAccepted: true,
    privacyAccepted: true,
    segmentingOptIn: false,
    marketingOptIn: false,
    unexpected: true,
  }).success, false);
  assert.equal(getCurrentConsentVersion({ EASYGO_CONSENT_VERSION: CURRENT_VERSION }), CURRENT_VERSION);
  assert.throws(
    () => getCurrentConsentVersion({ NODE_ENV: 'production' }),
    /required in production/,
  );
});
