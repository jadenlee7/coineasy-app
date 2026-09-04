import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  WEEKLY_ONCHAIN_BOSS_W0,
  WEEKLY_ONCHAIN_BOSS_W0_ENABLED,
  WEEKLY_ONCHAIN_BOSS_W0_VERSION,
} from '../data/weeklyOnchainBoss.mjs';
import {
  advanceWeeklyOnchainBossAct,
  answerWeeklyOnchainBossAct,
  createWeeklyOnchainBossSession,
  sameWeeklyOnchainBossLease,
  shouldInvalidateWeeklyOnchainBossForAppState,
  summarizeWeeklyOnchainBossSession,
} from '../utils/weeklyOnchainBossEngine.mjs';
import { findForbiddenAppStoreMarkers } from '../scripts/check-appstore-bundle.mjs';

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function correctChoice(act) {
  return act.choices.find((choice) => choice.correct);
}

function assertDeepFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const nested of Object.values(value)) assertDeepFrozen(nested, seen);
}

test('W0 is a fail-closed four-act curated Base raid', () => {
  assert.equal(WEEKLY_ONCHAIN_BOSS_W0_VERSION, 1);
  assert.equal(WEEKLY_ONCHAIN_BOSS_W0_ENABLED, false);
  assert.match(WEEKLY_ONCHAIN_BOSS_W0.eyebrow, /W0 OFFLINE/);
  assert.deepEqual(
    WEEKLY_ONCHAIN_BOSS_W0.acts.map((act) => act.id),
    ['ready-check', 'receipt-trail', 'scam-ambush', 'quote-shield'],
  );

  const actIds = new Set();
  const choiceIds = new Set();
  for (const act of WEEKLY_ONCHAIN_BOSS_W0.acts) {
    assert.equal(actIds.has(act.id), false);
    actIds.add(act.id);
    assert.equal(act.choices.filter((choice) => choice.correct).length, 1);
    for (const choice of act.choices) {
      assert.equal(choiceIds.has(choice.id), false);
      choiceIds.add(choice.id);
    }
  }
  assertDeepFrozen(WEEKLY_ONCHAIN_BOSS_W0);
});

test('the ready check uses Base chain 8453 and only truncated training data', () => {
  const ready = WEEKLY_ONCHAIN_BOSS_W0.acts[0];
  const serialized = JSON.stringify(WEEKLY_ONCHAIN_BOSS_W0);

  assert.equal(ready.fields.find((field) => field.id === 'network').value, 'Base');
  assert.equal(ready.fields.find((field) => field.id === 'chain').value, '8453');
  assert.match(ready.fields.find((field) => field.id === 'address').value, /…/);
  assert.doesNotMatch(serialized, /0x[a-fA-F0-9]{40}/);
  assert.doesNotMatch(serialized, /\b[a-z]+(?:\s+[a-z]+){11,23}\b/i);
});

test('the final safety decision is always stop and recheck', () => {
  const finalAct = WEEKLY_ONCHAIN_BOSS_W0.acts.at(-1);
  const correct = correctChoice(finalAct);
  const labels = WEEKLY_ONCHAIN_BOSS_W0.acts.flatMap((act) => (
    act.choices.map((choice) => choice.label)
  )).join('\n');

  assert.equal(finalAct.id, 'quote-shield');
  assert.equal(correct.id, 'stop-and-recheck');
  assert.equal(correct.label, '멈추고 다시 확인');
  assert.doesNotMatch(labels, /\b(?:Execute|Accept|Confirm|Swap|Sign|Send|Claim|Mint)\b/i);
});

test('the quote shield includes every documented fixed safety field', () => {
  const quote = WEEKLY_ONCHAIN_BOSS_W0.acts.at(-1);
  assert.deepEqual(
    quote.fields.map((field) => field.id),
    ['pay', 'expected', 'minimum', 'fee', 'impact', 'expires'],
  );
});

test('lifecycle decisions invalidate background and changed account leases', () => {
  assert.equal(shouldInvalidateWeeklyOnchainBossForAppState('active', 'inactive'), true);
  assert.equal(shouldInvalidateWeeklyOnchainBossForAppState('active', 'background'), true);
  assert.equal(shouldInvalidateWeeklyOnchainBossForAppState(null, 'background'), true);
  assert.equal(shouldInvalidateWeeklyOnchainBossForAppState('inactive', 'active'), false);
  assert.equal(shouldInvalidateWeeklyOnchainBossForAppState('background', 'active'), false);

  const first = Object.freeze({ ownerUserId: 'did:privy:training-a', sessionEpoch: 1 });
  assert.equal(sameWeeklyOnchainBossLease(first, { ...first }), true);
  assert.equal(sameWeeklyOnchainBossLease(first, { ...first, sessionEpoch: 2 }), false);
  assert.equal(sameWeeklyOnchainBossLease(first, {
    ownerUserId: 'did:privy:training-b',
    sessionEpoch: 1,
  }), false);
  assert.equal(sameWeeklyOnchainBossLease(null, null), false);
});

