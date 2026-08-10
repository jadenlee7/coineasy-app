import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildConsentPayload,
  createConsentDraft,
  parseConsentEnvelope,
  safeConsentError,
  updateConsentDraft,
} from '../utils/consentState.mjs';
import {
  createLegalDocuments,
  getConsentDocumentReadiness,
} from '../utils/legalDocuments.mjs';

const VERSION = '2026-08-02-v1';

function legalDocuments(overrides = {}) {
  return createLegalDocuments({
    consentVersion: VERSION,
    privacyUrl: 'https://easygo.example/privacy/2026-08-02-v1',
    termsUrl: 'https://easygo.example/terms/2026-08-02-v1',
    ...overrides,
  });
}

function consentEnvelope(overrides = {}) {
  return {
    consent: {
      currentVersion: VERSION,
      acceptedVersion: null,
      requiresReconsent: true,
      termsAccepted: false,
      privacyAccepted: false,
      segmentingOptIn: false,
      marketingOptIn: false,
      grantsEnabled: true,
      termsAcceptedAt: null,
      privacyAcceptedAt: null,
      updatedAt: null,
      ...overrides,
    },
  };
}

test('versioned legal documents require two HTTPS URLs and an exact server version', () => {
  const ready = legalDocuments();
  assert.equal(ready.versioned, true);
  assert.deepEqual(getConsentDocumentReadiness(VERSION, ready), { ready: true, reason: null });
  assert.deepEqual(getConsentDocumentReadiness('new-version', ready), {
    ready: false,
    reason: 'version_mismatch',
  });

  const missing = createLegalDocuments({ consentVersion: VERSION });
  assert.equal(missing.versioned, false);
  assert.deepEqual(missing.help, { url: null, configured: false });
  assert.equal(getConsentDocumentReadiness(VERSION, missing).reason, 'documents_not_versioned');
  assert.equal(legalDocuments({ termsUrl: 'http://insecure.example' }).versioned, false);
  assert.equal(legalDocuments({ termsUrl: 'https://easygo.example/terms/wrong-version' }).versioned, false);
  assert.equal(legalDocuments({
    termsUrl: 'https://easygo.example/privacy/2026-08-02-v1',
  }).versioned, false);
});

test('consent responses are validated before they reach UI state', () => {
  const parsed = parseConsentEnvelope(consentEnvelope());
  assert.equal(parsed.currentVersion, VERSION);
  assert.equal(parsed.grantsEnabled, true);
  assert.equal(parseConsentEnvelope(consentEnvelope({ grantsEnabled: undefined })).grantsEnabled, false);
  assert.throws(
    () => parseConsentEnvelope(consentEnvelope({ marketingOptIn: 'yes' })),
    (error) => error.code === 'invalid_consent_response',
  );
  assert.throws(
    () => parseConsentEnvelope(null),
    (error) => error.code === 'invalid_consent_response',
  );
});

test('new consent grants fail closed when the server capability is absent or disabled', () => {
  const locked = parseConsentEnvelope(consentEnvelope({ grantsEnabled: false }));
  assert.throws(
    () => buildConsentPayload({
      consent: locked,
      documents: legalDocuments(),
      draft: createConsentDraft(locked),
    }),
    (error) => error.code === 'consent_grants_disabled',
  );
  assert.equal(safeConsentError({ code: 'consent_grants_disabled' }).code, 'consent_grants_disabled');
});

test('missing mandatory consent always forces optional processing off', () => {
  const accepted = parseConsentEnvelope(consentEnvelope({
    acceptedVersion: VERSION,
    requiresReconsent: false,
    termsAccepted: true,
    privacyAccepted: true,
    segmentingOptIn: true,
    marketingOptIn: true,
  }));
  const draft = createConsentDraft(accepted);
  assert.equal(draft.segmentingOptIn, true);

  const revoked = updateConsentDraft(draft, 'privacyAccepted', false);
  assert.deepEqual(revoked, {
    termsAccepted: true,
    privacyAccepted: false,
    segmentingOptIn: false,
    marketingOptIn: false,
  });
  assert.equal(updateConsentDraft(revoked, 'segmentingOptIn', true).segmentingOptIn, false);
});

