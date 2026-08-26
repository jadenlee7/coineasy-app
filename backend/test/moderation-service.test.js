import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createModerationService,
  ModerationError,
} from '../src/lib/moderation-service.js';

const NOW = new Date('2026-08-26T12:00:00.000Z');
const POST_REVISION = 0;
const POST_UPDATED_AT = new Date('2026-08-26T10:30:00.000Z');
const POLICY_VERSION = 'moderation-2026-08';
const FIRST_OPERATION_ID = '00000000-0000-4000-8000-000000000001';

function report(overrides = {}) {
  const createdAt = overrides.createdAt || new Date('2026-08-26T10:00:00.000Z');
  return {
    id: 'report-1',
    postId: 'post-1',
    reporterId: 'reporter-private-1',
    reason: 'SPAM',
    postRevision: POST_REVISION,
    status: 'OPEN',
    reviewerKeyId: null,
    claimedAt: null,
    version: 0,
    resolution: null,
    createdAt,
    updatedAt: createdAt,
    reviewedAt: null,
    ...overrides,
  };
}

function post(overrides = {}) {
  return {
    id: 'post-1',
    authorId: 'author-private-1',
    body: 'raw private post body',
    mediaUrl: 'https://private.invalid/media.png',
    deletedAt: null,
    contentRevision: POST_REVISION,
    updatedAt: POST_UPDATED_AT,
    ...overrides,
  };
}

function compareValues(left, right) {
  const leftValue = left instanceof Date ? left.getTime() : left;
  const rightValue = right instanceof Date ? right.getTime() : right;
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

function matchesCondition(actual, condition) {
  if (
    condition
    && typeof condition === 'object'
    && !(condition instanceof Date)
    && !Array.isArray(condition)
  ) {
    if ('in' in condition && !condition.in.includes(actual)) return false;
    if ('gt' in condition && compareValues(actual, condition.gt) <= 0) return false;
    return true;
  }
  return compareValues(actual, condition) === 0;
}

function matchesWhere(value, where = {}) {
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'OR') return condition.some((part) => matchesWhere(value, part));
    return matchesCondition(value[field], condition);
  });
}

function orderRows(rows, orderBy = []) {
  return rows.sort((left, right) => {
    for (const order of orderBy) {
      const [field, direction] = Object.entries(order)[0];
      const compared = compareValues(left[field], right[field]);
      if (compared !== 0) return direction === 'desc' ? -compared : compared;
    }
    return 0;
  });
}