test('the pure raid engine rejects unknown choices and skipped acts', () => {
  const initial = createWeeklyOnchainBossSession();
  const skipped = advanceWeeklyOnchainBossAct(initial);
  const invalid = answerWeeklyOnchainBossAct(initial, 'not-a-choice');

  assert.equal(skipped.advanced, false);
  assert.equal(skipped.reason, 'act_incomplete');
  assert.equal(invalid.accepted, false);
  assert.equal(invalid.reason, 'choice_invalid');
  assert.deepEqual(skipped.session, initial);
  assert.deepEqual(invalid.session, initial);
});

test('a duplicate tap cannot score or damage the boss twice', () => {
  const initial = createWeeklyOnchainBossSession();
  const first = answerWeeklyOnchainBossAct(
    initial,
    correctChoice(WEEKLY_ONCHAIN_BOSS_W0.acts[0]).id,
  );
  const duplicate = answerWeeklyOnchainBossAct(
    first.session,
    correctChoice(WEEKLY_ONCHAIN_BOSS_W0.acts[0]).id,
  );

  assert.equal(first.accepted, true);
  assert.equal(first.session.score, 100);
  assert.equal(first.session.bossHealth, 75);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, 'already_answered');
  assert.equal(duplicate.session.score, 100);
  assert.equal(duplicate.session.bossHealth, 75);
  assert.equal(duplicate.session.answers.length, 1);
});

test('forged score, shields, health, combo, and answer facts are re-derived', () => {
  const inflated = {
    ...createWeeklyOnchainBossSession(),
    bossHealth: 0,
    combo: 999,
    score: 999999,
    shields: 99,
  };
  const first = answerWeeklyOnchainBossAct(
    inflated,
    correctChoice(WEEKLY_ONCHAIN_BOSS_W0.acts[0]).id,
  );

  assert.equal(first.accepted, true);
  assert.equal(first.session.bossHealth, 75);
  assert.equal(first.session.combo, 1);
  assert.equal(first.session.score, 100);
  assert.equal(first.session.shields, 3);

  const forgedHistory = {
    ...inflated,
    answers: [{
      actId: 'unknown-act',
      choiceId: 'base-public-only',
      correct: true,
      points: 999999,
    }],
  };
  assert.equal(advanceWeeklyOnchainBossAct(forgedHistory).advanced, false);
});

test('wrong answers remove a training shield without blocking progression', () => {
  const act = WEEKLY_ONCHAIN_BOSS_W0.acts[0];
  const wrongChoice = act.choices.find((choice) => !choice.correct);
  const answered = answerWeeklyOnchainBossAct(createWeeklyOnchainBossSession(), wrongChoice.id);

  assert.equal(answered.accepted, true);
  assert.equal(answered.answer.correct, false);
  assert.equal(answered.answer.points, 0);
  assert.equal(answered.session.bossHealth, 100);
  assert.equal(answered.session.score, 0);
  assert.equal(answered.session.shields, 2);
  assert.equal(advanceWeeklyOnchainBossAct(answered.session).advanced, true);
});

test('a perfect four-act raid deterministically clears at 550 points', () => {
  let session = createWeeklyOnchainBossSession();

  for (const [index, act] of WEEKLY_ONCHAIN_BOSS_W0.acts.entries()) {
    const answered = answerWeeklyOnchainBossAct(session, correctChoice(act).id);
    assert.equal(answered.accepted, true);
    const advanced = advanceWeeklyOnchainBossAct(answered.session);
    assert.equal(advanced.advanced, true);
    session = advanced.session;
    assert.equal(
      session.status,
      index === WEEKLY_ONCHAIN_BOSS_W0.acts.length - 1 ? 'complete' : 'playing',
    );
  }

  assert.equal(session.score, 550);
  assert.equal(session.bossHealth, 0);
  assert.equal(session.shields, 3);
  assert.deepEqual(summarizeWeeklyOnchainBossSession(session), {
    actCount: 4,
    bossHealth: 0,
    cleared: true,
    correctCount: 4,
    score: 550,
    shields: 3,
  });

  const afterComplete = answerWeeklyOnchainBossAct(
    session,
    correctChoice(WEEKLY_ONCHAIN_BOSS_W0.acts.at(-1)).id,
  );
  assert.equal(afterComplete.accepted, false);
  assert.equal(afterComplete.reason, 'session_invalid');
});

test('completion with a missed signal is review, never a false clear', () => {
  let session = createWeeklyOnchainBossSession();
  for (const act of WEEKLY_ONCHAIN_BOSS_W0.acts) {
    const choice = act.id === 'scam-ambush'
      ? act.choices.find((candidate) => !candidate.correct)
      : correctChoice(act);
    session = advanceWeeklyOnchainBossAct(
      answerWeeklyOnchainBossAct(session, choice.id).session,
    ).session;
  }

  const summary = summarizeWeeklyOnchainBossSession(session);
  assert.equal(summary.cleared, false);
  assert.equal(summary.correctCount, 3);
  assert.equal(summary.bossHealth, 25);
  assert.equal(summary.shields, 2);
});

