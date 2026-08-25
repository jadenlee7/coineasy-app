import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  POST_REPORT_REASONS,
  createPostReportHandler,
  postsRouter,
} from '../src/routes/posts.js';

const NOW = new Date('2026-08-25T12:00:00.000Z');

function response() {
  return {
    body: null,
    headers: {},
    statusCode: 200,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function reportDb({
  reporter = { id: 'reporter_1' },
  post = { id: 'post_1', authorId: 'author_1', deletedAt: null },
  existing = null,
  recentReports = 0,
} = {}) {
  const calls = [];
  const db = {
      async $transaction(operation) {
        calls.push(['transaction']);
        return operation(db);
      },
      async $queryRawUnsafe(query, value) {
        calls.push(['queryRaw', { query, value }]);
        return [{ lockAcquired: true }];
      },
      user: {
        async findUnique(options) {
          calls.push(['user.findUnique', options]);
          return reporter;
        },
      },
      post: {
        async findUnique(options) {
          calls.push(['post.findUnique', options]);
          return post;
        },
      },
      postReport: {
        async findUnique(options) {
          calls.push(['report.findUnique', options]);
          return existing;
        },
        async count(options) {
          calls.push(['report.count', options]);
          return recentReports;
        },
        async upsert(options) {
          calls.push(['report.upsert', options]);
          return { id: 'private_report_id' };
        },
      },
  };
  return { calls, db };
}

function request(body = { reason: 'SCAM_FRAUD' }) {
  return {
    body,
    params: { id: 'post_1' },
    user: { privyDid: 'did:privy:reporter' },
  };
}

test('post report reasons are a bounded server allowlist', () => {
  assert.deepEqual(POST_REPORT_REASONS, [
    'SPAM',
    'NUDITY_SEXUAL_CONTENT',
    'HATE_SPEECH',
    'VIOLENCE_DANGEROUS',
    'BULLYING_HARASSMENT',
    'SCAM_FRAUD',
    'FALSE_INFORMATION',
  ]);
});

test('an authenticated report persists once without returning report or identity data', async () => {
  const { calls, db } = reportDb();
  const res = response();
  await createPostReportHandler({ db, now: () => NOW })(request(), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(res.body, { reported: true, duplicate: false });
  assert.equal(JSON.stringify(res.body).includes('reporter_1'), false);
  assert.equal(JSON.stringify(res.body).includes('private_report_id'), false);

  const upsert = calls.find(([name]) => name === 'report.upsert')[1];
  const lock = calls.find(([name]) => name === 'queryRaw')[1];
  assert.equal(
    lock.query,
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0)) IS NULL AS "lockAcquired"',
  );
  assert.equal(lock.value, 'post-report:reporter_1');
  assert.ok(
    calls.findIndex(([name]) => name === 'transaction')
      < calls.findIndex(([name]) => name === 'queryRaw'),
  );
  assert.ok(
    calls.findIndex(([name]) => name === 'queryRaw')
      < calls.findIndex(([name]) => name === 'post.findUnique'),
  );
  assert.deepEqual(upsert.where, {
    postId_reporterId: { postId: 'post_1', reporterId: 'reporter_1' },
  });
  assert.deepEqual(upsert.create, {
    postId: 'post_1',
    reporterId: 'reporter_1',
    reason: 'SCAM_FRAUD',
  });
  assert.deepEqual(upsert.update, {});
});

test('a repeated reporter/post pair is idempotent and never mutates the original reason', async () => {
  const { calls, db } = reportDb({ existing: { id: 'report_1' } });
  const res = response();
  await createPostReportHandler({ db })(request({ reason: 'SPAM' }), res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { reported: true, duplicate: true });
  assert.equal(calls.some(([name]) => name === 'report.count'), false);
  assert.equal(calls.some(([name]) => name === 'report.upsert'), false);
});

test('invalid, missing, deleted, and own-post reports fail closed before persistence', async () => {
  {
    const { calls, db } = reportDb();
    const res = response();
    await createPostReportHandler({ db })(request({ reason: 'OTHER' }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'report_reason_invalid' });
    assert.equal(calls.length, 0);
  }

  for (const [post, status, error] of [
    [null, 404, 'post_not_reportable'],
    [{ id: 'post_1', authorId: 'author_1', deletedAt: NOW }, 404, 'post_not_reportable'],
    [{ id: 'post_1', authorId: 'reporter_1', deletedAt: null }, 409, 'cannot_report_own_post'],
  ]) {
    const { calls, db } = reportDb({ post });
    const res = response();
    await createPostReportHandler({ db })(request(), res);
    assert.equal(res.statusCode, status);
    assert.deepEqual(res.body, { error });
    assert.equal(calls.some(([name]) => name === 'report.upsert'), false);
  }
});

test('new reports are rate bounded without exposing the reporter count', async () => {
  const { calls, db } = reportDb({ recentReports: 20 });
  const res = response();
  await createPostReportHandler({ db, now: () => NOW })(request(), res);

  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['Retry-After'], '3600');
  assert.deepEqual(res.body, { error: 'report_rate_limited' });
  assert.equal(calls.some(([name]) => name === 'report.upsert'), false);
  const count = calls.find(([name]) => name === 'report.count')[1];
  assert.equal(count.where.createdAt.gte.toISOString(), '2026-08-24T12:00:00.000Z');
});

