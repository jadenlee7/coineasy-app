import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Prisma } from '@prisma/client';

const migration = readFileSync(
  new URL(
    '../prisma/migrations/20260730190000_squid_ama_campaign/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const modelNames = new Set(Prisma.dmmf.datamodel.models.map((model) => model.name));
const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));

test('AMA campaign schema contains the participant, event, XP, question, script, and session records', () => {
  for (const name of [
    'TelegramCampaignParticipant',
    'TelegramCampaignEvent',
    'TelegramCampaignReward',
    'AmaQuestion',
    'AmaPreparedQuestion',
    'AmaQuestionPack',
    'AmaSession',
  ]) {
    assert.equal(modelNames.has(name), true, `missing Prisma model ${name}`);
    assert.match(migration, new RegExp(`CREATE TABLE "${name}"`));
  }
});

test('AMA migration is additive and XP rewards are idempotent', () => {
  assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|COLUMN|TYPE)\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\b/i);
  assert.match(
    migration,
    /TelegramCampaignReward_campaignId_reason_refId_key/,
  );
  assert.match(
    migration,
    /AmaQuestion_campaignId_normalizedHash_key/,
  );
  assert.match(migration, /"AmaAnswerMode"/);
  assert.match(migration, /"sourceQuestionId"/);
  const preparedFields = new Set(
    models.get('AmaPreparedQuestion').fields.map((field) => field.name),
  );
  assert.equal(preparedFields.has('translationLatencyMs'), true);
  assert.match(migration, /"translationLatencyMs" INTEGER/);
  const participantFields = new Set(
    models.get('TelegramCampaignParticipant').fields.map((field) => field.name),
  );
  assert.equal(participantFields.has('referralCode'), true);
  assert.equal(participantFields.has('referralQualifiedAt'), true);
  assert.match(migration, /'OPEN_FLOOR'/);
  assert.match(migration, /"openFloorQuestionCount" INTEGER/);
});