test('invalid summaries cannot display forged progress or rewards', () => {
  const initial = createWeeklyOnchainBossSession();
  assert.deepEqual(summarizeWeeklyOnchainBossSession(null), {
    actCount: 4,
    bossHealth: 100,
    cleared: false,
    correctCount: 0,
    score: 0,
    shields: 3,
  });

  const forged = {
    ...initial,
    actIndex: 3,
    answers: [{ actId: 'unknown', choiceId: 'unknown' }],
    bossHealth: 0,
    score: 999999,
    status: 'complete',
  };
  assert.deepEqual(summarizeWeeklyOnchainBossSession(forged), {
    actCount: 4,
    bossHealth: 100,
    cleared: false,
    correctCount: 0,
    score: 0,
    shields: 3,
  });
});

test('W0 contains no execution, wallet, network, persistence, or external navigation capability', () => {
  const files = [
    source('../screens/WeeklyOnchainBoss.js'),
    source('../data/weeklyOnchainBoss.mjs'),
    source('../utils/weeklyOnchainBossEngine.mjs'),
  ];
  const combined = files.join('\n');
  const imports = files.flatMap((contents) => (
    [...contents.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
  ));

  for (const specifier of imports) {
    assert.doesNotMatch(
      specifier,
      /privy|viem|ethers|squid|orange|utils\/api|async-storage|secure-store|clipboard|linking|webview/i,
    );
  }
  assert.doesNotMatch(
    combined,
    /fetch\s*\(|axios|XMLHttpRequest|getAccessToken|signMessage|signTypedData|sendTransaction|sendRawTransaction|writeContract|deployContract|executeSquidRoute|wallet_sendCalls|eth_sendTransaction|personal_sign/,
  );
  assert.doesNotMatch(
    combined,
    /AsyncStorage|SecureStore|FileSystem|Clipboard|Linking|WebView|TextInput|\/swap\/|\/orange\//,
  );
  assert.deepEqual(findForbiddenAppStoreMarkers(combined), []);
});

test('the screen invalidates a live raid on background and account lease change', () => {
  const screen = source('../screens/WeeklyOnchainBoss.js');

  assert.match(screen, /AppState\.addEventListener\('change'/);
  assert.match(screen, /shouldInvalidateWeeklyOnchainBossForAppState\(previousState, nextState\)/);
  assert.match(screen, /subscription\.remove\(\)/);
  assert.match(screen, /useDeviceAccountOperationLease/);
  assert.match(screen, /sameWeeklyOnchainBossLease\(previousLease, lease\)/);
  assert.match(screen, /setSession\(null\)/);
  assert.match(screen, /setNotice\(message\)/);
});

test('W0 is registered and linked only behind its closed authenticated hub gate', () => {
  const navigation = source('../navigation/AppNavigator.js');
  const practice = source('../screens/DailyRunPracticeMissions.js');
  const dailyRun = source('../screens/DailyRun.js');
  const login = source('../screens/Login.js');
  const tabs = source('../navigation/BottomTabsNavigator.js');

  assert.match(navigation, /WEEKLY_ONCHAIN_BOSS_W0_ENABLED \? \([\s\S]*?name="WeeklyOnchainBoss"/);
  assert.match(practice, /WEEKLY_ONCHAIN_BOSS_W0_ENABLED \? \([\s\S]*?Weekly Onchain Boss/);
  assert.match(practice, /navigation\?\.navigate\('WeeklyOnchainBoss'\)/);
  assert.doesNotMatch(dailyRun, /WeeklyOnchainBoss/);
  assert.doesNotMatch(login, /WeeklyOnchainBoss|Weekly Onchain Boss/);
  assert.doesNotMatch(tabs, /WeeklyOnchainBoss|Weekly Onchain Boss/);
});

test('W0 creates no device-account persistence slot', () => {
  const store = source('../utils/deviceAccountDataStore.mjs');
  assert.doesNotMatch(store, /weekly|boss|raid/i);
});

test('the screen permanently labels its offline safety and non-reward boundary', () => {
  const screen = source('../screens/WeeklyOnchainBoss.js');

  assert.match(screen, /CURATED OFFLINE RAID/);
  assert.match(screen, /고정 훈련 데이터/);
  assert.match(screen, /NOT LIVE MARKET DATA/);
  assert.match(screen, /실제 견적 아님 · 서명·전송·자산 이동 없음/);
  assert.match(screen, /저장되거나 지급되지 않습니다/);
  assert.match(screen, /배지·Orange·자산으로 저장되거나 지급되지 않습니다/);
  assert.doesNotMatch(screen, /name=\{choice\.correct/);
});
