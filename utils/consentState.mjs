import {
  EASYGO_LEGAL_DOCUMENTS,
  getConsentDocumentReadiness,
} from './legalDocuments.mjs';

const BOOLEAN_FIELDS = [
  'termsAccepted',
  'privacyAccepted',
  'segmentingOptIn',
  'marketingOptIn',
];

const DRAFT_FIELDS = new Set(BOOLEAN_FIELDS);

function consentError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function parseConsentEnvelope(envelope) {
  const consent = envelope?.consent;
  if (!consent || typeof consent !== 'object' || Array.isArray(consent)) {
    throw consentError('invalid_consent_response');
  }
  if (typeof consent.currentVersion !== 'string' || !consent.currentVersion.trim()) {
    throw consentError('invalid_consent_response');
  }
  if (consent.acceptedVersion !== null && typeof consent.acceptedVersion !== 'string') {
    throw consentError('invalid_consent_response');
  }
  if (typeof consent.requiresReconsent !== 'boolean') {
    throw consentError('invalid_consent_response');
  }
  for (const field of BOOLEAN_FIELDS) {
    if (typeof consent[field] !== 'boolean') {
      throw consentError('invalid_consent_response');
    }
  }
  if (consent.grantsEnabled !== undefined && typeof consent.grantsEnabled !== 'boolean') {
    throw consentError('invalid_consent_response');
  }
  return {
    ...consent,
    currentVersion: consent.currentVersion.trim(),
    // Older servers omit this capability. Defaulting to false keeps new
    // clients fail-closed during a rolling backend/mobile deployment.
    grantsEnabled: consent.grantsEnabled === true,
  };
}

export function createConsentDraft(consent) {
  if (!consent) return null;
  if (consent.requiresReconsent) {
    return {
      termsAccepted: false,
      privacyAccepted: false,
      segmentingOptIn: false,
      marketingOptIn: false,
    };
  }
  return normalizeConsentDraft({
    termsAccepted: Boolean(consent.termsAccepted),
    privacyAccepted: Boolean(consent.privacyAccepted),
    segmentingOptIn: Boolean(consent.segmentingOptIn),
    marketingOptIn: Boolean(consent.marketingOptIn),
  });
}

export function normalizeConsentDraft(draft) {
  const normalized = {
    termsAccepted: Boolean(draft?.termsAccepted),
    privacyAccepted: Boolean(draft?.privacyAccepted),
    segmentingOptIn: Boolean(draft?.segmentingOptIn),
    marketingOptIn: Boolean(draft?.marketingOptIn),
  };
  if (!normalized.termsAccepted || !normalized.privacyAccepted) {
    normalized.segmentingOptIn = false;
    normalized.marketingOptIn = false;
  }
  return normalized;
}

export function updateConsentDraft(draft, field, value) {
  if (!DRAFT_FIELDS.has(field)) throw consentError('invalid_consent_field');
  return normalizeConsentDraft({ ...draft, [field]: Boolean(value) });
}

export function buildConsentPayload({
  consent,
  draft,
  documents = EASYGO_LEGAL_DOCUMENTS,
}) {
  if (!consent?.currentVersion) throw consentError('consent_not_loaded');
  if (consent.grantsEnabled !== true) throw consentError('consent_grants_disabled');
  const readiness = getConsentDocumentReadiness(consent.currentVersion, documents);
  if (!readiness.ready) throw consentError(readiness.reason);
  return {
    consentVersion: consent.currentVersion,
    ...normalizeConsentDraft(draft),
  };
}

export function safeConsentError(error) {
  if (error?.name === 'AbortError') return null;
  if (error?.status === 503 && error?.body?.error === 'consent_grants_disabled') {
    return {
      code: 'consent_grants_disabled',
      message: '정책 검토가 끝날 때까지 새 동의 또는 권한 확대는 잠겨 있습니다. 기존 동의 철회는 가능합니다.',
    };
  }
  if (error?.status === 409 || error?.code === 'consent_version_mismatch') {
    return {
      code: 'version_changed',
      message: '정책 버전이 변경되었습니다. 새 문서를 확인한 뒤 다시 선택해 주세요.',
    };
  }
  if (error?.status === 503) {
    return {
      code: 'policy_unavailable',
      message: '현재 정책 버전을 확인할 수 없습니다. 선택형 처리는 계속 꺼진 상태입니다.',
    };
  }
  if (error?.status === 404) {
    return {
      code: 'profile_not_ready',
      message: 'EasyGo 계정 동기화가 끝난 뒤 다시 시도해 주세요.',
    };
  }
  if (error?.code === 'documents_not_versioned') {
    return {
      code: error.code,
      message: 'EasyGo 전용 정책 문서가 버전과 함께 공개되기 전에는 동의를 저장하지 않습니다.',
    };
  }
  if (error?.code === 'version_mismatch') {
    return {
      code: error.code,
      message: '앱의 정책 문서 버전과 서버 버전이 일치하지 않아 동의 저장을 중단했습니다.',
    };
  }
  if (error?.code === 'consent_grants_disabled') {
    return {
      code: error.code,
      message: '운영자·법률 검토가 끝날 때까지 새 동의 저장은 잠겨 있습니다. 기존 동의 철회는 가능합니다.',
    };
  }
  return {
    code: 'consent_unavailable',
    message: '개인정보 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  };
}
