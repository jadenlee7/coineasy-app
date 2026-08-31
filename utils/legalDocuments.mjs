function clean(value) {
  return String(value || '').trim();
}

export function normalizeHttpsUrl(value) {
  const candidate = clean(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function legalUrlIncludesVersion(value, version) {
  const normalized = normalizeHttpsUrl(value);
  const expectedVersion = clean(version);
  if (!normalized || !expectedVersion) return false;
  const segments = new URL(normalized).pathname.split('/').filter(Boolean);
  return segments.includes(expectedVersion);
}

export function createLegalDocuments({
  consentVersion = '',
  privacyUrl = '',
  termsUrl = '',
} = {}) {
  const configuredPrivacyUrl = normalizeHttpsUrl(privacyUrl);
  const configuredTermsUrl = normalizeHttpsUrl(termsUrl);
  const version = clean(consentVersion);
  const privacyVersioned = legalUrlIncludesVersion(configuredPrivacyUrl, version);
  const termsVersioned = legalUrlIncludesVersion(configuredTermsUrl, version);

  return {
    version,
    privacy: {
      url: configuredPrivacyUrl,
      configured: Boolean(configuredPrivacyUrl),
      versioned: privacyVersioned,
    },
    terms: {
      url: configuredTermsUrl,
      configured: Boolean(configuredTermsUrl),
      versioned: termsVersioned,
    },
    versioned: Boolean(
      privacyVersioned
      && termsVersioned
      && configuredPrivacyUrl !== configuredTermsUrl
    ),
  };
}

// Expo replaces direct process.env.EXPO_PUBLIC_* reads in release bundles.
// Keep these explicit instead of indexing process.env dynamically.
export const EASYGO_LEGAL_DOCUMENTS = createLegalDocuments({
  consentVersion: process.env.EXPO_PUBLIC_EASYGO_CONSENT_VERSION,
  privacyUrl: process.env.EXPO_PUBLIC_EASYGO_PRIVACY_URL,
  termsUrl: process.env.EXPO_PUBLIC_EASYGO_TERMS_URL,
});

export function getConsentDocumentReadiness(
  serverVersion,
  documents = EASYGO_LEGAL_DOCUMENTS,
) {
  const currentVersion = clean(serverVersion);
  if (!documents?.versioned) {
    return { ready: false, reason: 'documents_not_versioned' };
  }
  if (!currentVersion || documents.version !== currentVersion) {
    return { ready: false, reason: 'version_mismatch' };
  }
  return { ready: true, reason: null };
}

export default EASYGO_LEGAL_DOCUMENTS;
