import assert from 'node:assert/strict';
import test from 'node:test';
import { adminRouter } from '../src/routes/admin.js';

test('S7 advertiser routes are scoped by both phase and advertiser authentication', () => {
  const routes = adminRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
      middlewareCount: layer.route.stack.length,
    }));

  assert.deepEqual(routes, [
    { path: '/me', methods: ['GET'], middlewareCount: 3 },
    { path: '/campaigns', methods: ['GET'], middlewareCount: 3 },
    { path: '/campaigns', methods: ['POST'], middlewareCount: 3 },
    { path: '/campaigns/:campaignId', methods: ['GET'], middlewareCount: 3 },
    { path: '/campaigns/:campaignId', methods: ['PATCH'], middlewareCount: 3 },
    { path: '/campaigns/:campaignId/report', methods: ['GET'], middlewareCount: 3 },
  ]);
});
