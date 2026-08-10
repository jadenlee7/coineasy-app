import assert from 'node:assert/strict';
import test from 'node:test';
import { questsRouter } from '../src/routes/quests.js';

test('S6 quest surface is authenticated and stays behind the phase gate', () => {
  const routes = questsRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).map((method) => method.toUpperCase()),
      middlewareCount: layer.route.stack.length,
    }));

  assert.deepEqual(routes, [
    { path: '/', methods: ['GET'], middlewareCount: 3 },
    { path: '/:questId/start', methods: ['POST'], middlewareCount: 3 },
    { path: '/:questId/complete', methods: ['POST'], middlewareCount: 3 },
  ]);
});
