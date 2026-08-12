import assert from 'node:assert/strict';
import test from 'node:test';
import {
  amaDmMessage,
  AMA_FROZEN_PERMISSIONS,
  AMA_OPEN_FLOOR_PERMISSIONS,
  botHasAdminRight,
  createTelegramAmaController,
  memberIsAdmin,
  normalizeApprovedScript,
  telegramTextChunks,
} from '../src/lib/telegram-ama.js';

test('live-question permissions open text only and preserve the admin-only freeze state', () => {
  assert.equal(AMA_FROZEN_PERMISSIONS.can_send_messages, false);
  assert.equal(AMA_OPEN_FLOOR_PERMISSIONS.can_send_messages, true);
  for (const key of [
    'can_send_photos',
    'can_send_videos',
    'can_send_voice_notes',
    'can_send_polls',
    'can_send_other_messages',
    'can_add_web_page_previews',
  ]) {
    assert.equal(AMA_OPEN_FLOOR_PERMISSIONS[key], false, `${key} must stay disabled`);
  }
});

test('pre-existing Fig admin and required Bot rights are accepted', () => {
  assert.equal(memberIsAdmin({ status: 'administrator' }), true);
  assert.equal(memberIsAdmin({ status: 'member' }), false);
  assert.equal(botHasAdminRight({ status: 'creator' }, 'can_pin_messages'), true);
  assert.equal(botHasAdminRight({
    status: 'administrator',
    can_restrict_members: true,
  }, 'can_restrict_members'), true);
  assert.equal(botHasAdminRight({
    status: 'administrator',
    can_promote_members: false,
  }, 'can_promote_members'), false);
});

test('approved scripts tolerate whitespace only, not changed wording', () => {
  assert.equal(
    normalizeApprovedScript('Approved\n  answer.'),
    normalizeApprovedScript('Approved answer.'),
  );
  assert.notEqual(
    normalizeApprovedScript('Approved answer.'),
    normalizeApprovedScript('Changed answer.'),
  );
});

test('long Korean translations are split below Telegram message limits', () => {
  const chunks = telegramTextChunks('문장 '.repeat(1200), 3500);
  assert.equal(chunks.length > 1, true);
  assert.equal(chunks.every((chunk) => chunk.length <= 3500), true);
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), '문장 '.repeat(1200).trim());
});

test('AMA DM stages use concise Korean copy and no unsupported open-rate claim', () => {
  for (const stage of ['announcement', 'postlaunch', 'day', 't60', 'recap']) {
    const copy = amaDmMessage(stage);
    assert.equal(typeof copy, 'string');
    assert.equal(copy.length < 1000, true);
    assert.doesNotMatch(copy, /오픈율|읽음률/);
  }
  assert.match(amaDmMessage('announcement'), /1\. AMA 방 입장/);
  assert.match(amaDmMessage('announcement'), /3\. 친구 초대하기/);
  assert.match(amaDmMessage('t60'), /1시간 뒤/);
});

test('AMA preflight confirms Fig, Bot rights, scripts, translation, and room restore state', async () => {
  const systemEvents = [];
  const bot = {
    async getMe() { return { id: 99, username: 'quiz_bot' }; },
    async getChat() { return { permissions: { can_send_messages: true } }; },
    async getChatMember(_chatId, userId) {
      if (String(userId) === '99') {
        return {
          status: 'administrator',
          can_restrict_members: true,
          can_promote_members: true,
          can_pin_messages: true,
        };
      }
      return { status: 'administrator' };
    },
  };
  const service = {
    async preparedStatus() {
      return {
        ready: true,
        questions: Array.from({ length: 5 }, (_, index) => ({
          position: index + 1,
          approvedAnswerEn: `Answer ${index + 1}`,
        })),
      };
    },
    async recordSystemEvent(type, details) {
      systemEvents.push({ type, details });
    },
  };
  const controller = createTelegramAmaController({
    bot,
    service,
    translator: { configured: () => true },
    config: {
      chatId: '-1001',
      speakerTelegramId: '55',
      operatorTelegramIds: ['1'],
      preparedQuestionCount: 5,
      startAt: new Date('2026-08-05T11:00:00Z'),
      endAt: new Date('2026-08-05T11:30:00Z'),
    },
  });

  const { checks } = await controller.runPreflight();
  assert.equal(checks.ready, true);
  assert.equal(checks.figAdmin, true);
  assert.equal(checks.approvedScripts, 5);
  assert.equal(systemEvents[0].type, 'ama_speaker_registered');
  assert.equal(systemEvents[0].details.payload.preExistingAdmin, true);
});

test('operator commands open a text-only question window and re-lock member posting', async () => {
  const commands = [];
  const permissions = [];
  const messages = [];
  let sessionStatus = 'LIVE';
  const bot = {
    onText(pattern, handler) { commands.push({ pattern, handler }); },
    on() {},
    async setChatPermissions(_chatId, value) { permissions.push(value); },
    async sendMessage(chatId, text) {
      messages.push({ chatId, text });
      return { message_id: messages.length };
    },
  };
  const service = {
    async session() {
      return { status: sessionStatus };
    },
    async markOpenFloor() {
      sessionStatus = 'OPEN_FLOOR';
      return { status: sessionStatus };
    },
    async markOpenFloorClosed() {
      sessionStatus = 'LIVE';
      return { status: sessionStatus, openFloorQuestionCount: 3 };
    },
  };
  const controller = createTelegramAmaController({
    bot,
    service,
    translator: {},
    config: {
      chatId: '-1001',
      speakerTelegramId: '55',
      operatorTelegramIds: ['1'],
    },
  });
  controller.register();
  const operatorMessage = { chat: { id: 1, type: 'private' }, from: { id: 1 } };
  const open = commands.find(({ pattern }) => String(pattern).includes('ama_open_floor'));
  const close = commands.find(({ pattern }) => String(pattern).includes('ama_close_floor'));

  await open.handler(operatorMessage);
  assert.equal(sessionStatus, 'OPEN_FLOOR');
  assert.equal(permissions[0], AMA_OPEN_FLOOR_PERMISSIONS);
  await close.handler(operatorMessage);
  assert.equal(sessionStatus, 'LIVE');
  assert.equal(permissions[1], AMA_FROZEN_PERMISSIONS);
  assert.equal(messages.some(({ text }) => text.includes('총 3개의 유효 질문')), true);
});
