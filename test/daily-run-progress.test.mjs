import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { DAILY_RUN_CURRICULUM } from '../data/dailyRunCurriculum.mjs';
import {
  completeDailyRun,
  createEmptyDailyRunProgress,
  dailyRunDateKey,
  getDailyRunState,
  hasDailyRunDateChanged,
  normalizeDailyRunProgress,
} from '../utils/dailyRunProgress.mjs';

test('the beginner curriculum is a fixed seven-day Meme Learn Do loop', () => {
  assert.equal(DAILY_RUN_CURRICULUM.length, 7);
  assert.deepEqual(
    DAILY_RUN_CURRICULUM.map((lesson) => lesson.day),
    [1, 2, 3, 4, 5, 6, 7],
  );
  for (const lesson of DAILY_RUN_CURRICULUM) {
    assert.ok(lesson.meme.length > 0);
    assert.ok(lesson.learn.length > 0);
    assert.ok(lesson.quiz.options.some((option) => option.correct));
    assert.ok(lesson.action.kind);
    assert.ok(Number.isSafeInteger(lesson.xp) && lesson.xp > 0);
  }
});

test('a first completion records XP and opens the next lesson on the next day', () => {
  const first = completeDailyRun({
    value: createEmptyDailyRunProgress(),
    dayId: 'day-1-wallet',
    dateKey: '2026-08-25',
    completedAt: '2026-08-25T10:00:00.000Z',
  });

  assert.equal(first.recorded, true);
  assert.equal(first.progress.totalXp, 20);
  assert.equal(first.progress.streak, 1);
  assert.equal(
    getDailyRunState(first.progress, '2026-08-25').status,
    'complete-today',
  );
  const restored = JSON.parse(JSON.stringify(first.progress));
  const restoredToday = getDailyRunState(restored, '2026-08-25');
  assert.equal(restoredToday.status, 'complete-today');
  assert.equal(restoredToday.progress.totalXp, 20);
  assert.equal(restoredToday.progress.streak, 1);

  const tomorrow = getDailyRunState(first.progress, '2026-08-26');
  assert.equal(tomorrow.status, 'available');
  assert.equal(tomorrow.lesson.id, 'day-2-explorer');
});

test('completion is idempotent and only one new lesson can complete per date', () => {
  const first = completeDailyRun({
    value: null,
    dayId: 'day-1-wallet',
    dateKey: '2026-08-25',
  });
  const duplicate = completeDailyRun({
    value: first.progress,
    dayId: 'day-1-wallet',
    dateKey: '2026-08-25',
  });
  const secondSameDay = completeDailyRun({
    value: first.progress,
    dayId: 'day-2-explorer',
    dateKey: '2026-08-25',
  });

  assert.equal(duplicate.recorded, false);
  assert.equal(duplicate.reason, 'already_completed');
  assert.equal(duplicate.progress.totalXp, 20);
  assert.equal(secondSameDay.recorded, false);
  assert.equal(secondSameDay.reason, 'daily_limit');
  assert.equal(secondSameDay.progress.totalXp, 20);
});

test('lessons cannot be completed out of order', () => {
  const result = completeDailyRun({
    value: null,
    dayId: 'day-3-scam',
    dateKey: '2026-08-25',
  });

  assert.equal(result.recorded, false);
  assert.equal(result.reason, 'lesson_locked');
  assert.equal(result.progress.totalXp, 0);
});

test('moving the device calendar behind recorded history cannot open a lesson', () => {
  const first = completeDailyRun({
    value: null,
    dayId: 'day-1-wallet',
    dateKey: '2026-08-25',
  });
  const rollback = completeDailyRun({
    value: first.progress,
    dayId: 'day-2-explorer',
    dateKey: '2026-08-24',
  });

  assert.equal(rollback.recorded, false);
  assert.equal(rollback.reason, 'clock_before_history');
  assert.equal(rollback.progress.totalXp, 20);
});

test('consecutive dates grow the streak and missed dates reset it', () => {
  const dayOne = completeDailyRun({
    value: null,
    dayId: 'day-1-wallet',
    dateKey: '2026-08-20',
  });
  const dayTwo = completeDailyRun({
    value: dayOne.progress,
    dayId: 'day-2-explorer',
    dateKey: '2026-08-21',
  });
  const dayThree = completeDailyRun({
    value: dayTwo.progress,
    dayId: 'day-3-scam',
    dateKey: '2026-08-24',
  });

  assert.equal(dayTwo.progress.streak, 2);
  assert.equal(dayThree.progress.streak, 1);
});

