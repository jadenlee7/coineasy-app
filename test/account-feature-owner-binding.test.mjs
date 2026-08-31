import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { adaptEasyGoProfileResponse } from '../hooks/easyChainProfileAdapter.mjs';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

function assertGuardBeforeMutation(
  contents,
  callNeedle,
  mutationNeedle,
  guardNeedle = 'if (!isCurrentLease(expectedLease))',
) {
  const callIndex = contents.indexOf(callNeedle);
  const guardIndex = contents.indexOf(guardNeedle, callIndex);
  const mutationIndex = contents.indexOf(mutationNeedle, callIndex);
  assert.notEqual(callIndex, -1, `missing call: ${callNeedle}`);
  assert.notEqual(guardIndex, -1, `missing stale-lease guard after: ${callNeedle}`);
  assert.notEqual(mutationIndex, -1, `missing mutation after: ${callNeedle}`);
  assert.ok(guardIndex < mutationIndex, `${mutationNeedle} must follow the stale-lease guard`);
}

test('authenticated read hooks bind requests and visible state to the full session lease', () => {
  const orange = source('../hooks/useOrange.js');
  const profile = source('../hooks/useEasyChainProfile.js');

  for (const contents of [orange, profile]) {
    assert.match(contents, /useDeviceAccountOperationLease/);
    assert.match(contents, /const \{ lease, isCurrentLease \} = useDeviceAccountOperationLease\(\)/);
    assert.match(contents, /const expectedLease = lease/);
    assert.match(contents, /left\.sessionEpoch === right\.sessionEpoch/);
    assert.match(contents, /expectedAuthUserId: expectedLease\.ownerUserId/);
    assert.match(
      contents,
      /if \(!(?:isCurrentLease\(expectedLease\)|isCurrentRequest\(\))\) return null/,
    );
    assert.match(contents, /const ownsState = sameLease\(state\.lease, lease\)/);
  }

  assertGuardBeforeMutation(
    orange,
    'await Promise.all([',
    'setState((current) =>',
    'if (!isCurrentRequest())',
  );
  assertGuardBeforeMutation(profile, 'await api.me({', 'setState((current) =>');
  assert.doesNotMatch(profile, /api\.me\(\)/);
  assert.doesNotMatch(orange, /api\.orangeBalance\(address\)/);
});

test('the Phase 1 profile adapter consumes the real auth/me envelope and fields', () => {
  assert.deepEqual(adaptEasyGoProfileResponse({
    user: {
      walletAddress: '0x0000000000000000000000000000000000000001',
      verifiedAddress: '0x0000000000000000000000000000000000000002',
      displayName: 'Easy Alice',
      username: 'alice',
      pfp: 'https://cdn.easygo.example/alice.png',
      telegramUsername: 'easyalice',
      telegramId: 'private-id',
      kakaoId: 'kakao-id',
      createdAt: '2026-08-08T00:00:00.000Z',
    },
  }), {
    address: '0x0000000000000000000000000000000000000002',
    handle: 'Easy Alice',
    avatarUri: 'https://cdn.easygo.example/alice.png',
    socials: {
      telegram: 'easyalice',
      kakao: 'kakao-id',
      twitter: null,
    },
    joinedAt: '2026-08-08T00:00:00.000Z',
  });
});

