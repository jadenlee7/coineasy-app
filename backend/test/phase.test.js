import assert from 'node:assert/strict';
import test from 'node:test';
import { requirePhase } from '../src/middleware/phase.js';

test('disabled phase surfaces stay invisible', () => {
  const middleware = requirePhase('SIWE_AUTH_ENABLED', { SIWE_AUTH_ENABLED: false });
  let nextCalled = false;
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  middleware({}, response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: 'not_found' });
});

test('enabled phase delegates to the route', () => {
  const middleware = requirePhase('SIWE_AUTH_ENABLED', { SIWE_AUTH_ENABLED: true });
  let nextCalled = false;
  middleware({}, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