function createFakePrisma({ reports = [], posts = [], failAuditAt = null } = {}) {
  let state = structuredClone({
    reports,
    posts,
    audits: [],
  });
  let auditAttempts = 0;
  let transactionTail = Promise.resolve();
  const locks = [];
  const fanouts = [];

  function projectPost(value, select) {
    if (!value) return null;
    if (!select) return structuredClone(value);
    return Object.fromEntries(
      Object.entries(select)
        .filter(([, selected]) => selected === true)
        .map(([field]) => [field, structuredClone(value[field])]),
    );
  }

  function projectReport(value, select) {
    if (!value) return null;
    if (!select) return structuredClone(value);
    const projected = {};
    for (const [field, selected] of Object.entries(select)) {
      if (selected === true) {
        projected[field] = structuredClone(value[field]);
      } else if (field === 'post' && selected?.select) {
        const target = state.posts.find(({ id }) => id === value.postId);
        projected.post = projectPost(target, selected.select);
      }
    }
    return projected;
  }

  function reportFindMany({ where, orderBy, take, select } = {}) {
    const filtered = state.reports.filter((value) => matchesWhere(value, where));
    const ordered = orderRows(filtered, orderBy);
    const page = take === undefined ? ordered : ordered.slice(0, take);
    return Promise.resolve(page.map((value) => projectReport(value, select)));
  }

  function reportFindUnique({ where, select }) {
    const value = state.reports.find(({ id }) => id === where.id);
    return Promise.resolve(projectReport(value, select));
  }

  function reportFindFirst({ where, select }) {
    const value = state.reports.find((candidate) => matchesWhere(candidate, where));
    return Promise.resolve(projectReport(value, select));
  }

  function applyData(value, data) {
    for (const [field, nextValue] of Object.entries(data)) {
      if (
        nextValue
        && typeof nextValue === 'object'
        && !(nextValue instanceof Date)
        && 'increment' in nextValue
      ) {
        value[field] += nextValue.increment;
      } else {
        value[field] = structuredClone(nextValue);
      }
    }
  }

  function reportUpdateMany({ where, data }) {
    const matching = state.reports.filter((value) => matchesWhere(value, where));
    for (const value of matching) applyData(value, data);
    return Promise.resolve({ count: matching.length });
  }

  function postFindMany({ where, select }) {
    return Promise.resolve(state.posts
      .filter((value) => matchesWhere(value, where))
      .map((value) => projectPost(value, select)));
  }

  function postUpdateMany({ where, data }) {
    const matching = state.posts.filter((value) => matchesWhere(value, where));
    for (const value of matching) {
      applyData(value, data);
      value.updatedAt = structuredClone(NOW);
    }
    return Promise.resolve({ count: matching.length });
  }

  function projectAudit(value, select) {
    if (!value) return null;
    if (!select) return structuredClone(value);
    return Object.fromEntries(
      Object.entries(select)
        .filter(([, selected]) => selected === true)
        .map(([field]) => [field, structuredClone(value[field])]),
    );
  }

  const tx = {
    postReport: {
      findMany: reportFindMany,
      findUnique: reportFindUnique,
      findFirst: reportFindFirst,
      updateMany: reportUpdateMany,
    },
    post: {
      findMany: postFindMany,
      updateMany: postUpdateMany,
    },
    postReportAudit: {
      findUnique: async ({ where, select }) => {
        const identity = where.reportId_toVersion;
        const value = state.audits.find((audit) => (
          audit.reportId === identity.reportId && audit.toVersion === identity.toVersion
        ));
        return projectAudit(value, select);
      },
      create: async ({ data, select }) => {
        auditAttempts += 1;
        if (failAuditAt === auditAttempts) {
          const error = new Error('raw audit storage failure');
          error.name = 'AuditStorageFailure';
          throw error;
        }
        const value = {
          createdAt: NOW,
          ...structuredClone(data),
        };
        state.audits.push(value);
        return projectAudit(value, select);
      },
    },
    $queryRawUnsafe: async (sql, ...values) => {
      if (sql.includes('WITH pending AS')) {
        const [
          postId,
          reviewerKeyId,
          reviewedAt,
          policyVersion,
          operationId,
          resolution,
          action,
          currentId,
          toPostRevision,
        ] = values;
        fanouts.push({ sql, values });
        const pending = state.reports.filter((value) => (
          value.postId === postId
          && ['OPEN', 'REVIEWING'].includes(value.status)
        ));
        let updatedCount = 0;
        let auditCount = 0;
        let currentUpdated = false;
        for (const value of pending) {
          const fromStatus = value.status;
          const fromVersion = value.version;
          value.status = 'ACTIONED';
          value.reviewerKeyId = reviewerKeyId;
          value.claimedAt ||= structuredClone(reviewedAt);
          value.reviewedAt = structuredClone(reviewedAt);
          value.resolution = resolution;
          value.version += 1;
          value.updatedAt = structuredClone(reviewedAt);
          updatedCount += 1;
          currentUpdated ||= value.id === currentId;

          auditAttempts += 1;
          if (failAuditAt === auditAttempts) {
            const error = new Error('raw audit storage failure');
            error.name = 'AuditStorageFailure';
            throw error;
          }
          state.audits.push({
            reportId: value.id,
            reviewerKeyId,
            policyVersion,
            action,
            fromStatus,
            toStatus: 'ACTIONED',
            fromVersion,
            toVersion: value.version,
            operationId,
            fromPostRevision: value.postRevision,
            toPostRevision,
            createdAt: structuredClone(reviewedAt),
          });
          auditCount += 1;
        }
        return [{
          pendingCount: pending.length,
          updatedCount,
          auditCount,
          currentUpdated,
          currentToVersion: state.reports.find(({ id }) => id === currentId)?.version ?? null,
        }];
      }
      if (sql.includes('FROM "Post"') && sql.includes('FOR UPDATE')) {
        return [];
      }
      const [lockKey] = values;
      locks.push({ sql, lockKey });
      return [{ lockAcquired: false }];
    },
  };

  const prisma = {
    postReport: {
      findMany: reportFindMany,
    },
    post: {
      findMany: postFindMany,
    },
    $transaction(callback) {
      const run = async () => {
        const snapshot = structuredClone(state);
        const auditAttemptSnapshot = auditAttempts;
        try {
          return await callback(tx);
        } catch (error) {
          state = snapshot;
          auditAttempts = auditAttemptSnapshot;
          throw error;
        }
      };
      const result = transactionTail.then(run, run);
      transactionTail = result.then(() => undefined, () => undefined);
      return result;
    },
  };

  return {
    prisma,
    fanouts,
    locks,
    get state() { return state; },
  };
}

function service(fake, overrides = {}) {
  let operationSequence = 0;
  return createModerationService({
    prisma: fake.prisma,
    now: () => new Date(NOW),
    responseSlaHours: 24,
    policyVersion: POLICY_VERSION,
    newOperationId: () => {
      operationSequence += 1;
      return `00000000-0000-4000-8000-${String(operationSequence).padStart(12, '0')}`;
    },
    ...overrides,
  });
}