function concurrentReportDb() {
  const reports = [];
  let transactionTail = Promise.resolve();
  const db = {
    async $transaction(operation) {
      const previous = transactionTail;
      let release;
      transactionTail = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        return await operation(db);
      } finally {
        release();
      }
    },
    async $queryRawUnsafe() {
      return [{ lockAcquired: true }];
    },
    user: {
      async findUnique() {
        return { id: 'reporter_1' };
      },
    },
    post: {
      async findUnique({ where }) {
        return { id: where.id, authorId: 'author_1', deletedAt: null };
      },
    },
    postReport: {
      async findUnique({ where }) {
        const key = where.postId_reporterId;
        return reports.find((row) => (
          row.postId === key.postId && row.reporterId === key.reporterId
        )) || null;
      },
      async count() {
        return reports.length;
      },
      async upsert({ create }) {
        const row = { id: `report_${reports.length + 1}`, ...create };
        reports.push(row);
        return row;
      },
    },
  };
  return { db, reports };
}

test('the per-reporter transaction lock makes parallel dedupe and limits atomic', async () => {
  {
    const { db, reports } = concurrentReportDb();
    const replies = await Promise.all([0, 1].map(async () => {
      const res = response();
      await createPostReportHandler({ db })(request(), res);
      return res;
    }));
    assert.deepEqual(replies.map((res) => res.statusCode).sort(), [200, 201]);
    assert.deepEqual(replies.map((res) => res.body.duplicate).sort(), [false, true]);
    assert.equal(reports.length, 1);
  }

  {
    const { db, reports } = concurrentReportDb();
    const replies = await Promise.all(Array.from({ length: 21 }, async (_, index) => {
      const res = response();
      const req = request();
      req.params.id = `post_${index + 1}`;
      await createPostReportHandler({ db, now: () => NOW })(req, res);
      return res;
    }));
    assert.equal(replies.filter((res) => res.statusCode === 201).length, 20);
    assert.equal(replies.filter((res) => res.statusCode === 429).length, 1);
    assert.equal(reports.length, 20);
  }
});

test('the report route is authenticated, async-wrapped, and backed by a unique schema contract', () => {
  const layer = postsRouter.stack.find((item) => (
    item.route?.path === '/:id/report' && item.route.methods.post
  ));
  assert.ok(layer);
  assert.equal(layer.route.stack.length, 2);
  assert.equal(layer.route.stack.at(-1).handle.name, 'handleAsyncRoute');

  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const migration = readFileSync(
    new URL('../prisma/migrations/20260825120000_post_reports/migration.sql', import.meta.url),
    'utf8',
  );
  assert.match(schema, /model PostReport \{/);
  assert.match(schema, /@@unique\(\[postId, reporterId\], map: "uniq_post_report_reporter"\)/);
  assert.match(schema, /status\s+PostReportStatus @default\(OPEN\)/);
  assert.match(schema, /reporter User @relation\("PostReportReporter"[\s\S]*?onDelete: Cascade\)/);
  assert.match(migration, /CREATE UNIQUE INDEX "uniq_post_report_reporter"/);
  assert.match(migration, /PostReport_postId_fkey[\s\S]*?ON DELETE CASCADE/);
  assert.match(migration, /PostReport_reporterId_fkey[\s\S]*?ON DELETE CASCADE/);
});
