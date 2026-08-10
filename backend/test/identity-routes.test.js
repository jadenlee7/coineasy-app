import assert from 'node:assert/strict';
import test from 'node:test';
import { identityRouter } from '../src/routes/identity.js';

test('S4 identity route surface stays behind the JustaName gate', () => {
  const routes = identityRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
      middlewareCount: layer.route.stack.length,
    }));

  assert.deepEqual(routes, [
    { path: '/subname', methods: ['GET'], middlewareCount: 3 },
    { path: '/subname/challenge', methods: ['POST'], middlewareCount: 3 },
    { path: '/issue-subname', methods: ['POST'], middlewareCount: 3 },
  ]);
});
