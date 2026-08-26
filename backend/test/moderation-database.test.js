import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MODERATION_DATABASE_CONTRACT_SQL,
  ModerationDatabaseContractError,
  verifyModerationDatabaseContract,
} from '../src/lib/moderation-database.js';

test('moderation database contract is one bounded metadata query with no secret inputs', async () => {
  let observedSql;
  const db = {
    async $queryRawUnsafe(sql) {
      observedSql = sql;
      return [{ contractReady: true }];
    },
  };

  assert.equal(await verifyModerationDatabaseContract(db), true);
  assert.equal(observedSql, MODERATION_DATABASE_CONTRACT_SQL);
  assert.match(observedSql, /20260826144000_moderation_queue/u);
  assert.match(observedSql, /uniq_post_report_reporter_revision/u);
  assert.match(observedSql, /PostReport_state_consistency_check/u);
  assert.match(observedSql, /PostReport_reporterId_fkey/u);
  assert.equal(observedSql.includes('eg_mod_'), false);
});

test('missing or malformed physical contracts fail closed with one safe error', async () => {
  for (const result of [
    [],
    [{ contractReady: false }],
    [{ contractReady: null }],
    [{ contractReady: true }, { contractReady: true }],
  ]) {
    await assert.rejects(
      () => verifyModerationDatabaseContract({
        async $queryRawUnsafe() { return result; },
      }),
      (error) => (
        error instanceof ModerationDatabaseContractError
        && error.message === 'moderation database contract is unavailable'
      ),
    );
  }
});
