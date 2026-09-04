import { WEEKLY_ONCHAIN_BOSS_W0 } from '../data/weeklyOnchainBoss.mjs';

export function shouldInvalidateWeeklyOnchainBossForAppState(_previousState, nextState) {
  return nextState !== 'active';
}

export function sameWeeklyOnchainBossLease(left, right) {
  return Boolean(
    left
    && right
    && typeof left.ownerUserId === 'string'
    && left.ownerUserId.length > 0
    && left.ownerUserId === right.ownerUserId
    && Number.isSafeInteger(left.sessionEpoch)
    && left.sessionEpoch > 0
    && left.sessionEpoch === right.sessionEpoch,
  );
}

function freezeSession(value) {
  return Object.freeze({
    ...value,
    answers: Object.freeze([...(value.answers || [])]),
  });
}

function deriveCanonicalHistory(answers, expectedCount) {
  const acts = WEEKLY_ONCHAIN_BOSS_W0.acts;
  if (!Array.isArray(answers) || answers.length !== expectedCount) return null;

  let combo = 0;
  let correctCount = 0;
  let score = 0;
  let shields = 3;
  const canonicalAnswers = [];

  for (let index = 0; index < expectedCount; index += 1) {
    const act = acts[index];
    const candidate = answers[index];
    if (!act || candidate?.actId !== act.id) return null;

    const choice = act.choices.find((option) => option.id === candidate.choiceId) || null;
    if (!choice) return null;

    const correct = Boolean(choice.correct);
    const points = correct ? 100 + (combo * 25) : 0;
    combo = correct ? combo + 1 : 0;
    if (correct) correctCount += 1;
    if (!correct) shields = Math.max(0, shields - 1);
    score += points;
    canonicalAnswers.push(Object.freeze({
      actId: act.id,
      choiceId: choice.id,
      correct,
      feedback: correct ? act.success : act.retry,
      points,
    }));
  }

  return Object.freeze({
    answers: Object.freeze(canonicalAnswers),
    bossHealth: Math.max(0, 100 - (correctCount * 25)),
    combo,
    correctCount,
    score,
    shields,
  });
}

export function createWeeklyOnchainBossSession() {
  return freezeSession({
    actIndex: 0,
    answers: [],
    bossHealth: 100,
    combo: 0,
    score: 0,
    shields: 3,
    status: 'playing',
  });
}

export function answerWeeklyOnchainBossAct(session, choiceId) {
  const actIndex = Number.isSafeInteger(session?.actIndex) ? session.actIndex : -1;
  const act = WEEKLY_ONCHAIN_BOSS_W0.acts[actIndex] || null;

  if (!act || session?.status !== 'playing' || !Array.isArray(session?.answers)) {
    return Object.freeze({ accepted: false, reason: 'session_invalid', session });
  }

  if (session.answers.length === actIndex + 1) {
    const answeredHistory = deriveCanonicalHistory(session.answers, actIndex + 1);
    if (!answeredHistory) {
      return Object.freeze({ accepted: false, reason: 'session_invalid', session });
    }
    return Object.freeze({
      accepted: false,
      reason: 'already_answered',
      session: freezeSession({
        ...answeredHistory,
        actIndex,
        status: 'playing',
      }),
    });
  }

  const history = deriveCanonicalHistory(session.answers, actIndex);
  if (!history) return Object.freeze({ accepted: false, reason: 'session_invalid', session });

  const choice = act.choices.find((candidate) => candidate.id === choiceId) || null;
  if (!choice) {
    return Object.freeze({ accepted: false, reason: 'choice_invalid', session });
  }

  const correct = Boolean(choice.correct);
  const points = correct ? 100 + (history.combo * 25) : 0;
  const correctCount = history.correctCount + (correct ? 1 : 0);
  const answer = Object.freeze({
    actId: act.id,
    choiceId: choice.id,
    correct,
    feedback: correct ? act.success : act.retry,
    points,
  });
  const nextSession = freezeSession({
    actIndex,
    answers: [...history.answers, answer],
    bossHealth: Math.max(0, 100 - (correctCount * 25)),
    combo: correct ? history.combo + 1 : 0,
    score: history.score + points,
    shields: correct ? history.shields : Math.max(0, history.shields - 1),
    status: 'playing',
  });

  return Object.freeze({ accepted: true, answer, session: nextSession });
}

export function advanceWeeklyOnchainBossAct(session) {
  const actIndex = Number.isSafeInteger(session?.actIndex) ? session.actIndex : -1;
  const act = WEEKLY_ONCHAIN_BOSS_W0.acts[actIndex] || null;
  const history = act && Array.isArray(session?.answers)
    ? deriveCanonicalHistory(session.answers, actIndex + 1)
    : null;

  if (!act || session?.status !== 'playing' || !history) {
    return Object.freeze({ advanced: false, reason: 'act_incomplete', session });
  }

  const finalAct = actIndex >= WEEKLY_ONCHAIN_BOSS_W0.acts.length - 1;
  return Object.freeze({
    advanced: true,
    session: freezeSession({
      ...history,
      actIndex: finalAct ? actIndex : actIndex + 1,
      status: finalAct ? 'complete' : 'playing',
    }),
  });
}

export function summarizeWeeklyOnchainBossSession(session) {
  const actCount = WEEKLY_ONCHAIN_BOSS_W0.acts.length;
  if (!Array.isArray(session?.answers)) {
    return Object.freeze({
      actCount,
      bossHealth: 100,
      cleared: false,
      correctCount: 0,
      score: 0,
      shields: 3,
    });
  }

  const answerCount = Math.min(session.answers.length, actCount);
  const history = deriveCanonicalHistory(session.answers, answerCount);
  if (!history || session.answers.length > actCount) {
    return Object.freeze({
      actCount,
      bossHealth: 100,
      cleared: false,
      correctCount: 0,
      score: 0,
      shields: 3,
    });
  }

  const complete = session.status === 'complete'
    && session.actIndex === actCount - 1
    && history.answers.length === actCount;
  return Object.freeze({
    actCount,
    bossHealth: history.bossHealth,
    cleared: complete && history.correctCount === actCount,
    correctCount: history.correctCount,
    score: history.score,
    shields: history.shields,
  });
}