test('a version bump starts every re-consent choice off', () => {
  const stale = parseConsentEnvelope(consentEnvelope({
    acceptedVersion: 'old-version',
    requiresReconsent: true,
    termsAccepted: true,
    privacyAccepted: true,
    segmentingOptIn: false,
    marketingOptIn: false,
  }));
  assert.deepEqual(createConsentDraft(stale), {
    termsAccepted: false,
    privacyAccepted: false,
    segmentingOptIn: false,
    marketingOptIn: false,
  });
});

test('consent updates are exact full replacements bound to the published version', () => {
  const consent = parseConsentEnvelope(consentEnvelope());
  const payload = buildConsentPayload({
    consent,
    documents: legalDocuments(),
    draft: {
      termsAccepted: true,
      privacyAccepted: true,
      segmentingOptIn: false,
      marketingOptIn: true,
      unexpected: true,
    },
  });
  assert.deepEqual(payload, {
    consentVersion: VERSION,
    termsAccepted: true,
    privacyAccepted: true,
    segmentingOptIn: false,
    marketingOptIn: true,
  });

  assert.throws(
    () => buildConsentPayload({
      consent,
      draft: payload,
      documents: legalDocuments({
        consentVersion: 'old',
        privacyUrl: 'https://easygo.example/privacy/old',
        termsUrl: 'https://easygo.example/terms/old',
      }),
    }),
    (error) => error.code === 'version_mismatch',
  );
});

test('consent errors expose safe fixed copy instead of backend payloads', () => {
  const error = safeConsentError({
    status: 409,
    message: 'token did:privy:secret wallet 0x123',
    body: { currentVersion: 'secret' },
  });
  assert.equal(error.code, 'version_changed');
  assert.equal(error.message.includes('did:privy'), false);
  assert.equal(safeConsentError({ status: 503 }).code, 'policy_unavailable');
  assert.equal(safeConsentError(new Error('private raw failure')).code, 'consent_unavailable');
});

test('Login and Settings share one legal-document source', () => {
  const login = readFileSync(new URL('../screens/Login.js', import.meta.url), 'utf8');
  const settings = readFileSync(
    new URL('../components/modals/SettingsModal.js', import.meta.url),
    'utf8',
  );
  const consentHook = readFileSync(
    new URL('../hooks/useConsent.js', import.meta.url),
    'utf8',
  );
  assert.equal(login.includes('EASYGO_LEGAL_DOCUMENTS'), true);
  assert.equal(settings.includes('EASYGO_LEGAL_DOCUMENTS'), true);
  assert.equal(settings.includes('consentState.revokeAll'), true);
  assert.match(settings, /performExport\(kind, expectedOperation\)/);
  assert.match(settings, /if \(!isCurrentExport\(\)\) return/);
  assert.match(
    settings,
    /isCurrentAccountOperation\(expectedOperation\) \? revokeAll\(\) : null/,
  );
  assert.match(
    settings,
    /const signOut = async \(\) => \{[\s\S]*?const expectedOperation = accountOperationRef\.current;[\s\S]*?await logout\(\);[\s\S]*?if \(!isCurrentAccountOperation\(expectedOperation\)\) return;[\s\S]*?setUser\(null\);/,
  );
  assert.match(
    settings,
    /catch \{\s*if \(!isCurrentAccountOperation\(expectedOperation\)\) return;\s*Alert\.alert\('Could not sign out'/,
  );
  assert.match(consentHook, /!mountedRef\.current/);
  assert.match(consentHook, /expectedAuthUserId: authOwnerUserId/);
  assert.equal(readFileSync(
    new URL('../utils/legalDocuments.mjs', import.meta.url),
    'utf8',
  ).includes('drive.google.com/file/d/'), false);
  assert.equal(login.includes('drive.google.com/file/d/'), false);
  assert.equal(settings.includes('drive.google.com/file/d/'), false);
});
