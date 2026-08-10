import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLegalDocumentHandler,
  legalManifest,
  legalRouter,
  LEGAL_DOCUMENT_STATUS,
  LEGAL_DOCUMENT_VERSION,
} from '../src/routes/legal.js';

function responseDouble() {
  return {
    body: null,
    headers: {},
    contentType: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    type(value) {
      this.contentType = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
  };
}

test('legal manifest pins one review version to distinct privacy and terms paths', () => {
  const manifest = legalManifest();
  assert.equal(manifest.product, 'EasyGo');
  assert.equal(manifest.version, LEGAL_DOCUMENT_VERSION);
  assert.equal(manifest.status, LEGAL_DOCUMENT_STATUS);
  assert.equal(manifest.publishedForConsent, false);
  assert.match(manifest.privacy.path, new RegExp(`/${LEGAL_DOCUMENT_VERSION}/privacy$`));
  assert.match(manifest.terms.path, new RegExp(`/${LEGAL_DOCUMENT_VERSION}/terms$`));
  assert.notEqual(manifest.privacy.path, manifest.terms.path);
});

test('legal router exposes only manifest and the exact versioned documents', () => {
  const routes = legalRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);
  assert.deepEqual(routes, [
    '/manifest.json',
    `/${LEGAL_DOCUMENT_VERSION}/privacy`,
    `/${LEGAL_DOCUMENT_VERSION}/terms`,
  ]);
});

test('legal HTML is branded, versioned, bilingual, and clearly review-only', () => {
  for (const kind of ['privacy', 'terms']) {
    const response = responseDouble();
    createLegalDocumentHandler(kind)({}, response);
    assert.equal(response.contentType, 'html');
    assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(response.headers['X-Robots-Tag'], 'noindex, nofollow');
    assert.match(response.body, /EasyGo/);
    assert.match(response.body, new RegExp(LEGAL_DOCUMENT_VERSION));
    assert.match(response.body, /internal TestFlight staging candidate/i);
    assert.match(response.body, /contact@coineasy\.xyz/);
    assert.doesNotMatch(response.body, /drive\.google\.com/);
  }
});

test('unknown legal document kinds are rejected before a response is sent', () => {
  assert.throws(() => createLegalDocumentHandler('unknown'), /unknown legal document/);
});
