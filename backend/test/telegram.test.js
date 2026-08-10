import assert from 'node:assert/strict';
import test from 'node:test';
import { telegramStartupMode } from '../src/lib/telegram.js';

test('Telegram is disabled without a token', () => {
  assert.equal(telegramStartupMode({}), 'disabled');
  assert.equal(telegramStartupMode({ TELEGRAM_WEBHOOK_URL: 'https://example.com/hook' }), 'disabled');
});

test('Telegram uses polling locally and webhook mode when a URL is configured', () => {
  assert.equal(telegramStartupMode({ TELEGRAM_BOT_TOKEN: 'token' }), 'polling');
  assert.equal(telegramStartupMode({
    TELEGRAM_BOT_TOKEN: 'token',
    TELEGRAM_WEBHOOK_URL: 'https://api.easygo.example/telegram/webhook/secret',
  }), 'webhook');
});
