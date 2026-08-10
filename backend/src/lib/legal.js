export const LEGAL_DOCUMENT_VERSION = '2026-08-10-staging-v1';
export const LEGAL_DOCUMENT_STATUS = 'staging_candidate';

export function legalDocumentsApproved() {
  return LEGAL_DOCUMENT_STATUS === 'approved';
}