function assertModerationError(error, code, status) {
  assert.ok(error instanceof ModerationError);
  assert.equal(error.code, code);
  assert.equal(error.status, status);
  return true;
}

test('lists one status oldest-first with a bounded stable cursor', async () => {
  const sameTime = new Date('2026-08-25T10:00:00.000Z');
  const fake = createFakePrisma({
    reports: [
      report({ id: 'report-new', postId: 'post-new', createdAt: new Date('2026-08-26T10:00:00.000Z') }),
      report({ id: 'report-b', postId: 'post-b', createdAt: sameTime }),
      report({ id: 'report-reviewing', status: 'REVIEWING', reviewerKeyId: 'other-reviewer' }),
      report({ id: 'report-old', postId: 'post-old', createdAt: new Date('2026-08-24T10:00:00.000Z') }),
      report({ id: 'report-a', postId: 'post-a', createdAt: sameTime }),
    ],
  });
  const moderation = service(fake);

  const first = await moderation.list('primary-reviewer', { status: 'OPEN', limit: '2' });
  assert.deepEqual(first.reports.map(({ id }) => id), ['report-old', 'report-a']);
  assert.equal(typeof first.nextCursor, 'string');

  const second = await moderation.list('primary-reviewer', {
    status: 'OPEN',
    limit: 2,
    cursor: first.nextCursor,
  });
  assert.deepEqual(second.reports.map(({ id }) => id), ['report-b', 'report-new']);
  assert.equal(second.nextCursor, null);
  assert.ok([...first.reports, ...second.reports].every(({ status }) => status === 'OPEN'));
});

test('list never exposes reporter/reviewer IDs or unassigned raw content', async () => {
  const fake = createFakePrisma({
    reports: [
      report({
        postId: 'public-post-secret',
        reporterId: 'reporter-secret-open',
        reviewerKeyId: 'other-reviewer-secret',
      }),
    ],
    posts: [post({
      authorId: 'author-secret-open',
      body: 'unassigned raw secret body',
      mediaUrl: 'https://private.invalid/unassigned.png',
    })],
  });

  const result = await service(fake).list('primary-reviewer', { status: 'OPEN' });
  assert.equal(result.reports[0].content, null);
  assert.equal(result.reports[0].postId, null);
  assert.equal(result.reports[0].assignedToMe, false);
  assert.equal(result.reports[0].reviewerAssigned, true);
  for (const forbiddenField of ['reporterId', 'reviewerKeyId', 'authorId']) {
    assert.equal(Object.hasOwn(result.reports[0], forbiddenField), false);
  }
  const serialized = JSON.stringify(result);
  for (const forbiddenValue of [
    'reporter-secret-open',
    'other-reviewer-secret',
    'author-secret-open',
    'public-post-secret',
    'unassigned raw secret body',
    'https://private.invalid/unassigned.png',
  ]) {
    assert.equal(serialized.includes(forbiddenValue), false, forbiddenValue);
  }
});

test('only the assigned reviewer can see content for a live REVIEWING report', async () => {
  const fake = createFakePrisma({
    reports: [
      report({
        id: 'report-mine',
        postId: 'post-mine',
        status: 'REVIEWING',
        reviewerKeyId: 'primary-reviewer',
        claimedAt: new Date('2026-08-26T11:00:00.000Z'),
        version: 1,
      }),
      report({
        id: 'report-theirs',
        postId: 'post-theirs',
        status: 'REVIEWING',
        reviewerKeyId: 'other-reviewer',
        claimedAt: new Date('2026-08-26T11:00:00.000Z'),
        version: 1,
      }),
      report({
        id: 'report-deleted',
        postId: 'post-deleted',
        status: 'REVIEWING',
        reviewerKeyId: 'primary-reviewer',
        claimedAt: new Date('2026-08-26T11:00:00.000Z'),
        version: 1,
      }),
    ],
    posts: [
      post({ id: 'post-mine', body: 'assigned body', mediaUrl: 'assigned-media' }),
      post({ id: 'post-theirs', body: 'other body', mediaUrl: 'other-media' }),
      post({ id: 'post-deleted', body: '', mediaUrl: null, deletedAt: NOW }),
    ],
  });

  const result = await service(fake).list('primary-reviewer', { status: 'REVIEWING' });
  const byId = new Map(result.reports.map((value) => [value.id, value]));
  assert.deepEqual(byId.get('report-mine').content, {
    body: 'assigned body',
    mediaUrl: 'assigned-media',
    revision: POST_REVISION,
  });
  assert.equal(byId.get('report-mine').postId, 'post-mine');
  assert.equal(byId.get('report-mine').assignedToMe, true);
  assert.equal(byId.get('report-theirs').content, null);
  assert.equal(byId.get('report-theirs').postId, null);
  assert.equal(byId.get('report-theirs').assignedToMe, false);
  assert.equal(byId.get('report-deleted').content, null);
  assert.equal(JSON.stringify(result).includes('other body'), false);
});

