import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  FORBIDDEN_APPSTORE_BUNDLE_MARKERS,
  findForbiddenAppStoreMarkers,
} from '../scripts/check-appstore-bundle.mjs';

test('the App Store bundle scanner catches every dormant review-risk marker', () => {
  assert.deepEqual(findForbiddenAppStoreMarkers('safe EasyGo bundle'), []);
  assert.deepEqual(
    findForbiddenAppStoreMarkers('/swap/quote-preview'),
    ['/swap/quote-preview'],
  );
  assert.deepEqual(
    findForbiddenAppStoreMarkers('POST /swap/quote'),
    ['/swap/quote (execution route)'],
  );
  for (const marker of FORBIDDEN_APPSTORE_BUNDLE_MARKERS) {
    assert.deepEqual(findForbiddenAppStoreMarkers(`prefix ${marker} suffix`), [marker]);
  }
});

test('mobile source omits every Squid client and route', () => {
  const api = readFileSync(new URL('../utils/api.js', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../navigation/AppNavigator.js', import.meta.url), 'utf8');
  const combined = `${api}\n${navigation}`;

  assert.deepEqual(findForbiddenAppStoreMarkers(combined), []);
  assert.doesNotMatch(combined, /SquidQuotePreview|swapQuotePreview|\/swap\/quote-preview|executeSquidRoute|swapQuote:\s*\(|swapLog:\s*\(/);
  assert.equal(existsSync(new URL('../utils/squid.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../utils/squidPreview.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../utils/squidQuotePreview.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../utils/squidRouteLease.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../screens/Navigation/SquidQuotePreview.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../components/modals/ClaimOrangesModal.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../screens/Navigation/InviteFriendScreen.js', import.meta.url)), false);
});

test('Settings exposes both the official support page and email contact actions', () => {
  const settings = readFileSync(
    new URL('../components/modals/SettingsModal.js', import.meta.url),
    'utf8',
  );
  const support = readFileSync(
    new URL('../utils/supportContact.mjs', import.meta.url),
    'utf8',
  );
  assert.match(settings, /'Support center'/);
  assert.match(settings, /'Email support'/);
  assert.match(settings, /EASYGO_SUPPORT_CONTACT\.email/);
  assert.match(settings, /EASYGO_SUPPORT_CONTACT\.mailtoUrl/);
  assert.match(settings, /accessibilityRole="button"/);
  assert.match(support, /contact@coineasy\.xyz/);
  assert.match(support, /EXPO_PUBLIC_EASYGO_SUPPORT_URL/);
});

test('App Store Orange UI is progress-only and omits ad, invite, shop, and conversion surfaces', () => {
  const reward = readFileSync(
    new URL('../screens/Navigation/Oranges/OrangeReward.js', import.meta.url),
    'utf8',
  );
  const history = readFileSync(
    new URL('../screens/Navigation/RewardHistory.js', import.meta.url),
    'utf8',
  );
  const navigation = readFileSync(
    new URL('../screens/Navigation/OrangeNavigation.js', import.meta.url),
    'utf8',
  );
  const api = readFileSync(new URL('../utils/api.js', import.meta.url), 'utf8');
  const modal = readFileSync(new URL('../components/Modal.js', import.meta.url), 'utf8');
  const postbox = readFileSync(new URL('../components/Postbox.js', import.meta.url), 'utf8');
  const newFeature = readFileSync(
    new URL('../components/modals/NewFeatureModal.js', import.meta.url),
    'utf8',
  );
  const trophies = readFileSync(
    new URL('../screens/Navigation/Trophies/TrophieCoineasy.js', import.meta.url),
    'utf8',
  );
  const courses = readFileSync(new URL('../data/courses.js', import.meta.url), 'utf8');
  const easygo = readFileSync(new URL('../utils/easygo.js', import.meta.url), 'utf8');
  const combined = [reward, history, navigation, api, modal, postbox, newFeature, trophies, courses, easygo].join('\n');

  assert.deepEqual(findForbiddenAppStoreMarkers(combined), []);
  assert.match(reward, /Orange points track in-app learning and participation only/);
  assert.match(reward, /cannot be bought, sold, transferred, redeemed, or converted/);
  assert.match(reward, /accessibilityState=\{\{disabled\}\}/);
  assert.match(reward, /disabled=\{disabled\}/);
  assert.match(navigation, /AD_REWARD: 'Legacy promotion points'/);
  assert.match(navigation, /SWAP_REWARD: 'Legacy activity points'/);
  assert.doesNotMatch(combined, /\/orange\/claims\/daily-activity|orangeClaimDailyActivity|handleClaimDailyActivity|todayActivities|Daily Participation/);
  assert.doesNotMatch(postbox, /Oranges Reward for your first post/);
  assert.doesNotMatch(courses, /shopData|starbucks_(?:gifticon|coffee)\.png/);
  assert.doesNotMatch(easygo, /SQUID_BRIDGE/);
  assert.equal(existsSync(new URL('../screens/Navigation/Oranges/ShopScreen.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../screens/Navigation/Oranges/GiftScreen.js', import.meta.url)), false);
});
