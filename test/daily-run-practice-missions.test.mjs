import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PRACTICE_MISSIONS } from '../data/practiceMissions.mjs';
import {
  advancePracticeRound,
  answerPracticeRound,
  createPracticeMissionSession,
  summarizePracticeSession,
} from '../utils/dailyRunPracticeEngine.mjs';
import { findForbiddenAppStoreMarkers } from '../scripts/check-appstore-bundle.mjs';

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function correctChoice(round) {
  return round.choices.find((choice) => choice.correct);
}

test('Practice Arcade exposes exactly three distinct three-round missions', () => {
  assert.deepEqual(
    PRACTICE_MISSIONS.map((mission) => mission.id),
    ['receipt-detective', 'scam-shield-duel', 'live-quote-boss'],
  );

  const missionIds = new Set();
  const roundIds = new Set();
  for (const mission of PRACTICE_MISSIONS) {
    assert.equal(mission.rounds.length, 3);
    assert.equal(missionIds.has(mission.id), false);
    missionIds.add(mission.id);

    for (const round of mission.rounds) {
      assert.equal(roundIds.has(round.id), false);
      roundIds.add(round.id);
      assert.equal(round.choices.filter((choice) => choice.correct).length, 1);
      assert.equal(new Set(round.choices.map((choice) => choice.id)).size, round.choices.length);
      assert.ok(round.success.length > 0);
      assert.ok(round.retry.length > 0);
    }
  }
});

test('the pure session engine rejects unknown choices and out-of-order advance', () => {
  assert.equal(createPracticeMissionSession('unknown'), null);

  const initial = createPracticeMissionSession('receipt-detective');
  const skipped = advancePracticeRound(initial);
  const invalid = answerPracticeRound(initial, 'not-a-choice');

  assert.equal(skipped.advanced, false);
  assert.equal(skipped.reason, 'round_incomplete');
  assert.equal(invalid.accepted, false);
  assert.equal(invalid.reason, 'choice_invalid');
  assert.deepEqual(skipped.session, initial);
  assert.deepEqual(invalid.session, initial);
});

test('a fast duplicate tap cannot score the same round twice', () => {
  const mission = PRACTICE_MISSIONS[0];
  const initial = createPracticeMissionSession(mission.id);
  const first = answerPracticeRound(initial, correctChoice(mission.rounds[0]).id);
  const duplicate = answerPracticeRound(first.session, correctChoice(mission.rounds[0]).id);

  assert.equal(first.accepted, true);
  assert.equal(first.session.score, 100);
  assert.equal(first.session.combo, 1);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, 'already_answered');
  assert.equal(duplicate.session.score, 100);
  assert.equal(duplicate.session.answers.length, 1);
});

test('forged score, combo, correctness, and choice history are re-derived or rejected', () => {
  const mission = PRACTICE_MISSIONS[1];
  const inflated = {
    ...createPracticeMissionSession(mission.id),
    combo: 999,
    hearts: 99,
    score: 999999,
  };
  const first = answerPracticeRound(inflated, correctChoice(mission.rounds[0]).id);
  assert.equal(first.accepted, true);
  assert.equal(first.session.combo, 1);
  assert.equal(first.session.hearts, 3);
  assert.equal(first.session.score, 100);

  const invalidAdvance = advancePracticeRound({
    ...inflated,
    answers: [{ choiceId: 'not-a-choice', correct: true, roundId: mission.rounds[0].id }],
  });
  assert.equal(invalidAdvance.advanced, false);

  const forgedAnswers = mission.rounds.map((round) => ({
    choiceId: round.choices.find((choice) => !choice.correct).id,
    correct: true,
    points: 999999,
    roundId: round.id,
  }));
  assert.deepEqual(summarizePracticeSession({
    answers: forgedAnswers,
    missionId: mission.id,
    roundIndex: 2,
    score: 999999,
    status: 'complete',
  }), {
    correctCount: 0,
    roundCount: 3,
    score: 0,
    stars: 1,
  });
});

test('wrong answers reset combo without blocking the next round', () => {
  const mission = PRACTICE_MISSIONS[1];
  let session = createPracticeMissionSession(mission.id);

  const first = answerPracticeRound(session, correctChoice(mission.rounds[0]).id);
  session = advancePracticeRound(first.session).session;
  const wrongChoice = mission.rounds[1].choices.find((choice) => !choice.correct);
  const wrong = answerPracticeRound(session, wrongChoice.id);

  assert.equal(wrong.accepted, true);
  assert.equal(wrong.answer.correct, false);
  assert.equal(wrong.answer.points, 0);
  assert.equal(wrong.session.score, 100);
  assert.equal(wrong.session.combo, 0);
  assert.equal(wrong.session.hearts, 2);
  assert.equal(advancePracticeRound(wrong.session).advanced, true);
});