test('computes SLA dueAt and overdue without marking terminal reports overdue', async () => {
  const oldCreatedAt = new Date('2026-08-25T11:00:00.000Z');
  const fake = createFakePrisma({
    reports: [
      report({ id: 'report-open-old', createdAt: oldCreatedAt }),
      report({
        id: 'report-dismissed-old',
        createdAt: oldCreatedAt,
        status: 'DISMISSED',
        resolution: 'NO_VIOLATION',
        reviewedAt: new Date('2026-08-25T12:00:00.000Z'),
      }),
    ],
  });
  const moderation = service(fake);

  const open = await moderation.list('primary-reviewer', { status: 'OPEN' });
  assert.deepEqual(open.reports[0].dueAt, new Date('2026-08-26T11:00:00.000Z'));
  assert.equal(open.reports[0].overdue, true);

  const dismissed = await moderation.list('primary-reviewer', { status: 'DISMISSED' });
  assert.deepEqual(dismissed.reports[0].dueAt, new Date('2026-08-26T11:00:00.000Z'));
  assert.equal(dismissed.reports[0].overdue, false);
});

test('rejects unknown filters, invalid status/limits, and malformed cursors', async () => {
  const moderation = service(createFakePrisma());
  for (const input of [
    { reporterId: 'private-user' },
    { status: 'ALL' },
    { limit: 0 },
    { limit: 51 },
    { limit: 1.5 },
  ]) {
    await assert.rejects(
      () => moderation.list('primary-reviewer', input),
      (error) => assertModerationError(error, 'invalid_query', 400),
    );
  }

  for (const cursor of [
    'not-json',
    Buffer.from(JSON.stringify(['2026-08-26', 'report-1'])).toString('base64url'),
    Buffer.from(JSON.stringify([NOW.toISOString()])).toString('base64url'),
    Buffer.from(JSON.stringify([NOW.toISOString(), ''])).toString('base64url'),
  ]) {
    await assert.rejects(
      () => moderation.list('primary-reviewer', { cursor }),
      (error) => assertModerationError(error, 'invalid_cursor', 400),
    );
  }
});

test('claim takes the post lock, increments version, and writes a versioned audit', async () => {
  const fake = createFakePrisma({ reports: [report()], posts: [post()] });
  const result = await service(fake).claim(
    'primary-reviewer',
    'report-1',
    { expectedVersion: 0 },
  );

  assert.equal(result.report.status, 'REVIEWING');
  assert.equal(result.report.version, 1);
  assert.equal(result.report.assignedToMe, true);
  assert.deepEqual(result.report.content, {
    body: 'raw private post body',
    mediaUrl: 'https://private.invalid/media.png',
    revision: POST_REVISION,
  });
  const stored = fake.state.reports[0];
  assert.equal(stored.reviewerKeyId, 'primary-reviewer');
  assert.deepEqual(stored.claimedAt, NOW);
  assert.equal(stored.version, 1);
  assert.equal(fake.locks.length, 1);
  assert.equal(fake.locks[0].lockKey, 'post-report-target:post-1');
  assert.match(fake.locks[0].sql, /pg_advisory_xact_lock/);
  assert.deepEqual(fake.state.audits[0], {
    createdAt: NOW,
    reportId: 'report-1',
    reviewerKeyId: 'primary-reviewer',
    policyVersion: POLICY_VERSION,
    action: 'CLAIM',
    fromStatus: 'OPEN',
    toStatus: 'REVIEWING',
    fromVersion: 0,
    toVersion: 1,
    operationId: FIRST_OPERATION_ID,
    fromPostRevision: POST_REVISION,
    toPostRevision: POST_REVISION,
  });
  assert.deepEqual(result.audit, {
    operationId: FIRST_OPERATION_ID,
    reportId: 'report-1',
    policyVersion: POLICY_VERSION,
    action: 'CLAIM',
    fromStatus: 'OPEN',
    toStatus: 'REVIEWING',
    fromVersion: 0,
    toVersion: 1,
    fromPostRevision: POST_REVISION,
    toPostRevision: POST_REVISION,
    serverTimestamp: NOW,
  });
});