test('normalization ignores unknown completions and derives XP from known lessons', () => {
  const normalized = normalizeDailyRunProgress({
    completions: {
      'day-1-wallet': { completedOn: '2026-08-20', completedAt: 'now', xp: 999999 },
      'unknown-reward': { completedOn: '2026-08-21', xp: 999999 },
    },
    lastCompletedDate: '2099-01-01',
    streak: 999,
    totalXp: 999999,
  });

  assert.deepEqual(Object.keys(normalized.completions), ['day-1-wallet']);
  assert.equal(normalized.totalXp, 20);
  assert.equal(normalized.lastCompletedDate, '2026-08-20');
  assert.equal(normalized.streak, 1);
});

test('normalization derives the consecutive streak from known completion dates', () => {
  const normalized = normalizeDailyRunProgress({
    completions: {
      'day-1-wallet': { completedOn: '2026-08-20' },
      'day-2-explorer': { completedOn: '2026-08-21' },
      'day-3-scam': { completedOn: '2026-08-24' },
      'day-4-gas': { completedOn: '2026-08-25' },
    },
    streak: 999,
  });

  assert.equal(normalized.streak, 2);
  assert.equal(normalized.lastCompletedDate, '2026-08-25');
});

test('Daily Run never imports a transaction or Orange claim client', () => {
  const source = readFileSync(
    new URL('../screens/DailyRun.js', import.meta.url),
    'utf8',
  );
  const appSource = readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  const packageJson = JSON.parse(readFileSync(
    new URL('../package.json', import.meta.url),
    'utf8',
  ));
  const packageLock = JSON.parse(readFileSync(
    new URL('../package-lock.json', import.meta.url),
    'utf8',
  ));

  assert.doesNotMatch(source, /orangeClaim|swapQuote|sendTransaction|executeSquidRoute/);
  assert.doesNotMatch(source, /react-native-confetti-cannon|ConfettiCannon/);
  assert.doesNotMatch(appSource, /react-native-confetti-cannon|ConfettiCannon/);
  assert.equal(packageJson.dependencies['react-native-confetti-cannon'], undefined);
  assert.equal(packageLock.packages['node_modules/react-native-confetti-cannon'], undefined);
  assert.match(source, /function RewardCelebration/);
  assert.match(source, /맛보기는 XP나 Orange를 지급하거나 저장하지 않습니다/);
  assert.match(source, /lesson\.day === 7/);
  assert.match(source, /학습 카드 공유 · 선택/);
});

test('date keys use the device calendar date and reject invalid values', () => {
  const date = new Date(2026, 7, 25, 23, 59, 0);
  assert.equal(dailyRunDateKey(date), '2026-08-25');
  assert.equal(dailyRunDateKey('not-a-date'), null);
});

test('an open Run detects a local midnight boundary before completion', () => {
  assert.equal(hasDailyRunDateChanged('2026-08-25', '2026-08-25'), false);
  assert.equal(hasDailyRunDateChanged('2026-08-25', '2026-08-26'), true);
  assert.equal(hasDailyRunDateChanged(null, '2026-08-26'), false);

  const screenSource = readFileSync(
    new URL('../screens/DailyRun.js', import.meta.url),
    'utf8',
  );
  const cardSource = readFileSync(
    new URL('../components/DailyRunHomeCard.js', import.meta.url),
    'utf8',
  );
  assert.match(screenSource, /const \[dateKey, setDateKey\] = useState/);
  assert.match(
    screenSource,
    /if \(refreshCalendarDate\(\)\)[\s\S]*?const result = completeDailyRun/,
  );
  assert.match(screenSource, /AppState\.addEventListener\('change'/);
  assert.match(cardSource, /useFocusEffect[\s\S]*?setDateKey\(dailyRunDateKey\(\)\)/);
  assert.match(cardSource, /AppState\.addEventListener\('change'/);
});

test('Daily Run storage is account-bound and purged with the owner namespace', () => {
  const storeSource = readFileSync(
    new URL('../utils/deviceAccountDataStore.mjs', import.meta.url),
    'utf8',
  );
  const contextSource = readFileSync(
    new URL('../contexts/DeviceAccountDataContext.js', import.meta.url),
    'utf8',
  );

  assert.match(storeSource, /dailyRunProgress:\s*'daily-run-progress'/);
  assert.match(contextSource, /saveDailyRunProgress:[\s\S]*?expectedLease:\s*lease/);
  assert.match(contextSource, /dailyRunProgress:\s*visibleSnapshot\.data\.dailyRunProgress/);
  assert.doesNotMatch(contextSource, /easygo_daily_run_progress/);
});
