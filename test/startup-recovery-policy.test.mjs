import assert from 'node:assert/strict';
import test from 'node:test';

import { startupRecoveryRequired } from '../utils/startupRecoveryPolicy.mjs';

test('same-build interrupted automatic startup enters diagnostic recovery', () => {
  assert.equal(startupRecoveryRequired({
    build: '108',
    step: 'full-app-render',
    status: 'pending',
  }, '108'), true);
  assert.equal(startupRecoveryRequired({
    build: '108',
    step: 'full-provider-ready',
    status: 'failed',
  }, '108'), true);
  assert.equal(startupRecoveryRequired({
    build: '108',
    step: 'privy-raw-webview',
    status: 'pending',
  }, '108'), true);
});

test('successful, old-build, unknown, and malformed markers boot normally', () => {
  assert.equal(startupRecoveryRequired({
    build: '108',
    step: 'full-provider-ready',
    status: 'passed',
  }, '108'), false);
  assert.equal(startupRecoveryRequired({
    build: '107',
    step: 'full-app-render',
    status: 'pending',
  }, '108'), false);
  assert.equal(startupRecoveryRequired({
    build: '108',
    step: 'unrelated-feature',
    status: 'failed',
  }, '108'), false);
  assert.equal(startupRecoveryRequired(null, '108'), false);
  assert.equal(startupRecoveryRequired({}, '108'), false);
});