test('concurrent and repeated claims allow exactly one owner', async () => {
  const fake = createFakePrisma({ reports: [report()], posts: [post()] });
  const moderation = service(fake);

  const outcomes = await Promise.allSettled([
    moderation.claim('reviewer-one', 'report-1', { expectedVersion: 0 }),
    moderation.claim('reviewer-two', 'report-1', { expectedVersion: 0 }),
  ]);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejected = outcomes.find(({ status }) => status === 'rejected').reason;
  assertModerationError(rejected, 'report_not_open', 409);
  assert.equal(fake.state.audits.length, 1);
  assert.equal(fake.state.reports[0].version, 1);
  assert.ok(['reviewer-one', 'reviewer-two'].includes(fake.state.reports[0].reviewerKeyId));

  await assert.rejects(
    () => moderation.claim('reviewer-three', 'report-1', { expectedVersion: 1 }),
    (error) => assertModerationError(error, 'report_not_open', 409),
  );
  assert.equal(fake.state.audits.length, 1);
});

test('claim carries an old allegation onto the latest live revision for review', async () => {
  const fake = createFakePrisma({
    reports: [report({ postRevision: 0 })],
    posts: [post({ body: 'still harmful after edit', contentRevision: 1 })],
  });
  const result = await service(fake).claim(
    'primary-reviewer',
    'report-1',
    { expectedVersion: 0 },
  );

  assert.equal(result.report.status, 'REVIEWING');
  assert.equal(result.report.version, 1);
  assert.equal(result.report.content.revision, 1);
  assert.equal(result.report.content.body, 'still harmful after edit');
  assert.equal(fake.state.reports[0].postRevision, 1);
  assert.equal(result.audit.action, 'CLAIM');
  assert.equal(result.audit.fromPostRevision, 0);
  assert.equal(result.audit.toPostRevision, 1);
});

test('an old allegation closes only when a linked current-revision report exists', async () => {
  const fake = createFakePrisma({
    reports: [
      report({ id: 'report-old', postRevision: 0 }),
      report({ id: 'report-current', postRevision: 1, createdAt: new Date('2026-08-26T11:00:00.000Z') }),
    ],
    posts: [post({ body: 'current content', contentRevision: 1 })],
  });
  const result = await service(fake).claim(
    'primary-reviewer',
    'report-old',
    { expectedVersion: 0 },
  );

  assert.equal(result.report.status, 'ACTIONED');
  assert.equal(result.report.resolution, 'CONTENT_SUPERSEDED');
  assert.equal(result.reviewRequired, true);
  assert.equal(Object.hasOwn(result, 'replacementReportId'), false);
  assert.equal(JSON.stringify(result).includes('report-current'), false);
  assert.equal(result.audit.action, 'CLOSE_SUPERSEDED');
  assert.equal(result.audit.fromPostRevision, 0);
  assert.equal(result.audit.toPostRevision, 1);
  assert.equal(fake.state.reports.find(({ id }) => id === 'report-current').status, 'OPEN');
});

test('claiming deleted content terminally closes all pending siblings without exposing content', async () => {
  const deletedAt = new Date('2026-08-26T11:30:00.000Z');
  const fake = createFakePrisma({
    reports: [
      report({ id: 'report-deleted-open', postRevision: 0 }),
      report({
        id: 'report-deleted-reviewing',
        reporterId: 'reporter-private-2',
        postRevision: 1,
        status: 'REVIEWING',
        reviewerKeyId: 'other-reviewer',
        claimedAt: new Date('2026-08-26T11:00:00.000Z'),
        version: 3,
      }),
      report({
        id: 'report-deleted-current',
        reporterId: 'reporter-private-3',
        postRevision: 2,
      }),
    ],
    posts: [post({ body: '', mediaUrl: null, deletedAt, contentRevision: 2 })],
  });

  const result = await service(fake).claim(
    'primary-reviewer',
    'report-deleted-open',
    { expectedVersion: 0 },
  );

  assert.equal(result.report.status, 'ACTIONED');
  assert.equal(result.report.resolution, 'CONTENT_UNAVAILABLE');
  assert.equal(result.report.postId, null);
  assert.equal(result.report.content, null);
  assert.equal(result.contentChanged, false);
  assert.equal(result.affectedReportCount, 3);
  assert.equal(result.audit.action, 'CLOSE_UNAVAILABLE');
  assert.equal(result.audit.reportId, 'report-deleted-open');
  assert.equal(result.audit.operationId, FIRST_OPERATION_ID);
  assert.ok(fake.state.reports.every((value) => (
    value.status === 'ACTIONED' && value.resolution === 'CONTENT_UNAVAILABLE'
  )));
  assert.deepEqual(fake.state.audits.map((value) => ({
    reportId: value.reportId,
    action: value.action,
    operationId: value.operationId,
    fromPostRevision: value.fromPostRevision,
    toPostRevision: value.toPostRevision,
  })), [
    {
      reportId: 'report-deleted-open',
      action: 'CLOSE_UNAVAILABLE',
      operationId: FIRST_OPERATION_ID,
      fromPostRevision: 0,
      toPostRevision: 3,
    },
    {
      reportId: 'report-deleted-reviewing',
      action: 'CLOSE_UNAVAILABLE',
      operationId: FIRST_OPERATION_ID,
      fromPostRevision: 1,
      toPostRevision: 3,
    },
    {
      reportId: 'report-deleted-current',
      action: 'CLOSE_UNAVAILABLE',
      operationId: FIRST_OPERATION_ID,
      fromPostRevision: 2,
      toPostRevision: 3,
    },
  ]);
  assert.equal(fake.state.posts[0].authorId, null);
  assert.equal(fake.state.posts[0].contentRevision, 3);
});

