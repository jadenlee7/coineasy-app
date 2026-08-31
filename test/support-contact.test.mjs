import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EASYGO_SUPPORT_EMAIL,
  createSupportContact,
  normalizePublicSupportUrl,
} from '../utils/supportContact.mjs';

test('support contact always exposes the official EasyGo email action', () => {
  const contact = createSupportContact();
  assert.equal(EASYGO_SUPPORT_EMAIL, 'contact@coineasy.xyz');
  assert.equal(contact.email, EASYGO_SUPPORT_EMAIL);
  assert.equal(contact.mailtoUrl, 'mailto:contact@coineasy.xyz?subject=EasyGo%20support');
  assert.equal(contact.url, null);
  assert.equal(contact.configured, false);
});

test('support URLs require a stable public HTTPS page', () => {
  assert.equal(
    normalizePublicSupportUrl('https://support.coineasy.xyz/support'),
    'https://support.coineasy.xyz/support',
  );
  assert.equal(normalizePublicSupportUrl('http://support.coineasy.xyz/support'), null);
  assert.equal(normalizePublicSupportUrl('https://localhost/support'), null);
  assert.equal(normalizePublicSupportUrl('https://127.0.0.1/support'), null);
  assert.equal(normalizePublicSupportUrl('https://support.internal/support'), null);
  assert.equal(normalizePublicSupportUrl('https://easygo.example/support'), null);
  assert.equal(normalizePublicSupportUrl('https://placeholder.coineasy.xyz/support'), null);
  assert.equal(normalizePublicSupportUrl('https://user:pass@support.coineasy.xyz'), null);
  assert.equal(normalizePublicSupportUrl('https://support.coineasy.xyz:8443'), null);
  assert.equal(normalizePublicSupportUrl('https://support.coineasy.xyz/#draft'), null);
  assert.equal(normalizePublicSupportUrl('https://support.coineasy.xyz/support?ref=app'), null);
  assert.equal(normalizePublicSupportUrl('https://support.coineasy.xyz/support/'), null);
  assert.equal(normalizePublicSupportUrl('https://support.coineasy.xyz/easygo'), null);
});
