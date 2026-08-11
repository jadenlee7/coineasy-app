import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Prisma } from '@prisma/client';

const dmmfModels = Prisma.dmmf.datamodel.models;
const pathCMigration = readFileSync(
  new URL(
    '../prisma/migrations/20260721143000_path_c_v2/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const pushTokenMigration = readFileSync(
  new URL(
    '../prisma/migrations/20260811110000_expo_push_tokens/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

function model(name) {
  const result = dmmfModels.find((item) => item.name === name);
  assert.ok(result, `expected Prisma model ${name}`);
  return result;
}

function field(modelName, fieldName) {
  const result = model(modelName).fields.find((item) => item.name === fieldName);
  assert.ok(result, `expected ${modelName}.${fieldName}`);
  return result;
}

test('Path C v2 adds the eight S2 models', () => {
  const expected = [
    'UserConsent',
    'UserConsentAudit',
    'Quest',
    'QuestCompletion',
    'Segment',
    'UserSegment',
    'Advertiser',
    'Campaign',
  ];

  assert.deepEqual(
    expected.filter((name) => dmmfModels.some((item) => item.name === name)),
    expected,
  );
});

test('Path C v2 has an additive deployable migration for every S2 table', () => {
  for (const table of [
    'UserConsent',
    'UserConsentAudit',
    'Quest',
    'QuestCompletion',
    'Segment',
    'UserSegment',
    'Advertiser',
    'Campaign',
  ]) {
    assert.match(pathCMigration, new RegExp(`CREATE TABLE "${table}"`));
  }
  assert.doesNotMatch(pathCMigration, /\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(pathCMigration, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(pathCMigration, /\bTRUNCATE\b/i);
});

test('privacy-sensitive choices deny by default', () => {
  for (const [modelName, fieldName] of [
    ['UserConsent', 'segmentingOptIn'],
    ['UserConsent', 'marketingOptIn'],
    ['UserConsentAudit', 'segmentingOptIn'],
    ['UserConsentAudit', 'marketingOptIn'],
    ['QuestCompletion', 'walletSharingOptIn'],
  ]) {
    const privacyField = field(modelName, fieldName);
    assert.equal(privacyField.isRequired, true);
    assert.equal(privacyField.default, false);
  }
});

test('S4 subname issuance starts dormant and stores one name per user', () => {
  const status = field('User', 'subnameStatus');
  const subname = field('User', 'subname');
  assert.equal(status.default, 'NOT_REQUESTED');
  assert.equal(status.type, 'EnsSubnameStatus');
  assert.equal(subname.isUnique, true);
  assert.ok(field('User', 'subnameChallengeHash'));
  assert.ok(field('User', 'subnameChallengeExpiresAt'));
});

test('consent and membership cardinality is enforced by the database model', () => {
  assert.equal(field('UserConsent', 'userId').isId, true);
  assert.deepEqual(model('UserSegment').primaryKey?.fields, ['userId', 'segmentId']);
  assert.deepEqual(model('QuestCompletion').uniqueFields, [['questId', 'userId']]);

  // Raw per-user behavioral evidence is intentionally not persisted here.
  assert.equal(model('UserSegment').fields.some((item) => item.name === 'evidence'), false);
});

test('user-owned privacy data cascades but campaign history is restricted', () => {
  const relationDelete = (modelName, relationName) =>
    field(modelName, relationName).relationOnDelete;

  assert.equal(relationDelete('UserConsent', 'user'), 'Cascade');
  assert.equal(relationDelete('UserConsentAudit', 'user'), 'Cascade');
  assert.equal(relationDelete('QuestCompletion', 'user'), 'Cascade');
  assert.equal(relationDelete('UserSegment', 'user'), 'Cascade');

  assert.equal(relationDelete('QuestCompletion', 'quest'), 'Restrict');
  assert.equal(relationDelete('UserSegment', 'segment'), 'Restrict');
  assert.equal(relationDelete('Quest', 'campaign'), 'Restrict');
  assert.equal(relationDelete('Campaign', 'advertiser'), 'Restrict');
  assert.equal(relationDelete('Campaign', 'targetSegment'), 'Restrict');
});

test('Expo push registrations are unique, account-owned, and additively migrated', () => {
  assert.equal(field('ExpoPushToken', 'token').isUnique, true);
  assert.equal(field('ExpoPushToken', 'platform').isRequired, true);
  assert.equal(field('ExpoPushToken', 'user').relationOnDelete, 'Cascade');
  assert.match(pushTokenMigration, /CREATE TABLE "ExpoPushToken"/u);
  assert.match(pushTokenMigration, /CREATE UNIQUE INDEX "ExpoPushToken_token_key"/u);
  assert.match(pushTokenMigration, /ON DELETE CASCADE/u);
  assert.doesNotMatch(pushTokenMigration, /\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/iu);
  assert.doesNotMatch(pushTokenMigration, /\bDELETE\s+FROM\b/iu);
  assert.doesNotMatch(pushTokenMigration, /\bTRUNCATE\b/iu);
});