test('a perfect mission deterministically earns combo points and three stars', () => {
  const mission = PRACTICE_MISSIONS[2];
  let session = createPracticeMissionSession(mission.id);

  for (const [index, round] of mission.rounds.entries()) {
    const answered = answerPracticeRound(session, correctChoice(round).id);
    assert.equal(answered.accepted, true);
    const advanced = advancePracticeRound(answered.session);
    assert.equal(advanced.advanced, true);
    session = advanced.session;
    assert.equal(session.status, index === mission.rounds.length - 1 ? 'complete' : 'playing');
  }

  assert.equal(session.score, 375);
  assert.equal(session.answers.length, 3);
  assert.deepEqual(summarizePracticeSession(session), {
    correctCount: 3,
    roundCount: 3,
    score: 375,
    stars: 3,
  });

  const afterComplete = answerPracticeRound(session, correctChoice(mission.rounds[2]).id);
  assert.equal(afterComplete.accepted, false);
  assert.equal(afterComplete.reason, 'session_invalid');
});

test('incomplete and invalid sessions earn zero stars', () => {
  const initial = createPracticeMissionSession('scam-shield-duel');
  assert.equal(summarizePracticeSession(initial).stars, 0);
  assert.deepEqual(summarizePracticeSession(null), {
    correctCount: 0,
    roundCount: 0,
    score: 0,
    stars: 0,
  });
  assert.deepEqual(
    createPracticeMissionSession('scam-shield-duel'),
    createPracticeMissionSession('scam-shield-duel'),
  );

  const forged = {
    ...initial,
    answers: [{ correct: true, points: 999999, roundId: 'unknown-round' }],
    score: 999999,
    status: 'complete',
  };
  assert.deepEqual(summarizePracticeSession(forged), {
    correctCount: 0,
    roundCount: 3,
    score: 0,
    stars: 0,
  });
});

test('receipt and quote fields map to explicit choices and quote data is clearly simulated', () => {
  const receipt = PRACTICE_MISSIONS.find((mission) => mission.id === 'receipt-detective');
  const quote = PRACTICE_MISSIONS.find((mission) => mission.id === 'live-quote-boss');

  for (const round of receipt.rounds) {
    assert.deepEqual(
      new Set(round.receipt.map((field) => field.id)),
      new Set(round.choices.map((choice) => choice.id)),
    );
  }
  for (const round of quote.rounds) {
    assert.ok(Number.isSafeInteger(round.timerSeconds) && round.timerSeconds >= 0);
    assert.deepEqual(
      new Set(round.quote.map((field) => field.id)),
      new Set(round.choices.map((choice) => choice.id)),
    );
  }

  const screen = source('../screens/DailyRunPracticeMissions.js');
  assert.match(screen, /PRACTICE SNAPSHOT/);
  assert.match(screen, /NOT LIVE MARKET DATA/);
  assert.match(screen, /고정 연습 데이터 · 실제 가격\/견적 아님 · 서명·전송·자산 이동 없음/);
  assert.match(screen, /BONUS TIMER · 견적 만료와 무관 · 점수 영향 없음/);
  assert.match(screen, /100 - \(correctHits \* 34\)/);
});

test('Practice Arcade has no wallet, execution, network, persistence, or external-action capability', () => {
  const combined = [
    source('../screens/DailyRunPracticeMissions.js'),
    source('../data/practiceMissions.mjs'),
    source('../utils/dailyRunPracticeEngine.mjs'),
  ].join('\n');

  assert.doesNotMatch(
    combined,
    /signMessage|signTypedData|sendTransaction|writeContract|deployContract|executeSquidRoute|eth_sendTransaction|personal_sign|wallet_sendCalls/,
  );
  assert.doesNotMatch(
    combined,
    /fetch\s*\(|axios|utils\/api|\/swap\/quote|\/swap\/log|\/orange\/|getProvider|@privy-io/,
  );
  assert.doesNotMatch(
    combined,
    /Linking|WebView|TextInput|Clipboard|AsyncStorage|SecureStore|saveDailyRunProgress|completeDailyRun/,
  );
  assert.deepEqual(findForbiddenAppStoreMarkers(combined), []);
  assert.doesNotMatch(combined, /Weekly Onchain Boss/);
});

test('the authenticated completion screen is the only Practice Arcade entry point', () => {
  const navigation = source('../navigation/AppNavigator.js');
  const dailyRun = source('../screens/DailyRun.js');

  assert.match(navigation, /DailyRunPracticeMissions/);
  assert.match(dailyRun, /!guestMode && \([\s\S]*?Practice Arcade · 3개 미션/);
  assert.match(dailyRun, /navigation\?\.navigate\('DailyRunPracticeMissions'\)/);
  assert.doesNotMatch(dailyRun, /guestMode \? ['"]Practice Arcade/);
});
