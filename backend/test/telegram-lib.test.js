import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getTelegramBalanceById,
  getTelegramWalletById,
  registerHandlers,
} from '../src/lib/telegram.js';

function makeMockBot() {
  const events = [];
  const messages = [];
  return {
    events,
    messages,
    onText(pattern, handler) {
      events.push({ pattern, handler, type: 'text' });
    },
    on(type, _handler) {
      events.push({ type, handler: _handler });
    },
    sendMessage: async (_chatId, text) => {
      messages.push({ chatId: _chatId, text });
      return { message_id: messages.length };
    },
  };
}

function getHandler(events, patternFragment) {
  const found = events.find((entry) => entry.type === 'text' && String(entry.pattern).includes(patternFragment));
  assert.equal(typeof found, 'object', `handler for ${patternFragment} should exist`);
  return found.handler;
}

function makeDb({ userById = null, balance = null } = {}) {
  return {
    user: {
      findUnique: async () => userById,
    },
    orangeLedger: {
      aggregate: async () => ({ _sum: { delta: balance } }),
    },
  };
}

function makeDbWithWallet({
  user = null,
} = {}) {
  return {
    user: {
      findUnique: async () => user,
    },
  };
}

test('getTelegramBalanceById returns null when telegramId is missing', async () => {
  const result = await getTelegramBalanceById(makeDb(), '');
  assert.equal(result, null);
});

test('getTelegramBalanceById returns null for unknown telegramId', async () => {
  const result = await getTelegramBalanceById(makeDb({ userById: null }), '999');
  assert.equal(result, null);
});

test('getTelegramBalanceById returns userId and computed balance', async () => {
  const result = await getTelegramBalanceById(
    makeDb({ userById: { id: 'user-1' }, balance: 123 }),
    '12345',
  );
  assert.equal(result.userId, 'user-1');
  assert.equal(result.balance, 123);
});

test('registerHandlers handles /balance for linked users', async () => {
  const bot = makeMockBot();
  const db = makeDb({ userById: { id: 'user-1' }, balance: 1234 });
  registerHandlers(bot, {
    db,
    env: {},
    appLogger: { info: () => {}, error: () => {} },
  });

  const handler = getHandler(bot.events, '/balance');
  await handler({ from: { id: 1001 }, chat: { id: 2002 } });
  assert.equal(bot.messages.length, 1);
  assert.equal(bot.messages[0].chatId, 2002);
  assert.equal(bot.messages[0].text, '현재 보유 🍊 잔액: 1,234 Orange.');
});

test('registerHandlers explains /balance unlinked users', async () => {
  const bot = makeMockBot();
  registerHandlers(bot, {
    db: makeDb({ userById: null }),
    env: {},
    appLogger: { info: () => {}, error: () => {} },
  });

  const handler = getHandler(bot.events, '/balance');
  await handler({ from: { id: 1001 }, chat: { id: 2002 } });
  assert.equal(bot.messages[0].text, 'EasyGo 연동 계정이 아직 없어서 잔액을 조회할 수 없어요. 앱에서 먼저 연동해주세요.');
});

test('registerHandlers handles /invite with prepared bot username', async () => {
  const bot = makeMockBot();
  registerHandlers(bot, {
    db: makeDb({ userById: { id: 'user-1' }, balance: 0 }),
    env: { TELEGRAM_BOT_USERNAME: 'easygo_bot' },
    appLogger: { info: () => {}, error: () => {} },
  });

  const handler = getHandler(bot.events, '/invite');
  await handler({ from: { id: 1001 }, chat: { id: 2002 } });
  assert.equal(bot.messages[0].text, '초대 링크가 준비되었어요.\nhttps://t.me/easygo_bot?start=invite');
});

test('registerHandlers blocks /invite when bot username is missing', async () => {
  const bot = makeMockBot();
  registerHandlers(bot, {
    db: makeDb({ userById: { id: 'user-1' }, balance: 0 }),
    env: {},
    appLogger: { info: () => {}, error: () => {} },
  });

  const handler = getHandler(bot.events, '/invite');
  await handler({ from: { id: 1001 }, chat: { id: 2002 } });
  assert.equal(bot.messages[0].text, '초대 링크 설정이 아직 준비되지 않았어요. 나중에 다시 시도해 주세요.');
});

test('registerHandlers handles /help with default command list', async () => {
  const bot = makeMockBot();
  registerHandlers(bot, {
    db: makeDb({ userById: { id: 'user-1' }, balance: 0 }),
    env: {},
    appLogger: { info: () => {}, error: () => {} },
  });

  const handler = getHandler(bot.events, '/help');
  await handler({ from: { id: 1001 }, chat: { id: 2002 } });
  assert.equal(
    bot.messages[0].text,
    [
      'EasyGo Bot 명령어',
      '/start - 앱 연동/웰컴 안내',
      '/balance - 🍊 Orange 보유량 조회',
      '/wallet - 연동 지갑 주소 조회',
      '/invite - 추천 링크 생성',
    ].join('\n'),
  );
});

test('getTelegramWalletById returns null when no wallet exists', async () => {
  const result = await getTelegramWalletById(
    makeDbWithWallet({ user: null }),
    '12345',
  );
  assert.equal(result, null);
});

test('getTelegramWalletById returns userId and walletAddress', async () => {
  const result = await getTelegramWalletById(
    makeDbWithWallet({ user: { id: 'user-1', walletAddress: '0xabc' } }),
    '12345',
  );
  assert.equal(result.userId, 'user-1');
  assert.equal(result.walletAddress, '0xabc');
});

test('registerHandlers handles /wallet for linked users with wallet address', async () => {
  const bot = makeMockBot();
  registerHandlers(bot, {
    db: makeDbWithWallet({
      user: {
        id: 'user-1',
        walletAddress: '0xabc123',
      },
    }),
    env: {},
    appLogger: { info: () => {}, error: () => {} },
  });

  const handler = getHandler(bot.events, '/wallet');
  await handler({ from: { id: 1001 }, chat: { id: 2002 } });
  assert.equal(
    bot.messages[0].text,
    [
      '연동된 지갑 주소: 0xabc123',
      'Base 체인에서 보기: https://basescan.org/address/0xabc123',
    ].join('\n'),
  );
});

test('registerHandlers explains /wallet when user is not linked', async () => {
  const bot = makeMockBot();
  registerHandlers(bot, {
    db: makeDbWithWallet({
      user: null,
    }),
    env: {},
    appLogger: { info: () => {}, error: () => {} },
  });

  const handler = getHandler(bot.events, '/wallet');
  await handler({ from: { id: 1001 }, chat: { id: 2002 } });
  assert.equal(
    bot.messages[0].text,
    'EasyGo 연동 계정이 아직 없어서 지갑 주소를 조회할 수 없어요. 앱에서 먼저 연동해주세요.',
  );
});

test('registerHandlers explains /wallet when wallet missing', async () => {
  const bot = makeMockBot();
  registerHandlers(bot, {
    db: makeDbWithWallet({
      user: {
        id: 'user-1',
        walletAddress: null,
      },
    }),
    env: {},
    appLogger: { info: () => {}, error: () => {} },
  });

  const handler = getHandler(bot.events, '/wallet');
  await handler({ from: { id: 1001 }, chat: { id: 2002 } });
  assert.equal(
    bot.messages[0].text,
    '지갑이 아직 발급되지 않았어요. 앱에서 지갑 생성/연결을 완료한 뒤 다시 시도해 주세요.',
  );
});
