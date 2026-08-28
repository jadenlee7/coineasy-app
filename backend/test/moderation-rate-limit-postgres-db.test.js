import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

import {
  MODERATION_RATE_LIMIT_CLEANUP_SQL,
  MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL,
  verifyModerationRateLimitDatabaseContract,
} from '../src/lib/moderation-rate-limit-database.js';
import {
  createPostgresModerationRateLimitConsumer,
  MODERATION_RATE_LIMIT_POSTGRES_SQL,
  ModerationRateLimitStoreUnavailableError,
} from '../src/lib/moderation-rate-limit-postgres.js';
import { MODERATION_CAPABILITIES } from '../src/lib/moderation-principal.js';
import { createModerationRateLimiter } from '../src/middleware/moderation-rate-limit.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const ALL_SCOPES = [
  MODERATION_CAPABILITIES.CONTENT_REMOVE,
  MODERATION_CAPABILITIES.QUEUE_READ,
  MODERATION_CAPABILITIES.REPORT_CLAIM,
  MODERATION_CAPABILITIES.REPORT_DECIDE,
];

function actorId() {
  return `wf_${randomUUID().replaceAll('-', '')}`;
}

function policies(overrides = {}) {
  return Object.fromEntries(ALL_SCOPES.map((scope) => [scope, {
    burstCapacity: 1,
    emissionIntervalMs: 60_000,
    ...(overrides[scope] || {}),
  }]));
}

function consumer(db, overrides = {}) {
  return createPostgresModerationRateLimitConsumer({
    db,
    policies: policies(),
    policyVersion: 'moderation-gcra-db-test-v1',
    ...overrides,
  });
}

function consume(rateConsumer, actor, scopes) {
  return rateConsumer({ actorId: actor, scopes }, {
    signal: new AbortController().signal,
  });
}

async function readBucket(db, actor, scope) {
  const rows = await db.$queryRawUnsafe(
    `SELECT
      "actorId",
      "scope",
      "policyVersion",
      "policyFingerprint",
      "theoreticalArrivalAt",
      "updatedAt"
    FROM "ModerationRateLimitBucket"
    WHERE "actorId" = $1 AND "scope" = $2`,
    actor,
    scope,
  );
  assert.equal(rows.length <= 1, true);
  return rows[0] || null;
}

async function countBuckets(db, actor) {
  const rows = await db.$queryRawUnsafe(
    `SELECT COUNT(*)::integer AS "count"
     FROM "ModerationRateLimitBucket"
     WHERE "actorId" = $1`,
    actor,
  );
  assert.equal(rows.length, 1);
  return rows[0].count;
}

