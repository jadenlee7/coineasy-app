import assert from 'node:assert/strict';
import test from 'node:test';
import TelegramBot from 'node-telegram-bot-api';
import { telegramStartupMode } from '../src/lib/telegram.js';

test('installed Telegram client exposes every API used by the EasyGo wrapper', () => {
  const requiredMethods = [
    'on',
    'onText',
    'processUpdate',
    'sendMessage',
    'stopPolling',
  ];

  for (const method of requiredMethods) {
    assert.equal(typeof TelegramBot.prototype[method], 'function', `${method} must be available`);
  }

  const webhookMethod = TelegramBot.prototype.setWebHook
    ? 'setWebHook'
    : TelegramBot.prototype.setWebhook
      ? 'setWebhook'
      : null;
  assert.notEqual(
    webhookMethod,
    null,
    'Telegram client must expose setWebhook or setWebHook',
  );
});

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
