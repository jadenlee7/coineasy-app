import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import {
  requireSwapExecution,
  SWAP_EXECUTION_READY,
  swapExecutionEnabled,
} from '../src/lib/swap-execution-gates.js';
import { swapRouter } from '../src/routes/swap.js';

function responseDouble() {
  return {
    statusCode: 200,
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
}

test('legacy swap execution remains compile-time locked', () => {
  assert.equal(SWAP_EXECUTION_READY, false);
  assert.equal(swapExecutionEnabled({ SWAP_EXECUTION_ENABLED: 'false' }), false);
  assert.equal(swapExecutionEnabled({ SWAP_EXECUTION_ENABLED: 'true' }), false);
  assert.equal(swapExecutionEnabled({ SWAP_EXECUTION_ENABLED: ' TRUE ' }), false);
});

test('legacy swap gate returns not_found without reaching downstream middleware', () => {
  const response = responseDouble();
  let nextCalls = 0;

  requireSwapExecution({}, response, () => {
    nextCalls += 1;
  });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: 'not_found' });
  assert.equal(nextCalls, 0);
});

test('HTTP router hides legacy execution routes while preview still reaches auth', async () => {
  const app = express();
  app.use(express.json());
  app.use('/swap', swapRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const address = server.address();
    assert.equal(typeof address, 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    for (const path of ['/swap/quote', '/swap/log']) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'not_found' });
    }

    const preview = await fetch(`${baseUrl}/swap/quote-preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(preview.status, 401);
    assert.deepEqual(await preview.json(), { error: 'missing_bearer' });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