test('decision rejects a wrong reviewer without mutation', async () => {
  const reviewing = report({
    status: 'REVIEWING',
    reviewerKeyId: 'primary-reviewer',
    claimedAt: new Date('2026-08-26T11:00:00.000Z'),
    version: 1,
  });
  const fake = createFakePrisma({ reports: [reviewing], posts: [post()] });
  const before = structuredClone(fake.state);

  await assert.rejects(
    () => service(fake).decide(
      'other-reviewer',
      'report-1',
      {
        expectedVersion: 1,
        decision: 'DISMISS',
        expectedPostRevision: POST_REVISION,
      },
    ),
    (error) => assertModerationError(error, 'report_assigned_elsewhere', 403),
  );
  assert.deepEqual(fake.state, before);
});

test('a changed live post revision is rebased for mandatory re-review before decision', async () => {
  const reviewing = report({
    status: 'REVIEWING',
    reviewerKeyId: 'primary-reviewer',
    claimedAt: new Date('2026-08-26T11:00:00.000Z'),
    version: 1,
  });
  const fake = createFakePrisma({
    reports: [reviewing],
    posts: [post({ body: 'edited after claim', contentRevision: 1 })],
  });
  const moderation = service(fake);
  const rebased = await moderation.decide(
    'primary-reviewer',
    'report-1',
    {
      expectedVersion: 1,
      decision: 'DISMISS',
      expectedPostRevision: POST_REVISION,
    },
  );
  assert.equal(rebased.reviewRequired, true);
  assert.equal(rebased.contentChanged, false);
  assert.equal(rebased.report.status, 'REVIEWING');
  assert.equal(rebased.report.version, 2);
  assert.equal(rebased.report.content.revision, 1);
  assert.equal(rebased.report.content.body, 'edited after claim');
  assert.equal(rebased.audit.action, 'REBASE_REVISION');
  assert.equal(rebased.audit.fromPostRevision, 0);
  assert.equal(rebased.audit.toPostRevision, 1);

  const dismissed = await moderation.decide(
    'primary-reviewer',
    'report-1',
    { expectedVersion: 2, decision: 'DISMISS', expectedPostRevision: 1 },
  );
  assert.equal(dismissed.report.status, 'DISMISSED');
  assert.equal(fake.state.audits.length, 2);
});

test('dismiss terminally resolves only the claimed report and audits its versions', async () => {
  const reviewing = report({
    status: 'REVIEWING',
    reviewerKeyId: 'primary-reviewer',
    claimedAt: new Date('2026-08-26T11:00:00.000Z'),
    version: 1,
  });
  const fake = createFakePrisma({
    reports: [
      reviewing,
      report({ id: 'same-reason-open', reporterId: 'reporter-private-2' }),
      report({
        id: 'same-reason-other-reviewer',
        reporterId: 'reporter-private-3',
        status: 'REVIEWING',
        reviewerKeyId: 'other-reviewer',
        claimedAt: new Date('2026-08-26T11:00:00.000Z'),
        version: 4,
      }),
    ],
    posts: [post()],
  });
  const result = await service(fake).decide(
    'primary-reviewer',
    'report-1',
    {
      expectedVersion: 1,
      decision: 'DISMISS',
      expectedPostRevision: POST_REVISION,
    },
  );

  assert.equal(result.contentChanged, false);
  assert.equal(result.affectedReportCount, 1);
  assert.equal(result.report.status, 'DISMISSED');
  assert.equal(result.report.resolution, 'NO_VIOLATION');
  assert.equal(result.report.version, 2);
  assert.equal(result.report.content, null);
  assert.deepEqual(fake.state.reports[0].reviewedAt, NOW);
  assert.deepEqual(fake.state.audits[0], {
    createdAt: NOW,
    reportId: 'report-1',
    reviewerKeyId: 'primary-reviewer',
    policyVersion: POLICY_VERSION,
    action: 'DISMISS',
    fromStatus: 'REVIEWING',
    toStatus: 'DISMISSED',
    fromVersion: 1,
    toVersion: 2,
    operationId: FIRST_OPERATION_ID,
    fromPostRevision: POST_REVISION,
    toPostRevision: POST_REVISION,
  });
  assert.deepEqual(result.audit, {
    operationId: FIRST_OPERATION_ID,
    reportId: 'report-1',
    policyVersion: POLICY_VERSION,
    action: 'DISMISS',
    fromStatus: 'REVIEWING',
    toStatus: 'DISMISSED',
    fromVersion: 1,
    toVersion: 2,
    fromPostRevision: POST_REVISION,
    toPostRevision: POST_REVISION,
    serverTimestamp: NOW,
  });
  assert.equal(fake.state.reports.find(({ id }) => id === 'same-reason-open').status, 'OPEN');
  const otherReview = fake.state.reports.find(({ id }) => id === 'same-reason-other-reviewer');
  assert.equal(otherReview.status, 'REVIEWING');
  assert.equal(otherReview.reviewerKeyId, 'other-reviewer');
});

