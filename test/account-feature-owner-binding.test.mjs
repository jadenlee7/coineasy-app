import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  SQUID_ROUTE_LEASE_ERROR,
  createSquidRouteLeaseRegistry,
} from '../utils/squidRouteLease.mjs';
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
  assert.match(contents, /syncClaim\(api\.orangeClaimDailyActivity, 'dailyActivity', expectedLease\)/);
  assert.match(contents, /syncClaim\(api\.orangeClaimAdReward, 'adReward', expectedLease\)/);
  assert.match(contents, /setUserData\(\(current\) => \(\s*isCurrentLease\(expectedLease\)/);
  assert.match(contents, /catch \(error\) \{\s*if \(!isCurrentLease\(expectedLease\)\) return;[\s\S]*?Alert\.alert/);
  assert.doesNotMatch(contents, /api\.orangeRewardStatus\(\)/);
  assert.doesNotMatch(contents, /syncClaim\(api\.orangeClaim(?:DailyCheckin|DailyActivity|AdReward), '[^']+'\)/);
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

test('Squid quote and execution bind the quote and signer to one full session lease', () => {
  const contents = source('../utils/squid.js');

  assert.match(contents, /createSquidRouteLeaseRegistry/);
  assert.match(contents, /getSquidQuote\(\{[\s\S]*?lease,[\s\S]*?isCurrentLease,[\s\S]*?\}\)/);
  assert.match(contents, /fromAddress,[\s\S]*?slippage,[\s\S]*?lease,[\s\S]*?isCurrentLease/);
  assert.match(contents, /executeSquidRoute\(\{ quote, signer, lease, isCurrentLease \}\)/);
  assert.match(contents, /api\.swapQuote\([\s\S]*?expectedAuthUserId: operationLease\.ownerUserId/);
  assert.match(contents, /api\.swapLog\([\s\S]*?expectedAuthUserId: operationLease\.ownerUserId/);
  assert.match(contents, /if \(!quote\?\.route \|\| !quote\?\.tx\) return null;/);
  assert.match(contents, /fromAddress,[\s\S]*?fromToken,[\s\S]*?fromAmount/);
  assert.match(contents, /const \{ to, data, value, gasLimit, gasPrice \} = quote\.tx;/);
  const finalFence = contents.indexOf(
    'squidRouteLeases.requireBound(quote, operationLease, isCurrentLease);',
    contents.indexOf('const { to, data, value, gasLimit, gasPrice }'),
  );
  assert.ok(finalFence >= 0);
  assert.ok(finalFence < contents.indexOf('signer.sendTransaction', finalFence));
  const wait = contents.indexOf('await tx.wait()');
  assert.ok(wait >= 0);
  assert.ok(contents.indexOf(
    'squidRouteLeases.requireBound(quote, operationLease, isCurrentLease);',
    wait,
  ) > wait);
});

test('a Squid quote capability cannot cross owner or same-DID session epochs', () => {
  const registry = createSquidRouteLeaseRegistry();
  const ownerA1 = Object.freeze({ ownerUserId: 'did:privy:a', sessionEpoch: 1 });
  const ownerA2 = Object.freeze({ ownerUserId: 'did:privy:a', sessionEpoch: 2 });
  const ownerB = Object.freeze({ ownerUserId: 'did:privy:b', sessionEpoch: 3 });
  let current = ownerA1;
  const isCurrentLease = (candidate) => candidate === current;
  const route = { route: {}, tx: { to: '0x1' } };

  registry.bind(route, ownerA1, isCurrentLease);
  assert.equal(registry.requireBound(route, ownerA1, isCurrentLease), ownerA1);

  current = ownerB;
  assert.throws(
    () => registry.requireBound(route, ownerA1, isCurrentLease),
    { code: SQUID_ROUTE_LEASE_ERROR },
  );
  assert.throws(
    () => registry.requireBound(route, ownerB, isCurrentLease),
    { code: SQUID_ROUTE_LEASE_ERROR },
  );

  current = ownerA2;
  assert.throws(
    () => registry.requireBound(route, ownerA2, isCurrentLease),
    { code: SQUID_ROUTE_LEASE_ERROR },
  );
  assert.throws(
    () => registry.requireBound({ ...route }, ownerA2, isCurrentLease),
    { code: SQUID_ROUTE_LEASE_ERROR },
  );
});
