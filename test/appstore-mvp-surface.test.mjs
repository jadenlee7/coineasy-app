import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('the App Store MVP login surface exposes only working OAuth choices', () => {
  const login = source('../screens/Login.js');

  assert.match(login, /Sign up with Apple/);
  assert.match(login, /Sign up with Google/);
  assert.doesNotMatch(login, /Passkey · 준비 중|Sign up with Wallet|Wallet 로그인 준비 중/);
});

test('the App Store MVP has no reachable Squid preview route', () => {
  const navigation = source('../navigation/AppNavigator.js');
  const dailyRun = source('../screens/DailyRun.js');
  const practiceMissions = source('../screens/DailyRunPracticeMissions.js');
  const practiceData = source('../data/practiceMissions.mjs');
  const weeklyBoss = source('../screens/WeeklyOnchainBoss.js');
  const weeklyBossData = source('../data/weeklyOnchainBoss.mjs');
  const weeklyBossEngine = source('../utils/weeklyOnchainBossEngine.mjs');
  const curriculum = source('../data/dailyRunCurriculum.mjs');
  const trophies = source('../screens/Navigation/Trophies/TrophieCoineasy.js');

  assert.doesNotMatch(navigation, /SquidQuotePreview/);
  assert.doesNotMatch(dailyRun, /SquidQuotePreview|quote-preview/);
  assert.doesNotMatch(practiceMissions, /SquidQuotePreview|quote-preview|\/swap\/quote/);
  assert.doesNotMatch(practiceData, /SquidQuotePreview|quote-preview|\/swap\/quote/);
  assert.doesNotMatch(weeklyBoss, /SquidQuotePreview|quote-preview|\/swap\/quote/);
  assert.doesNotMatch(weeklyBossData, /SquidQuotePreview|quote-preview|\/swap\/quote/);
  assert.doesNotMatch(weeklyBossEngine, /SquidQuotePreview|quote-preview|\/swap\/quote/);
  assert.match(practiceMissions, /NOT LIVE MARKET DATA/);
  assert.match(weeklyBoss, /NOT LIVE MARKET DATA/);
  assert.match(weeklyBossData, /WEEKLY_ONCHAIN_BOSS_W0_ENABLED = false/);
  assert.match(curriculum, /실시간 견적을 조회하지 않는 고정 오프라인 선택형 학습/);
  assert.match(curriculum, /실시간 견적 조회나 거래 실행 없이, 고정된 보기/);
  assert.doesNotMatch(curriculum, /kind: 'quote-preview'|Base Route Estimate Lab|견적 미리보기|견적 읽기 연습실/);
  assert.doesNotMatch(trophies, /SquidQuotePreview|Base Route Estimate Lab/);
});

test('the App Store MVP documentation scopes wallet primitives accurately', () => {
  const wiring = source('../docs/FRONTEND_WIRING.md');

  assert.match(wiring, /EasyGo-owned Squid signer\/broadcast\s+invocation code/);
  assert.match(wiring, /Generic wallet primitives may still be bundled by the\s+embedded-wallet SDK/);
  assert.match(wiring, /no EasyGo UI or API client invokes them for a Squid\s+quote, transaction broadcast, or reward log/);
});

test('social posting is not an Orange claim surface in the App Store MVP', () => {
  const rewards = source('../screens/Navigation/Oranges/OrangeReward.js');
  const navigation = source('../screens/Navigation/OrangeNavigation.js');
  const api = source('../utils/api.js');

  assert.doesNotMatch(rewards, /Daily Participation|todayActivities|handleClaimDailyActivity/);
  assert.doesNotMatch(navigation, /orangeClaimDailyActivity|handleClaimDailyActivity|todayActivities/);
  assert.doesNotMatch(api, /orangeClaimDailyActivity|\/orange\/claims\/daily-activity/);
  assert.match(rewards, /Daily Check-in/);
});