test('REMOVE_POST redacts content and actions every pending same-post report with audits', async () => {
  const claimedAt = new Date('2026-08-26T11:00:00.000Z');
  const fake = createFakePrisma({
    reports: [
      report({
        id: 'report-primary',
        postRevision: 2,
        status: 'REVIEWING',
        reviewerKeyId: 'primary-reviewer',
        claimedAt,
        version: 2,
      }),
      report({
        id: 'report-open-sibling',
        reporterId: 'reporter-private-2',
        postRevision: 0,
      }),
      report({
        id: 'report-reviewing-sibling',
        reporterId: 'reporter-private-3',
        postRevision: 1,
        status: 'REVIEWING',
        reviewerKeyId: 'other-reviewer',
        claimedAt,
        version: 4,
      }),
      report({
        id: 'report-dismissed-sibling',
        reporterId: 'reporter-private-4',
        status: 'DISMISSED',
        reviewerKeyId: 'other-reviewer',
        claimedAt,
        reviewedAt: claimedAt,
        resolution: 'NO_VIOLATION',
        version: 2,
      }),
    ],
    posts: [post({ contentRevision: 2 })],
  });

  const result = await service(fake).decide(
    'primary-reviewer',
    'report-primary',
    {
      expectedVersion: 2,
      decision: 'REMOVE_POST',
      expectedPostRevision: 2,
    },
  );

  assert.equal(result.contentChanged, true);
  assert.equal(result.affectedReportCount, 3);
  assert.equal(result.report.status, 'ACTIONED');
  assert.equal(result.report.content, null);
  assert.equal(result.audit.operationId, FIRST_OPERATION_ID);
  assert.equal(result.audit.action, 'REMOVE_POST');
  assert.equal(result.audit.reportId, 'report-primary');
  assert.equal(result.audit.toVersion, 3);
  assert.deepEqual(fake.state.posts[0], {
    id: 'post-1',
    authorId: null,
    body: '',
    mediaUrl: null,
    deletedAt: NOW,
    contentRevision: 3,
    updatedAt: NOW,
  });

  const byId = new Map(fake.state.reports.map((value) => [value.id, value]));
  for (const id of ['report-primary', 'report-open-sibling', 'report-reviewing-sibling']) {
    assert.equal(byId.get(id).status, 'ACTIONED');
    assert.equal(byId.get(id).resolution, 'CONTENT_REMOVED');
    assert.deepEqual(byId.get(id).reviewedAt, NOW);
  }
  assert.equal(byId.get('report-primary').version, 3);
  assert.equal(byId.get('report-open-sibling').version, 1);
  assert.equal(byId.get('report-open-sibling').reviewerKeyId, 'primary-reviewer');
  assert.deepEqual(byId.get('report-open-sibling').claimedAt, NOW);
  assert.equal(byId.get('report-reviewing-sibling').version, 5);
  assert.equal(byId.get('report-reviewing-sibling').reviewerKeyId, 'primary-reviewer');
  assert.equal(byId.get('report-dismissed-sibling').status, 'DISMISSED');
  assert.equal(byId.get('report-dismissed-sibling').version, 2);

  assert.equal(fake.state.audits.length, 3);
  assert.ok(fake.state.audits.every(({ toPostRevision }) => toPostRevision === 3));
  assert.deepEqual(
    fake.state.audits.map(({ fromPostRevision }) => fromPostRevision).sort(),
    [0, 1, 2],
  );
  assert.equal(fake.fanouts.length, 1);
  assert.match(fake.fanouts[0].sql, /WITH pending AS/);
  assert.deepEqual(
    fake.state.audits
      .map(({ reportId, reviewerKeyId, action, fromStatus, toStatus, fromVersion, toVersion, policyVersion }) => ({
        reportId,
        reviewerKeyId,
        action,
        fromStatus,
        toStatus,
        fromVersion,
        toVersion,
        policyVersion,
      }))
      .sort((left, right) => left.reportId.localeCompare(right.reportId)),
    [
      {
        reportId: 'report-open-sibling',
        reviewerKeyId: 'primary-reviewer',
        action: 'REMOVE_POST',
        fromStatus: 'OPEN',
        toStatus: 'ACTIONED',
        fromVersion: 0,
        toVersion: 1,
        policyVersion: POLICY_VERSION,
      },
      {
        reportId: 'report-primary',
        reviewerKeyId: 'primary-reviewer',
        action: 'REMOVE_POST',
        fromStatus: 'REVIEWING',
        toStatus: 'ACTIONED',
        fromVersion: 2,
        toVersion: 3,
        policyVersion: POLICY_VERSION,
      },
      {
        reportId: 'report-reviewing-sibling',
        reviewerKeyId: 'primary-reviewer',
        action: 'REMOVE_POST',
        fromStatus: 'REVIEWING',
        toStatus: 'ACTIONED',
        fromVersion: 4,
        toVersion: 5,
        policyVersion: POLICY_VERSION,
      },
    ],
  );
});

