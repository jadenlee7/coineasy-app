import assert from 'node:assert/strict';
import test from 'node:test';
import { segmentsRouter } from '../src/routes/segments.js';

test('S5 segment memberships are read-only and stay behind the phase gate', () => {
  const routes = segmentsRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
      middlewareCount: layer.route.stack.length,
    }));

  assert.deepEqual(routes, [
    { path: '/', methods: ['GET'], middlewareCount: 3 },
  ]);
});
