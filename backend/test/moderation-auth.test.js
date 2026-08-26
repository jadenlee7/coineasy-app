import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModerationAuth,
  hashModerationApiKey,
  ModerationAuthConfigError,
  parseModerationKeyHashes,
  resolveModeratorKeyId,
} from '../src/lib/moderation-auth.js';

const KEY = `eg_mod_${'a'.repeat(32)}`;
const OTHER_KEY = `eg_mod_${'b'.repeat(32)}`;
const KEY_ID = 'primary-reviewer';

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function config(entries = { [KEY_ID]: hashModerationApiKey(KEY) }) {
  return { MODERATION_API_KEY_HASHES_JSON: JSON.stringify(entries) };
}

async function authenticate({ token = KEY, env = config(), authorization, log } = {}) {
  const middleware = createModerationAuth({ env });
  const req = {
    headers: {
      authorization: authorization === undefined ? `Bearer ${token}` : authorization,
    },
    ...(log ? { log } : {}),
  };
  const res = response();
  let nextCalls = 0;
  await middleware(req, res, () => { nextCalls += 1; });
  return { req, res, nextCalls };
}

test('hashes moderator keys and resolves only the configured opaque key ID', () => {
  const digest = hashModerationApiKey(KEY);
  assert.match(digest, /^[a-f0-9]{64}$/);

  const entries = parseModerationKeyHashes(JSON.stringify({ [KEY_ID]: digest }));
  assert.deepEqual(entries, [[KEY_ID, digest]]);
  assert.equal(resolveModeratorKeyId(KEY, entries), KEY_ID);
  assert.equal(resolveModeratorKeyId(OTHER_KEY, entries), null);
});

test('accepts only eg_mod_ keys with 32 to 220 base64url characters', () => {
  const lowerBoundary = `eg_mod_${'a'.repeat(32)}`;
  const upperBoundary = `eg_mod_${'A-_0'.repeat(55)}`;
  const entries = [
    ['lower-boundary', hashModerationApiKey(lowerBoundary)],
    ['upper-boundary', hashModerationApiKey(upperBoundary)],
  ];

  assert.equal(resolveModeratorKeyId(lowerBoundary, entries), 'lower-boundary');
  assert.equal(resolveModeratorKeyId(upperBoundary, entries), 'upper-boundary');
  for (const invalid of [
    `eg_mod_${'a'.repeat(31)}`,
    `eg_mod_${'a'.repeat(221)}`,
    `eg_mod_${'a'.repeat(31)}+`,
    `eg_mod_${'a'.repeat(31)}/`,
    `eg_mod_${'a'.repeat(31)}=`,
    `eg_adv_${'a'.repeat(32)}`,
    `eg_mod_${'a'.repeat(16)} ${'a'.repeat(16)}`,
  ]) {
    assert.equal(resolveModeratorKeyId(invalid, entries), null, invalid);
  }
});

test('rejects missing, malformed, empty, and oversized configuration', () => {
  const invalidValues = [
    undefined,
    '',
    '   ',
    '{',
    'null',
    '[]',
    '"value"',
    '{}',
    JSON.stringify(Object.fromEntries(
      Array.from({ length: 51 }, (_, index) => [
        `reviewer-${index}`,
        hashModerationApiKey(`key-${index}`),
      ]),
    )),
  ];

  for (const raw of invalidValues) {
    assert.throws(
      () => parseModerationKeyHashes(raw),
      ModerationAuthConfigError,
    );
  }
});

test('rejects invalid key IDs, non-lowercase digests, and duplicate digests', () => {
  const digest = hashModerationApiKey(KEY);
  for (const keyId of [
    'a',
    'A-reviewer',
    '-reviewer',
    'reviewer-',
    'reviewer--one',
    'reviewer_one',
    'a'.repeat(65),
  ]) {
    assert.throws(
      () => parseModerationKeyHashes(JSON.stringify({ [keyId]: digest })),
      ModerationAuthConfigError,
      keyId,
    );
  }

  assert.throws(
    () => parseModerationKeyHashes(JSON.stringify({ [KEY_ID]: digest.toUpperCase() })),
    ModerationAuthConfigError,
  );
  assert.throws(
    () => parseModerationKeyHashes(JSON.stringify({ [KEY_ID]: KEY })),
    ModerationAuthConfigError,
  );
  assert.throws(
    () => parseModerationKeyHashes(JSON.stringify({
      [KEY_ID]: digest,
      'backup-reviewer': digest,
    })),
    ModerationAuthConfigError,
  );
});

test('scans every configured digest even after finding a match', () => {
  const entries = [
    [KEY_ID, hashModerationApiKey(KEY)],
    ['backup-reviewer', hashModerationApiKey(OTHER_KEY)],
    ['third-reviewer', hashModerationApiKey(`eg_mod_${'c'.repeat(32)}`)],
  ];
  const visited = [];
  const observedEntries = {
    *[Symbol.iterator]() {
      for (const entry of entries) {
        visited.push(entry[0]);
        yield entry;
      }
    },
  };

  assert.equal(resolveModeratorKeyId(KEY, observedEntries), KEY_ID);
  assert.deepEqual(visited, entries.map(([keyId]) => keyId));
});

