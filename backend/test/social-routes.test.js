import assert from 'node:assert/strict';
import test from 'node:test';
import { socialRouter } from '../src/routes/social.js';

test('S8 exposes one public capability endpoint outside the retirement gate', () => {
  const routes = socialRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
    }));
  assert.deepEqual(routes, [{ path: '/status', methods: ['GET'] }]);
});
