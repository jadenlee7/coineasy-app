import { getPracticeMission } from '../data/practiceMissions.mjs';

function frozenSession(value) {
  return Object.freeze({
    ...value,
    answers: Object.freeze([...(value.answers || [])]),
  });
}

function deriveCanonicalHistory(mission, answers, expectedCount) {
  if (!mission || !Array.isArray(answers) || answers.length !== expectedCount) return null;

  let combo = 0;
  let hearts = 3;
  let score = 0;
  const canonicalAnswers = [];

  for (let index = 0; index < expectedCount; index += 1) {
    const round = mission.rounds[index];
    const candidate = answers[index];
    if (!round || candidate?.roundId !== round.id) return null;

    const choice = round.choices.find((option) => option.id === candidate.choiceId) || null;
    if (!choice) return null;

    const correct = Boolean(choice.correct);
    const points = correct ? 100 + (combo * 25) : 0;
    combo = correct ? combo + 1 : 0;
    if (!correct) hearts = Math.max(0, hearts - 1);
    score += points;
    canonicalAnswers.push(Object.freeze({
      choiceId: choice.id,
      correct,
      feedback: correct ? round.success : round.retry,
      points,
      roundId: round.id,
    }));
  }

  return Object.freeze({
    answers: Object.freeze(canonicalAnswers),
    combo,
    hearts,
    score,
  });
}

export function createPracticeMissionSession(missionId) {
  const mission = getPracticeMission(missionId);
  if (!mission) return null;

  return frozenSession({
    answers: [],
    combo: 0,
    hearts: 3,
    missionId,
    roundIndex: 0,
    score: 0,
    status: 'playing',
  });
}

export function answerPracticeRound(session, choiceId) {
  const mission = getPracticeMission(session?.missionId);
  const roundIndex = Number.isSafeInteger(session?.roundIndex) ? session.roundIndex : -1;
  const round = mission?.rounds[roundIndex] || null;

  if (!mission || !round || session.status !== 'playing' || !Array.isArray(session.answers)) {
    return Object.freeze({ accepted: false, reason: 'session_invalid', session });
  }

  if (session.answers.length === roundIndex + 1) {
    const answeredHistory = deriveCanonicalHistory(mission, session.answers, roundIndex + 1);
    if (!answeredHistory) {
      return Object.freeze({ accepted: false, reason: 'session_invalid', session });
    }
    return Object.freeze({
      accepted: false,
      reason: 'already_answered',
      session: frozenSession({
        ...answeredHistory,
        missionId: mission.id,
        roundIndex,
        status: 'playing',
      }),
    });
  }

  const history = deriveCanonicalHistory(mission, session.answers, roundIndex);
  if (!history) return Object.freeze({ accepted: false, reason: 'session_invalid', session });

  const choice = round.choices.find((candidate) => candidate.id === choiceId) || null;
  if (!choice) {
    return Object.freeze({ accepted: false, reason: 'choice_invalid', session });
  }

  const correct = Boolean(choice.correct);
  const combo = correct ? history.combo + 1 : 0;
  const points = correct ? 100 + (history.combo * 25) : 0;
  const answer = Object.freeze({
    choiceId,
    correct,
    feedback: correct ? round.success : round.retry,
    points,
    roundId: round.id,
  });
  const nextSession = frozenSession({
    answers: [...history.answers, answer],
    combo,
    hearts: correct ? history.hearts : Math.max(0, history.hearts - 1),
    missionId: mission.id,
    roundIndex,
    score: history.score + points,
    status: 'playing',
  });

  return Object.freeze({ accepted: true, answer, session: nextSession });
}

export function advancePracticeRound(session) {
  const mission = getPracticeMission(session?.missionId);
  const roundIndex = Number.isSafeInteger(session?.roundIndex) ? session.roundIndex : -1;
  const round = mission?.rounds[roundIndex] || null;
  const history = round && Array.isArray(session?.answers)
    ? deriveCanonicalHistory(mission, session.answers, roundIndex + 1)
    : null;

  if (!mission || !round || session.status !== 'playing' || !history) {
    return Object.freeze({ advanced: false, reason: 'round_incomplete', session });
  }

  const finalRound = roundIndex >= mission.rounds.length - 1;
  const nextSession = frozenSession({
    ...history,
    missionId: mission.id,
    roundIndex: finalRound ? roundIndex : roundIndex + 1,
    status: finalRound ? 'complete' : 'playing',
  });
  return Object.freeze({ advanced: true, session: nextSession });
}

export function summarizePracticeSession(session) {
  const mission = getPracticeMission(session?.missionId);
  if (!mission || !Array.isArray(session?.answers)) {
    return Object.freeze({ correctCount: 0, roundCount: 0, score: 0, stars: 0 });
  }

  const roundCount = mission.rounds.length;
  const answerCount = Math.min(session.answers.length, roundCount);
  const history = deriveCanonicalHistory(mission, session.answers, answerCount);
  if (!history || session.answers.length > roundCount) {
    return Object.freeze({ correctCount: 0, roundCount, score: 0, stars: 0 });
  }

  const correctCount = history.answers.filter((answer) => answer.correct).length;
  const ratio = roundCount > 0 ? correctCount / roundCount : 0;
  const complete = session.status === 'complete'
    && session.roundIndex === roundCount - 1
    && history.answers.length === roundCount;
  return Object.freeze({
    correctCount,
    roundCount,
    score: history.score,
    stars: !complete ? 0 : ratio === 1 ? 3 : ratio >= 2 / 3 ? 2 : 1,
  });
}