test('PostgreSQL shares GCRA state and keeps multi-scope denial write-free', {
  skip: !databaseUrl,
  timeout: 30_000,
}, async () => {
  const firstDb = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const secondDb = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const actors = {
    aborted: actorId(),
    atomic: actorId(),
    burst: actorId(),
    cleanup: actorId(),
    cleanupActive: actorId(),
    locked: actorId(),
    middlewareLocked: actorId(),
    mismatch: actorId(),
    order: actorId(),
    retry: actorId(),
  };
  try {
    assert.equal(await verifyModerationRateLimitDatabaseContract(firstDb), true);

    await firstDb.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE pg_read_all_data');
      const contract = await tx.$queryRawUnsafe(
        MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL,
      );
      assert.deepEqual(contract, [{ contractReady: false }]);
    });

    for (const mutations of [
      ['ALTER TABLE "ModerationRateLimitBucket" ADD COLUMN "identityLeak" TEXT'],
      [
        `ALTER TABLE "ModerationRateLimitBucket"
           DROP CONSTRAINT "ModerationRateLimitBucket_actor_format_check"`,
        `ALTER TABLE "ModerationRateLimitBucket"
           ADD CONSTRAINT "ModerationRateLimitBucket_actor_format_check" CHECK (true)`,
      ],
      [
        'DROP INDEX "idx_moderation_rate_bucket_cleanup"',
        `CREATE INDEX "idx_moderation_rate_bucket_cleanup"
           ON "ModerationRateLimitBucket"(
             "updatedAt", "theoreticalArrivalAt", "actorId", "scope"
           ) WHERE false`,
      ],
      [
        `ALTER TABLE "ModerationRateLimitBucket"
           ADD CONSTRAINT "ModerationRateLimitBucket_unexpected_check" CHECK (false)`,
      ],
      [
        `CREATE UNIQUE INDEX "idx_moderation_rate_bucket_unexpected"
           ON "ModerationRateLimitBucket"("scope")`,
      ],
      ['GRANT SELECT ON TABLE "ModerationRateLimitBucket" TO PUBLIC'],
    ]) {
      const rollback = new Error('rollback catalog mutation');
      await assert.rejects(
        () => firstDb.$transaction(async (tx) => {
          for (const mutation of mutations) {
            await tx.$executeRawUnsafe(mutation);
          }
          const contract = await tx.$queryRawUnsafe(
            MODERATION_RATE_LIMIT_DATABASE_CONTRACT_SQL,
          );
          assert.deepEqual(contract, [{ contractReady: false }]);
          throw rollback;
        }),
        (error) => error === rollback,
      );
    }

    let releaseCatalogLock;
    let reportCatalogLock;
    const catalogLockReady = new Promise((resolve) => { reportCatalogLock = resolve; });
    const holdCatalogLock = new Promise((resolve) => { releaseCatalogLock = resolve; });
    const catalogLockHolder = secondDb.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'LOCK TABLE "_prisma_migrations" IN ACCESS EXCLUSIVE MODE',
      );
      reportCatalogLock();
      await holdCatalogLock;
    }, { maxWait: 200, timeout: 5_000 });
    await catalogLockReady;
    const catalogWaitStartedAt = Date.now();
    try {
      await assert.rejects(
        () => verifyModerationRateLimitDatabaseContract(firstDb),
      );
    } finally {
      releaseCatalogLock();
    }
    const catalogWaitElapsedMs = Date.now() - catalogWaitStartedAt;
    await catalogLockHolder;
    assert.equal(catalogWaitElapsedMs < 2_000, true);

    const burstPolicies = policies({
      [MODERATION_CAPABILITIES.QUEUE_READ]: { burstCapacity: 2 },
    });
    const firstConsumer = consumer(firstDb, { policies: burstPolicies });
    const secondConsumer = consumer(secondDb, { policies: burstPolicies });
    const concurrent = await Promise.all([
      consume(firstConsumer, actors.burst, [MODERATION_CAPABILITIES.QUEUE_READ]),
      consume(secondConsumer, actors.burst, [MODERATION_CAPABILITIES.QUEUE_READ]),
      consume(firstConsumer, actors.burst, [MODERATION_CAPABILITIES.QUEUE_READ]),
    ]);
    assert.equal(concurrent.filter(({ allowed }) => allowed).length, 2);
    assert.equal(concurrent.filter(({ allowed }) => !allowed).length, 1);

    const beforeDenial = await readBucket(
      firstDb,
      actors.burst,
      MODERATION_CAPABILITIES.QUEUE_READ,
    );
    assert.ok(beforeDenial);
    const denied = await consume(secondConsumer, actors.burst, [MODERATION_CAPABILITIES.QUEUE_READ]);
    assert.equal(denied.allowed, false);
    const afterDenial = await readBucket(
      firstDb,
      actors.burst,
      MODERATION_CAPABILITIES.QUEUE_READ,
    );
    assert.deepEqual(afterDenial, beforeDenial);

    const atomicConsumer = consumer(firstDb);
    assert.deepEqual(
      await consume(atomicConsumer, actors.atomic, [MODERATION_CAPABILITIES.REPORT_DECIDE]),
      { allowed: true },
    );
    const combined = await consume(atomicConsumer, actors.atomic, [
      MODERATION_CAPABILITIES.REPORT_DECIDE,
      MODERATION_CAPABILITIES.CONTENT_REMOVE,
    ]);
    assert.equal(combined.allowed, false);
    assert.deepEqual(
      await consume(atomicConsumer, actors.atomic, [MODERATION_CAPABILITIES.CONTENT_REMOVE]),
      { allowed: true },
    );

    const oppositeOrder = await Promise.all([
      consume(consumer(firstDb), actors.order, [
        MODERATION_CAPABILITIES.REPORT_DECIDE,
        MODERATION_CAPABILITIES.CONTENT_REMOVE,
      ]),
      consume(consumer(secondDb), actors.order, [
        MODERATION_CAPABILITIES.CONTENT_REMOVE,
        MODERATION_CAPABILITIES.REPORT_DECIDE,
      ]),
    ]);
    assert.equal(oppositeOrder.filter(({ allowed }) => allowed).length, 1);
    assert.equal(oppositeOrder.filter(({ allowed }) => !allowed).length, 1);
    assert.equal(await countBuckets(firstDb, actors.order), 2);

    const retryConsumer = consumer(firstDb, {
      policies: policies({
        [MODERATION_CAPABILITIES.CONTENT_REMOVE]: { emissionIntervalMs: 3_600_000 },
        [MODERATION_CAPABILITIES.REPORT_DECIDE]: { emissionIntervalMs: 60_000 },
      }),
    });
    const retryScopes = [
      MODERATION_CAPABILITIES.CONTENT_REMOVE,
      MODERATION_CAPABILITIES.REPORT_DECIDE,
    ];
    assert.deepEqual(
      await consume(retryConsumer, actors.retry, retryScopes),
      { allowed: true },
    );
    const retryDenied = await consume(retryConsumer, actors.retry, retryScopes);
    assert.equal(retryDenied.allowed, false);
    assert.equal(retryDenied.retryAfterSeconds > 60, true);
    assert.equal(retryDenied.retryAfterSeconds <= 3_600, true);

    const abortController = new AbortController();
    const abortingDb = {
      $transaction(callback, options) {
        return firstDb.$transaction(async (tx) => callback({
          async $queryRawUnsafe(sql, ...values) {
            const result = await tx.$queryRawUnsafe(sql, ...values);
            if (sql === MODERATION_RATE_LIMIT_POSTGRES_SQL.consume) {
              abortController.abort();
            }
            return result;
          },
        }), options);
      },
    };
    await assert.rejects(
      () => createPostgresModerationRateLimitConsumer({
        db: abortingDb,
        policies: policies(),
        policyVersion: 'moderation-gcra-db-test-v1',
      })({
        actorId: actors.aborted,
        scopes: [MODERATION_CAPABILITIES.QUEUE_READ],
      }, { signal: abortController.signal }),
      ModerationRateLimitStoreUnavailableError,
    );
    assert.equal(await countBuckets(firstDb, actors.aborted), 0);

    let releaseHeldLock;
    let reportHeldLock;
    const heldLockReady = new Promise((resolve) => { reportHeldLock = resolve; });
    const holdLock = new Promise((resolve) => { releaseHeldLock = resolve; });
    const lockHolder = secondDb.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        MODERATION_RATE_LIMIT_POSTGRES_SQL.lock,
        actors.locked,
        MODERATION_CAPABILITIES.QUEUE_READ,
      );
      reportHeldLock();
      await holdLock;
    }, { maxWait: 200, timeout: 5_000 });
    await heldLockReady;
    const lockWaitStartedAt = Date.now();
    try {
      await assert.rejects(
        () => consume(
          consumer(firstDb),
          actors.locked,
          [MODERATION_CAPABILITIES.QUEUE_READ],
        ),
        ModerationRateLimitStoreUnavailableError,
      );
    } finally {
      releaseHeldLock();
    }
    const lockWaitElapsedMs = Date.now() - lockWaitStartedAt;
    await lockHolder;
    assert.equal(lockWaitElapsedMs < 2_000, true);
    assert.equal(await countBuckets(firstDb, actors.locked), 0);

    let releaseMiddlewareLock;
    let reportMiddlewareLock;
    const middlewareLockReady = new Promise((resolve) => { reportMiddlewareLock = resolve; });
    const holdMiddlewareLock = new Promise((resolve) => { releaseMiddlewareLock = resolve; });
    const middlewareLockHolder = secondDb.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        MODERATION_RATE_LIMIT_POSTGRES_SQL.lock,
        actors.middlewareLocked,
        MODERATION_CAPABILITIES.QUEUE_READ,
      );
      reportMiddlewareLock();
      await holdMiddlewareLock;
    }, { maxWait: 200, timeout: 5_000 });
    await middlewareLockReady;
    const response = {
      body: null,
      headers: Object.create(null),
      statusCode: 200,
      json(body) { this.body = body; return this; },
      set(name, value) { this.headers[name] = value; return this; },
      status(code) { this.statusCode = code; return this; },
    };
    let nextCalled = false;
    const middleware = createModerationRateLimiter({
      consume: consumer(firstDb),
    })(MODERATION_CAPABILITIES.QUEUE_READ);
    const middlewareStartedAt = Date.now();
    try {
      await middleware({
        log: { error() {} },
        moderator: { actorId: actors.middlewareLocked },
      }, response, () => { nextCalled = true; });
    } finally {
      releaseMiddlewareLock();
    }
    const middlewareElapsedMs = Date.now() - middlewareStartedAt;
    await middlewareLockHolder;
    assert.equal(middlewareElapsedMs < 2_000, true);
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, { error: 'moderation_rate_limit_unavailable' });
    assert.equal(nextCalled, false);
    assert.equal(await countBuckets(firstDb, actors.middlewareLocked), 0);

    const stable = consumer(firstDb);
    await consume(stable, actors.mismatch, [MODERATION_CAPABILITIES.QUEUE_READ]);
    const mismatchBefore = await readBucket(
      firstDb,
      actors.mismatch,
      MODERATION_CAPABILITIES.QUEUE_READ,
    );
    const drifted = consumer(secondDb, {
      policies: policies({
        [MODERATION_CAPABILITIES.QUEUE_READ]: { emissionIntervalMs: 61_000 },
      }),
    });
    await assert.rejects(
      () => consume(drifted, actors.mismatch, [MODERATION_CAPABILITIES.QUEUE_READ]),
      ModerationRateLimitStoreUnavailableError,
    );
    assert.deepEqual(
      await readBucket(
        firstDb,
        actors.mismatch,
        MODERATION_CAPABILITIES.QUEUE_READ,
      ),
      mismatchBefore,
    );

    await firstDb.$executeRawUnsafe(
      `INSERT INTO "ModerationRateLimitBucket" (
        "actorId", "scope", "policyVersion", "policyFingerprint",
        "theoreticalArrivalAt", "updatedAt"
      )
      SELECT
        $1,
        'queue.read',
        'moderation-gcra-db-test-v1',
        $2,
        clock."nowAt" - INTERVAL '2 hours',
        clock."nowAt" - INTERVAL '2 hours'
      FROM (SELECT clock_timestamp() AS "nowAt") clock`,
      actors.cleanup,
      'a'.repeat(64),
    );
    await firstDb.$executeRawUnsafe(
      `INSERT INTO "ModerationRateLimitBucket" (
        "actorId", "scope", "policyVersion", "policyFingerprint",
        "theoreticalArrivalAt", "updatedAt"
      )
      SELECT
        $1,
        'queue.read',
        'moderation-gcra-db-test-v1',
        $2,
        clock."nowAt" + INTERVAL '1 hour',
        clock."nowAt" - INTERVAL '2 hours'
      FROM (SELECT clock_timestamp() AS "nowAt") clock`,
      actors.cleanupActive,
      'b'.repeat(64),
    );
    const cleanup = await firstDb.$queryRawUnsafe(
      MODERATION_RATE_LIMIT_CLEANUP_SQL,
      3_600n,
      10,
    );
    assert.equal(cleanup.length, 1);
    assert.equal(cleanup[0].deletedCount >= 1, true);
    assert.equal(await countBuckets(firstDb, actors.cleanup), 0);
    assert.equal(await countBuckets(firstDb, actors.cleanupActive), 1);
  } finally {
    for (const actor of Object.values(actors)) {
      await firstDb.$executeRawUnsafe(
        'DELETE FROM "ModerationRateLimitBucket" WHERE "actorId" = $1',
        actor,
      ).catch(() => {});
    }
    await Promise.all([firstDb.$disconnect(), secondDb.$disconnect()]);
  }
});
