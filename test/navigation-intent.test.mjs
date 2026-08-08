import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  easyGoUserIdFromDid,
  navigationIntentFromNotificationData,
  navigationIntentFromParsedUrl,
  normalizeEasyGoRouteId,
  routeForEasyGoNavigationIntent,
} from '../utils/navigationIntent.mjs';

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('profile links use explicit EasyGo ids and retain safe legacy easygo did links', () => {
  assert.deepEqual(
    navigationIntentFromParsedUrl({
      path: '/user/',
      queryParams: { userId: 'cm_user-123' },
    }),
    { type: 'profile', userId: 'cm_user-123' },
  );
  assert.deepEqual(
    navigationIntentFromParsedUrl({
      path: 'profile',
      queryParams: { did: 'easygo:easygo_seed_builder' },
    }),
    { type: 'profile', userId: 'easygo_seed_builder' },
  );
  assert.equal(easyGoUserIdFromDid('privy:did:user-1'), null);
  assert.equal(navigationIntentFromParsedUrl({
    path: 'user',
    queryParams: { userId: '../profiles/me' },
  }), null);
});

test('notification intents select validated post ids and reply masters', () => {
  assert.deepEqual(
    navigationIntentFromNotificationData({ type: 'reaction', post_id: 'post_1' }),
    { type: 'post', postId: 'post_1' },
  );
  assert.deepEqual(
    navigationIntentFromNotificationData({
      type: 'reply',
      master: 'root_post',
      post_id: 'reply_post',
    }),
    { type: 'post', postId: 'root_post' },
  );
  assert.equal(
    navigationIntentFromNotificationData({ type: 'mention', post_id: 'bad/post' }),
    null,
  );
  assert.equal(navigationIntentFromNotificationData({ type: 'unknown', post_id: 'post_1' }), null);
});

test('navigation routes are constructed only from normalized targets', () => {
  assert.equal(normalizeEasyGoRouteId('  user_1  '), 'user_1');
  assert.equal(normalizeEasyGoRouteId(''), null);
  assert.equal(normalizeEasyGoRouteId('x'.repeat(129)), null);
  assert.deepEqual(
    routeForEasyGoNavigationIntent({ type: 'profile', userId: 'user_1' }),
    { name: 'ProfileSelected', params: { userId: 'user_1' } },
  );
  assert.deepEqual(
    routeForEasyGoNavigationIntent({ type: 'post', postId: 'post_1' }),
    { name: 'PostDetails', params: { postId: 'post_1' } },
  );
  assert.equal(routeForEasyGoNavigationIntent({ type: 'profile', userId: 'bad/id' }), null);
});

test('the app replays only transition-bound intents through the real navigator', () => {
  const app = read('../App.js');
  const navigator = read('../navigation/AppNavigator.js');
  const qr = read('../components/modals/QR.js');

  assert.match(app, /pendingNavigationIntentRef = useRef\(null\)/);
  assert.match(app, /sameAccountTransition\(pendingNavigation\.accountTransition, currentTransition\)/);
  assert.match(app, /accountUiReadyRef\.current &&|!accountUiReadyRef\.current/);
  assert.match(app, /navigationRef\.navigate\(route\.name, route\.params\)/);
  assert.match(app, /<AppNavigator[\s\S]*?navigationRef=\{navigationRef\}[\s\S]*?onNavigationReady=\{handleNavigationReady\}/);
  assert.match(navigator, /<NavigationContainer ref=\{navigationRef\} onReady=\{onNavigationReady\}>/);
  assert.match(qr, /queryParams: \{ userId: easyGoUserId \}/);
  assert.doesNotMatch(qr, /queryParams: \{ did: user\.did \}/);
  assert.match(qr, /useEffect\(\(\) => \{\s*const subscription = BackHandler\.addEventListener/);
  assert.match(qr, /return \(\) => subscription\.remove\(\);/);
});
