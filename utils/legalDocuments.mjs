const LEGACY_DOCUMENT_URLS = {
  help: 'https://drive.google.com/file/d/1x8ZvprutJSuv96KVz3vLyXHWXwi8AaVS/view?usp=sharing',
  privacy: 'https://drive.google.com/file/d/1Dhijs_O61shJEKNy6Sga16Iu3vgqwc8I/view?usp=sharing',
  terms: 'https://drive.google.com/file/d/17_d1L3-qBYKk3vAK9_P-zd2PKW3fNDiX/view?usp=sharing',
};

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

export function createLegalDocuments({
  consentVersion = '',
  helpUrl = '',
  privacyUrl = '',
  termsUrl = '',
} = {}) {
  const configuredHelpUrl = normalizeHttpsUrl(helpUrl);
  const configuredPrivacyUrl = normalizeHttpsUrl(privacyUrl);
  const configuredTermsUrl = normalizeHttpsUrl(termsUrl);
  const version = clean(consentVersion);

  return {
    version,
    help: {
      url: configuredHelpUrl || LEGACY_DOCUMENT_URLS.help,
      configured: Boolean(configuredHelpUrl),
    },
    privacy: {
      url: configuredPrivacyUrl || LEGACY_DOCUMENT_URLS.privacy,
      configured: Boolean(configuredPrivacyUrl),
    },
    terms: {
      url: configuredTermsUrl || LEGACY_DOCUMENT_URLS.terms,
      configured: Boolean(configuredTermsUrl),
    },
    versioned: Boolean(version && configuredPrivacyUrl && configuredTermsUrl),
  };
}

// Expo replaces direct process.env.EXPO_PUBLIC_* reads in release bundles.
// Keep these explicit instead of indexing process.env dynamically.
export const EASYGO_LEGAL_DOCUMENTS = createLegalDocuments({
  consentVersion: process.env.EXPO_PUBLIC_EASYGO_CONSENT_VERSION,
  helpUrl: process.env.EXPO_PUBLIC_EASYGO_HELP_URL,
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