test('an audit write failure rolls back post redaction, report transitions, and prior audits', async () => {
  const fake = createFakePrisma({
    reports: [
      report({
        id: 'report-primary',
        status: 'REVIEWING',
        reviewerKeyId: 'primary-reviewer',
        claimedAt: new Date('2026-08-26T11:00:00.000Z'),
        version: 1,
      }),
      report({ id: 'report-sibling', reporterId: 'reporter-private-2' }),
    ],
    posts: [post()],
    failAuditAt: 2,
  });
  const before = structuredClone(fake.state);

  await assert.rejects(
    () => service(fake).decide(
      'primary-reviewer',
      'report-primary',
      {
        expectedVersion: 1,
        decision: 'REMOVE_POST',
        expectedPostRevision: POST_REVISION,
      },
    ),
    (error) => {
      assert.equal(error.name, 'AuditStorageFailure');
      return true;
    },
  );
  assert.deepEqual(fake.state, before);
});

test('post-wide terminal action fails closed before committing an oversized fan-out', async () => {
  const reports = Array.from({ length: 251 }, (_, index) => report({
    id: `report-${index + 1}`,
    reporterId: `reporter-private-${index + 1}`,
    ...(index === 0 ? {
      status: 'REVIEWING',
      reviewerKeyId: 'primary-reviewer',
      claimedAt: new Date('2026-08-26T11:00:00.000Z'),
      version: 1,
    } : {}),
  }));
  const fake = createFakePrisma({ reports, posts: [post()] });
  const before = structuredClone(fake.state);

  await assert.rejects(
    () => service(fake).decide(
      'primary-reviewer',
      'report-1',
      {
        expectedVersion: 1,
        decision: 'REMOVE_POST',
        expectedPostRevision: POST_REVISION,
      },
    ),
    (error) => assertModerationError(error, 'report_fanout_exceeded', 503),
  );
  assert.deepEqual(fake.state, before);
  assert.equal(fake.fanouts.length, 0);
});

test('a deleted post closes every pending report as unavailable with an exact audit receipt', async () => {
  const fake = createFakePrisma({
    reports: [report({
      status: 'REVIEWING',
      reviewerKeyId: 'primary-reviewer',
      claimedAt: new Date('2026-08-26T11:00:00.000Z'),
      version: 1,
    })],
    posts: [post({ body: '', mediaUrl: null, deletedAt: new Date('2026-08-26T11:30:00.000Z') })],
  });
  const result = await service(fake).decide(
    'primary-reviewer',
    'report-1',
    {
      expectedVersion: 1,
      decision: 'REMOVE_POST',
      expectedPostRevision: POST_REVISION,
    },
  );
  assert.equal(result.contentChanged, false);
  assert.equal(result.affectedReportCount, 1);
  assert.equal(result.report.status, 'ACTIONED');
  assert.equal(result.report.resolution, 'CONTENT_UNAVAILABLE');
  assert.equal(result.report.version, 2);
  assert.equal(result.audit.action, 'CLOSE_UNAVAILABLE');
  assert.equal(result.audit.operationId, FIRST_OPERATION_ID);
  assert.equal(result.audit.toVersion, 2);
  assert.equal(fake.state.audits[0].action, 'CLOSE_UNAVAILABLE');
  assert.equal(fake.state.audits[0].operationId, FIRST_OPERATION_ID);
});
