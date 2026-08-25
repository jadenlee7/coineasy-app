import {
  DAILY_RUN_CURRICULUM,
  DAILY_RUN_CURRICULUM_VERSION,
} from '../data/dailyRunCurriculum.mjs';

function knownCompletionMap(value, curriculum) {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  const knownIds = new Set(curriculum.map((lesson) => lesson.id));
  return Object.fromEntries(Object.entries(source).filter(([dayId, completion]) => (
    knownIds.has(dayId)
    && completion
    && typeof completion === 'object'
    && typeof completion.completedOn === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(completion.completedOn)
  )));
}

export function dailyRunDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hasDailyRunDateChanged(
  openedDateKey,
  currentDateKey = dailyRunDateKey(),
) {
  return Boolean(
    openedDateKey
    && currentDateKey
    && openedDateKey !== currentDateKey
  );
}

export function createEmptyDailyRunProgress() {
  return Object.freeze({
    version: DAILY_RUN_CURRICULUM_VERSION,
    completions: Object.freeze({}),
    lastCompletedDate: null,
    streak: 0,
    totalXp: 0,
  });
}

export function normalizeDailyRunProgress(
  value,
  curriculum = DAILY_RUN_CURRICULUM,
) {
  const completions = knownCompletionMap(value?.completions, curriculum);
  const completedXp = curriculum.reduce((total, lesson) => (
    completions[lesson.id] ? total + lesson.xp : total
  ), 0);
  const completionDates = Object.values(completions)
    .map((completion) => completion.completedOn)
    .sort();
  const lastCompletedDate = completionDates.at(-1) || null;

  return Object.freeze({
    version: DAILY_RUN_CURRICULUM_VERSION,
    completions: Object.freeze(completions),
    lastCompletedDate,
    // Streak is display-only today, but still derive it rather than trusting a
    // persisted counter so future rewards cannot inherit tampered state.
    streak: consecutiveStreak(completionDates),
    // Derive XP from known one-time completions instead of trusting stored totals.
    totalXp: completedXp,
  });
}

function dayDistance(previousKey, nextKey) {
  if (!previousKey || !nextKey) return null;
  const previous = Date.parse(`${previousKey}T12:00:00Z`);
  const next = Date.parse(`${nextKey}T12:00:00Z`);
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return null;
  return Math.round((next - previous) / 86_400_000);
}

function consecutiveStreak(completionDates) {
  const dates = [...new Set(completionDates)].sort();
  if (dates.length === 0) return 0;
  let streak = 1;
  for (let index = dates.length - 1; index > 0; index -= 1) {
    if (dayDistance(dates[index - 1], dates[index]) !== 1) break;
    streak += 1;
  }
  return streak;
}

export function getDailyRunState(
  value,
  dateKey = dailyRunDateKey(),
  curriculum = DAILY_RUN_CURRICULUM,
) {
  const progress = normalizeDailyRunProgress(value, curriculum);
  const completedCount = curriculum.filter(
    (lesson) => Boolean(progress.completions[lesson.id]),
  ).length;
  const completedToday = curriculum.find(
    (lesson) => progress.completions[lesson.id]?.completedOn === dateKey,
  ) || null;

  if (completedToday) {
    return Object.freeze({
      status: 'complete-today',
      lesson: completedToday,
      progress,
      completedCount,
      totalCount: curriculum.length,
    });
  }

  const nextLesson = curriculum.find(
    (lesson) => !progress.completions[lesson.id],
  ) || null;

  return Object.freeze({
    status: nextLesson ? 'available' : 'journey-complete',
    lesson: nextLesson,
    progress,
    completedCount,
    totalCount: curriculum.length,
  });
}

export function completeDailyRun({
  value,
  dayId,
  dateKey = dailyRunDateKey(),
  completedAt = new Date().toISOString(),
  curriculum = DAILY_RUN_CURRICULUM,
} = {}) {
  const state = getDailyRunState(value, dateKey, curriculum);
  const lesson = curriculum.find((candidate) => candidate.id === dayId) || null;
  if (!lesson || !dateKey) {
    return Object.freeze({ recorded: false, reason: 'invalid_lesson', progress: state.progress });
  }
  if (state.progress.completions[dayId]) {
    return Object.freeze({ recorded: false, reason: 'already_completed', progress: state.progress });
  }
  if (state.status === 'complete-today') {
    return Object.freeze({ recorded: false, reason: 'daily_limit', progress: state.progress });
  }
  const distance = dayDistance(state.progress.lastCompletedDate, dateKey);
  if (distance !== null && distance < 0) {
    return Object.freeze({
      recorded: false,
      reason: 'clock_before_history',
      progress: state.progress,
    });
  }
  if (state.status !== 'available' || state.lesson?.id !== dayId) {
    return Object.freeze({ recorded: false, reason: 'lesson_locked', progress: state.progress });
  }

  const streak = distance === 1 ? state.progress.streak + 1 : 1;
  const completions = Object.freeze({
    ...state.progress.completions,
    [dayId]: Object.freeze({
      completedAt,
      completedOn: dateKey,
      xp: lesson.xp,
    }),
  });
  const progress = Object.freeze({
    version: DAILY_RUN_CURRICULUM_VERSION,
    completions,
    lastCompletedDate: dateKey,
    streak,
    totalXp: state.progress.totalXp + lesson.xp,
  });

  return Object.freeze({ recorded: true, reason: 'completed', progress });
}
