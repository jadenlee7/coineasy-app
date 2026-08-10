import { readFileSync } from 'node:fs';
import { Router } from 'express';
import {
  LEGAL_DOCUMENT_STATUS,
  LEGAL_DOCUMENT_VERSION,
} from '../lib/legal.js';

export { LEGAL_DOCUMENT_STATUS, LEGAL_DOCUMENT_VERSION };

const DOCUMENTS = Object.freeze({
  privacy: Object.freeze({
    path: `/legal/${LEGAL_DOCUMENT_VERSION}/privacy`,
    html: readFileSync(
      new URL(`../../legal/${LEGAL_DOCUMENT_VERSION}/privacy.html`, import.meta.url),
      'utf8',
    ),
  }),
  terms: Object.freeze({
    path: `/legal/${LEGAL_DOCUMENT_VERSION}/terms`,
    html: readFileSync(
      new URL(`../../legal/${LEGAL_DOCUMENT_VERSION}/terms.html`, import.meta.url),
      'utf8',
    ),
  }),
});

function publicLegalDocument(document) {
  return {
    path: document.path,
    version: LEGAL_DOCUMENT_VERSION,
  };
}

export function legalManifest() {
  return {
    product: 'EasyGo',
    version: LEGAL_DOCUMENT_VERSION,
    status: LEGAL_DOCUMENT_STATUS,
    publishedForConsent: false,
    privacy: publicLegalDocument(DOCUMENTS.privacy),
    terms: publicLegalDocument(DOCUMENTS.terms),
  };
}

export function createLegalManifestHandler() {
  return function manifest(_req, res) {
    res.set('Cache-Control', 'public, max-age=300');
    return res.json(legalManifest());
  };
}

export function createLegalDocumentHandler(kind) {
  const document = DOCUMENTS[kind];
  if (!document) throw new TypeError('unknown legal document');

  return function legalDocument(_req, res) {
    res.set('Cache-Control', 'public, max-age=300');
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    return res.type('html').send(document.html);
  };
}

export const legalRouter = Router();
legalRouter.get('/manifest.json', createLegalManifestHandler());
legalRouter.get(`/${LEGAL_DOCUMENT_VERSION}/privacy`, createLegalDocumentHandler('privacy'));
legalRouter.get(`/${LEGAL_DOCUMENT_VERSION}/terms`, createLegalDocumentHandler('terms'));
