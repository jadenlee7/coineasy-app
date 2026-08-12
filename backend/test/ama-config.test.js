import assert from 'node:assert/strict';
import test from 'node:test';
import {
  amaCampaignEnabled,
  buildAmaConfig,
  isAmaOperator,
  isWithinAmaWindow,
} from '../src/lib/ama-config.js';

function validEnv(overrides = {}) {
  return {
    AMA_CAMPAIGN_ENABLED: 'true',
    AMA_CHAT_ID: '-1001234567890',
    AMA_SPEAKER_TELEGRAM_ID: '12345678',
    AMA_OPERATOR_TELEGRAM_IDS: '11, 22,11',
    AMA_START_AT: '2026-08-05T11:00:00Z',
    AMA_END_AT: '2026-08-05T11:30:00Z',
    OPENAI_API_KEY: 'server-only-key',
    AMA_TRANSLATION_MODEL: 'translation-model',
    ...overrides,
  };
}

test('AMA is disabled by default and invalid enabled config fails closed', () => {
  assert.equal(amaCampaignEnabled({}), false);
  assert.equal(buildAmaConfig({}).valid, true);

  const config = buildAmaConfig({ AMA_CAMPAIGN_ENABLED: 'true' });
  assert.equal(config.valid, false);
  assert.equal(config.errors.length >= 6, true);
});

test('AMA config parses IDs, window, defaults, and operators', () => {
  const config = buildAmaConfig(validEnv({
    AMA_DM_EXCLUDED_TELEGRAM_IDS: '33,44',
  }));
  assert.equal(config.valid, true);
  assert.equal(config.campaignId, 'squid_ama_2026_08_05');
  assert.deepEqual(config.operatorTelegramIds, ['11', '22']);
  assert.equal(config.questionLimit, 3);
  assert.equal(config.preparedQuestionCount, 5);
  assert.equal(config.lightningQuestionCount, 5);
  assert.equal(config.qualifiedReferralXp, 30);
  assert.equal(config.qualifiedReferralLimit, 10);
  assert.deepEqual(config.dmExcludedTelegramIds, ['33', '44']);
  assert.equal(config.dmDelayMs, 50);
  assert.equal(config.restoreAt.toISOString(), '2026-08-05T11:35:00.000Z');
  assert.equal(isAmaOperator(config, 22), true);
  assert.equal(isAmaOperator(config, 99), false);
  assert.equal(isWithinAmaWindow(config, new Date('2026-08-05T11:15:00Z')), true);
  assert.equal(isWithinAmaWindow(config, new Date('2026-08-05T11:31:00Z')), false);
});

test('AMA config rejects a reversed schedule and non-numeric Telegram targets', () => {
  const config = buildAmaConfig(validEnv({
    AMA_CHAT_ID: '@squid_kor',
    AMA_SPEAKER_TELEGRAM_ID: '@fig',
    AMA_START_AT: '2026-08-05T11:30:00Z',
    AMA_END_AT: '2026-08-05T11:00:00Z',
  }));
  assert.equal(config.valid, false);
  assert.equal(config.errors.some((item) => item.includes('AMA_CHAT_ID')), true);
  assert.equal(config.errors.some((item) => item.includes('AMA_SPEAKER_TELEGRAM_ID')), true);
  assert.equal(config.errors.some((item) => item.includes('chronological')), true);
});
