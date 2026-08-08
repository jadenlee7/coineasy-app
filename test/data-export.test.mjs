import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DataExportError,
  EXPORT_SCOPE,
  buildExportFilename,
  cleanupStaleExportFiles,
  isEasyGoExportFilename,
  serializeExportEnvelope,
  validateExportEnvelope,
  withTemporaryJsonFile,
} from '../utils/dataExport.mjs';

function exportEnvelope(overrides = {}) {
  return {
    schemaVersion: 1,
    scope: EXPORT_SCOPE.full,
    exportedAt: '2026-08-02T19:37:23.229Z',
    data: { id: 'user_1', ledger: [] },
    ...overrides,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('export envelope validation accepts a versioned response for the expected scope', () => {
  const payload = exportEnvelope();
  assert.equal(validateExportEnvelope(payload, EXPORT_SCOPE.full), payload);
});

test('export envelope validation rejects malformed or mismatched responses', () => {
  const cases = [
    [null, EXPORT_SCOPE.full, 'invalid_envelope'],
    [[], EXPORT_SCOPE.full, 'invalid_envelope'],
    [exportEnvelope({ schemaVersion: 0 }), EXPORT_SCOPE.full, 'invalid_schema_version'],
    [exportEnvelope({ schemaVersion: 1.5 }), EXPORT_SCOPE.full, 'invalid_schema_version'],
    [exportEnvelope({ scope: EXPORT_SCOPE.social }), EXPORT_SCOPE.full, 'scope_mismatch'],
    [exportEnvelope({ exportedAt: 'not-a-date' }), EXPORT_SCOPE.full, 'invalid_exported_at'],
    [exportEnvelope({ data: null }), EXPORT_SCOPE.full, 'invalid_export_data'],
    [exportEnvelope({ data: [] }), EXPORT_SCOPE.full, 'invalid_export_data'],
    [exportEnvelope(), 'unknown_scope', 'unsupported_scope'],
  ];

  for (const [payload, scope, expectedCode] of cases) {
    assert.throws(
      () => validateExportEnvelope(payload, scope),
      (error) => error instanceof DataExportError && error.code === expectedCode,
    );
  }
});

test('serialization produces readable JSON with one trailing newline', () => {
  const payload = exportEnvelope();
  assert.equal(
    serializeExportEnvelope(payload, EXPORT_SCOPE.full),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
});

test('filenames are deterministic, scope-controlled, and path safe', () => {
  assert.equal(
    buildExportFilename(EXPORT_SCOPE.full, '2026-08-02T19:37:23.229Z'),
    'easygo-full-data-20260802T193723229Z.json',
  );
  assert.equal(
    buildExportFilename(EXPORT_SCOPE.social, '2026-08-02T23:37:23.229+04:00'),
    'easygo-social-data-20260802T193723229Z.json',
  );
});

test('temporary JSON export writes, shares, then removes the cache file', async () => {
  const payload = exportEnvelope();
  const calls = [];
  const shareResult = { action: 'sharedAction' };

  const result = await withTemporaryJsonFile({
    directory: 'file:///app/cache',
    payload,
    expectedScope: EXPORT_SCOPE.full,
    write: async (uri, contents) => calls.push(['write', uri, contents]),
    share: async (uri, filename) => {
      calls.push(['share', uri, filename]);
      return shareResult;
    },
    remove: async (uri) => calls.push(['remove', uri]),
  });

  const expectedUri = 'file:///app/cache/easygo-full-data-20260802T193723229Z.json';
  assert.equal(result, shareResult);
  assert.deepEqual(calls, [
    ['write', expectedUri, `${JSON.stringify(payload, null, 2)}\n`],
    ['share', expectedUri, 'easygo-full-data-20260802T193723229Z.json'],
    ['remove', expectedUri],
  ]);
});

test('temporary JSON export reports when both the operation and cleanup fail', async () => {
  const writeError = new Error('write failed');
  let shared = false;

  await assert.rejects(
    withTemporaryJsonFile({
      directory: 'file:///app/cache/',
      payload: exportEnvelope(),
      expectedScope: EXPORT_SCOPE.full,
      write: async () => { throw writeError; },
      share: async () => { shared = true; },
      remove: async () => { throw new Error('cleanup failed'); },
    }),
    (error) => error instanceof DataExportError
      && error.code === 'operation_cleanup_failed',
  );
  assert.equal(shared, false);
});

test('temporary JSON export cleans up after sharing fails', async () => {
  const shareError = new Error('share failed');
  let removedUri = null;

  await assert.rejects(
    withTemporaryJsonFile({
      directory: 'file:///app/cache/',
      payload: exportEnvelope(),
      expectedScope: EXPORT_SCOPE.full,
      write: async () => {},
      share: async () => { throw shareError; },
      remove: async (uri) => { removedUri = uri; },
    }),
    (error) => error === shareError,
  );
  assert.equal(
    removedUri,
    'file:///app/cache/easygo-full-data-20260802T193723229Z.json',
  );
});

test('temporary JSON export surfaces cleanup failure after a successful share', async () => {
  const cleanupError = new Error('cleanup failed');
  await assert.rejects(
    withTemporaryJsonFile({
      directory: 'file:///app/cache/',
      payload: exportEnvelope(),
      expectedScope: EXPORT_SCOPE.full,
      write: async () => {},
      share: async () => ({ action: 'sharedAction' }),
      remove: async () => { throw cleanupError; },
    }),
    (error) => error instanceof DataExportError && error.code === 'cleanup_failed',
  );
});

test('stale cleanup targets only EasyGo export filenames', async () => {
  assert.equal(isEasyGoExportFilename('easygo-full-data-20260802T193723229Z.json'), true);
  assert.equal(isEasyGoExportFilename('easygo-social-data-20260802T193723229Z.json'), true);
  assert.equal(isEasyGoExportFilename('../easygo-full-data-secret.json'), false);
  assert.equal(isEasyGoExportFilename('easygo-full-data-../../secret.json'), false);
  assert.equal(isEasyGoExportFilename('profile.json'), false);

  const removed = [];
  const result = await cleanupStaleExportFiles({
    directory: 'file:///cache',
    list: async () => [
      'easygo-full-data-20260802T193723229Z.json',
      'unrelated.json',
      'easygo-social-data-20260802T193723229Z.json',
    ],
    remove: async (uri) => {
      removed.push(uri);
      if (uri.includes('social')) throw new Error('locked');
    },
  });
  assert.deepEqual(removed, [
    'file:///cache/easygo-full-data-20260802T193723229Z.json',
    'file:///cache/easygo-social-data-20260802T193723229Z.json',
  ]);
  assert.deepEqual(result, { removed: 1, failed: 1 });
});

test('stale cleanup waits for an active export file operation', async () => {
  const sharing = deferred();
  const releaseShare = deferred();
  const events = [];
  const activeExport = withTemporaryJsonFile({
    directory: 'file:///cache',
    payload: exportEnvelope(),
    expectedScope: EXPORT_SCOPE.full,
    write: async () => { events.push('write'); },
    share: async () => {
      events.push('share:start');
      sharing.resolve();
      await releaseShare.promise;
      events.push('share:end');
    },
    remove: async () => { events.push('export:remove'); },
  });
  await sharing.promise;

  const cleanup = cleanupStaleExportFiles({
    directory: 'file:///cache',
    list: async () => {
      events.push('cleanup:list');
      return [];
    },
    remove: async () => {},
  });
  await Promise.resolve();
  assert.deepEqual(events, ['write', 'share:start']);

  releaseShare.resolve();
  await activeExport;
  await cleanup;
  assert.deepEqual(events, [
    'write',
    'share:start',
    'share:end',
    'export:remove',
    'cleanup:list',
  ]);
});