test('authenticates a configured Bearer key and attaches only its opaque key ID', async () => {
  const { req, res, nextCalls } = await authenticate();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, null);
  assert.equal(nextCalls, 1);
  assert.deepEqual(req.moderator, { keyId: KEY_ID });
  assert.equal(Object.hasOwn(req.moderator, 'token'), false);
  assert.equal(Object.hasOwn(req.moderator, 'digest'), false);
});

test('missing and malformed authorization fail with 401 before reading configuration', async () => {
  let configReads = 0;
  const env = {};
  Object.defineProperty(env, 'MODERATION_API_KEY_HASHES_JSON', {
    get() {
      configReads += 1;
      throw new Error('must not read config');
    },
  });

  for (const authorization of [null, '', 'Basic abc', 'Bearer', `Bearer ${KEY} extra`]) {
    const middleware = createModerationAuth({ env });
    const req = {
      headers: authorization === null ? {} : { authorization },
    };
    const res = response();
    let nextCalls = 0;
    await middleware(req, res, () => { nextCalls += 1; });

    assert.equal(res.statusCode, 401);
    assert.equal(
      res.body.error,
      authorization === null || authorization === ''
        ? 'missing_moderation_key'
        : 'invalid_moderation_key',
    );
    assert.equal(nextCalls, 0);
  }
  assert.equal(configReads, 0);
});

test('unknown valid keys fail with 401 without echoing credentials', async () => {
  const { req, res, nextCalls } = await authenticate({ token: OTHER_KEY });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'invalid_moderation_key' });
  assert.equal(nextCalls, 0);
  assert.equal(req.moderator, undefined);
  assert.equal(JSON.stringify(res.body).includes(OTHER_KEY), false);
  assert.equal(JSON.stringify(res.body).includes(KEY_ID), false);
});

test('missing and invalid key configuration fail closed with 503', async () => {
  for (const env of [{}, { MODERATION_API_KEY_HASHES_JSON: '{}' }, {
    MODERATION_API_KEY_HASHES_JSON: JSON.stringify({ [KEY_ID]: KEY }),
  }]) {
    const { req, res, nextCalls } = await authenticate({ env });
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { error: 'moderation_auth_unconfigured' });
    assert.equal(nextCalls, 0);
    assert.equal(req.moderator, undefined);
  }
});

test('observes configuration rotation without retaining an old credential', async () => {
  const env = config();
  const middleware = createModerationAuth({ env });

  const firstReq = { headers: { authorization: `Bearer ${KEY}` } };
  const firstRes = response();
  await middleware(firstReq, firstRes, () => {});
  assert.deepEqual(firstReq.moderator, { keyId: KEY_ID });

  env.MODERATION_API_KEY_HASHES_JSON = JSON.stringify({
    'backup-reviewer': hashModerationApiKey(OTHER_KEY),
  });

  const oldReq = { headers: { authorization: `Bearer ${KEY}` } };
  const oldRes = response();
  await middleware(oldReq, oldRes, () => assert.fail('old key must not authenticate'));
  assert.equal(oldRes.statusCode, 401);

  const rotatedReq = { headers: { authorization: `Bearer ${OTHER_KEY}` } };
  const rotatedRes = response();
  let rotatedNextCalls = 0;
  await middleware(rotatedReq, rotatedRes, () => { rotatedNextCalls += 1; });
  assert.equal(rotatedNextCalls, 1);
  assert.deepEqual(rotatedReq.moderator, { keyId: 'backup-reviewer' });
});

test('unexpected auth failures log only errorType and never credentials or key IDs', async () => {
  class CredentialReadFailure extends Error {
    constructor(message) {
      super(message);
      this.name = 'CredentialReadFailure';
    }
  }
  const secretMessage = `${KEY} ${KEY_ID}`;
  const env = {};
  Object.defineProperty(env, 'MODERATION_API_KEY_HASHES_JSON', {
    get() {
      throw new CredentialReadFailure(secretMessage);
    },
  });
  const logCalls = [];
  const log = {
    error(...args) { logCalls.push(args); },
  };

  const { req, res, nextCalls } = await authenticate({ env, log });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'moderation_auth_unavailable' });
  assert.equal(nextCalls, 0);
  assert.equal(req.moderator, undefined);
  assert.equal(logCalls.length, 1);
  assert.deepEqual(logCalls[0][0], { errorType: 'CredentialReadFailure' });
  assert.equal(logCalls[0][1], 'moderation authentication failed');

  const serialized = JSON.stringify({ logCalls, response: res.body });
  assert.equal(serialized.includes(KEY), false);
  assert.equal(serialized.includes(KEY_ID), false);
  assert.equal(serialized.includes(secretMessage), false);
});

test('a logging failure cannot make an unexpected auth failure fail open', async () => {
  const env = {};
  Object.defineProperty(env, 'MODERATION_API_KEY_HASHES_JSON', {
    get() { throw new Error('configuration backend unavailable'); },
  });
  const log = {
    error() { throw new Error('logger unavailable'); },
  };

  const { req, res, nextCalls } = await authenticate({ env, log });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'moderation_auth_unavailable' });
  assert.equal(nextCalls, 0);
  assert.equal(req.moderator, undefined);
});