test('Orange reward actions carry the captured owner and drop stale UI effects', () => {
  const contents = source('../screens/Navigation/OrangeNavigation.js');

  assert.match(contents, /useDeviceAccountOperationLease/);
  assert.match(contents, /api\.orangeRewardStatus\(\{\s*expectedAuthUserId: expectedLease\.ownerUserId,/);
  assert.match(contents, /const result = await claim\(\{\s*expectedAuthUserId: expectedLease\.ownerUserId,/);
  assert.match(contents, /syncClaim\(api\.orangeClaimDailyCheckin, 'dailyCheckin', expectedLease\)/);
  assert.match(contents, /setUserData\(\(current\) => \(\s*isCurrentLease\(expectedLease\)/);
  assert.match(contents, /catch \(error\) \{\s*if \(!isCurrentLease\(expectedLease\)\) return;[\s\S]*?Alert\.alert/);
  assert.doesNotMatch(contents, /api\.orangeRewardStatus\(\)/);
  assert.doesNotMatch(contents, /syncClaim\(api\.orangeClaimDailyCheckin, 'dailyCheckin'\)/);
  assert.doesNotMatch(contents, /orangeClaimDailyActivity|handleClaimDailyActivity|todayActivities/);
});

test('Orange reads and claims reject older same-session completions', () => {
  const orange = source('../hooks/useOrange.js');
  const navigation = source('../screens/Navigation/OrangeNavigation.js');

  assert.match(orange, /const requestIdRef = useRef\(0\);/);
  assert.match(orange, /const requestId = \+\+requestIdRef\.current;/);
  assert.match(orange, /requestId === requestIdRef\.current[\s\S]*?isCurrentLease\(expectedLease\)/);
  assert.match(orange, /return \(\) => \{ requestIdRef\.current \+= 1; \};/);

  assert.match(navigation, /const rewardStatusRequestIdRef = useRef\(0\);/);
  assert.match(navigation, /const claimRequestIdRef = useRef\(0\);/);
  assert.match(navigation, /const claimQueueRef = useRef\(Promise\.resolve\(\)\);/);
  assert.match(navigation, /requestId === rewardStatusRequestIdRef\.current/);
  assert.match(navigation, /requestId === claimRequestIdRef\.current/);
  assert.match(navigation, /const operation = claimQueueRef\.current\.then\(runClaim\);/);
  assert.match(navigation, /claimQueueRef\.current = operation\.catch\(\(\) => null\);/);
  assert.ok(
    navigation.indexOf('await Promise.all([refreshOrange(), loadRewardStatus(expectedLease)])')
      < navigation.indexOf('const operation = claimQueueRef.current.then(runClaim)'),
    'each serialized claim must refresh before the next queued claim starts',
  );
  assert.match(navigation, /catch \(error\) \{\s*if \(!isCurrentRequest\(\)\) return null;\s*throw error;/);
});

test('profile and first-reward modals suppress stale account updates and alerts', () => {
  const nickname = source('../components/modals/NicknameModal.js');
  const updateProfile = source('../components/modals/UpdateProfileModal.js');
  const newFeature = source('../components/modals/NewFeatureModal.js');

  for (const contents of [nickname, updateProfile, newFeature]) {
    assert.match(contents, /useDeviceAccountOperationLease/);
    assert.match(contents, /const expectedLease = lease/);
    assert.match(contents, /expectedAuthUserId: expectedLease\.ownerUserId/);
    assert.match(contents, /if \(!isCurrentLease\(expectedLease\)\) return/);
  }

  assertGuardBeforeMutation(nickname, 'await api.profiles.updateMe(', 'setUser(');
  assertGuardBeforeMutation(updateProfile, 'await api.profiles.updateMe(', 'setUser(');
  assertGuardBeforeMutation(newFeature, 'await api.orangeClaimFirstReward({', 'setUserData(');
  assert.match(nickname, /catch \{\s*if \(!isCurrentLease\(expectedLease\)\) return;\s*Alert\.alert/);
  assert.match(updateProfile, /catch \(error\) \{\s*if \(!isCurrentLease\(expectedLease\)\) return;[\s\S]*?Alert\.alert/);
  assert.doesNotMatch(newFeature, /FirstTimeReward/);
  assert.match(newFeature, /catch \{\s*if \(!isCurrentLease\(expectedLease\)\) return;\s*Alert\.alert/);
  assert.doesNotMatch(nickname, /profiles\.updateMe\(\{ displayName: normalizedName \}\)/);
  assert.doesNotMatch(updateProfile, /profiles\.updateMe\(payload\)/);
  assert.doesNotMatch(newFeature, /orangeClaimFirstReward\(\)/);
});

test('the App Store mobile source omits the Squid preview capability', () => {
  const api = source('../utils/api.js');
  const navigation = source('../navigation/AppNavigator.js');

  assert.doesNotMatch(api, /swapQuotePreview|\/swap\/quote-preview|swapQuote:\s*\(|swapLog:\s*\(/);
  assert.doesNotMatch(navigation, /SquidQuotePreview/);
  for (const path of [
    '../screens/Navigation/SquidQuotePreview.js',
    '../utils/squidPreview.js',
    '../utils/squidQuotePreview.mjs',
    '../utils/squidRouteLease.mjs',
  ]) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false, path);
  }
});
