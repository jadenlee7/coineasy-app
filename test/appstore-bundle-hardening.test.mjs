import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  FORBIDDEN_APPSTORE_BUNDLE_MARKERS,
  findForbiddenAppStoreMarkers,
} from '../scripts/check-appstore-bundle.mjs';

test('the App Store bundle scanner catches every dormant Squid execution marker', () => {
  assert.deepEqual(findForbiddenAppStoreMarkers('safe preview bundle'), []);
  assert.deepEqual(findForbiddenAppStoreMarkers('/swap/quote-preview'), []);
  assert.deepEqual(
    findForbiddenAppStoreMarkers('POST /swap/quote'),
    ['/swap/quote (execution route)'],
  );
  for (const marker of FORBIDDEN_APPSTORE_BUNDLE_MARKERS) {
    assert.deepEqual(findForbiddenAppStoreMarkers(`prefix ${marker} suffix`), [marker]);
  }
});

test('mobile source exposes only the display-only Squid client', () => {
  const preview = readFileSync(new URL('../utils/squidPreview.js', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../utils/api.js', import.meta.url), 'utf8');
  const combined = `${preview}\n${api}`;

  assert.deepEqual(findForbiddenAppStoreMarkers(combined), []);
  assert.doesNotMatch(combined, /executeSquidRoute|swapQuote:\s*\(|swapLog:\s*\(/);
  assert.equal(existsSync(new URL('../utils/squid.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../components/modals/ClaimOrangesModal.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../screens/Navigation/InviteFriendScreen.js', import.meta.url)), false);
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
  const combined = [reward, history, navigation, modal, postbox, newFeature, trophies].join('\n');

  assert.deepEqual(findForbiddenAppStoreMarkers(combined), []);
  assert.match(reward, /Orange points track in-app learning and participation only/);
  assert.match(reward, /cannot be bought, sold, transferred, redeemed, or converted/);
  assert.match(reward, /accessibilityState=\{\{disabled\}\}/);
  assert.match(reward, /disabled=\{disabled\}/);
  assert.match(navigation, /AD_REWARD: 'Legacy promotion points'/);
  assert.match(navigation, /SWAP_REWARD: 'Legacy activity points'/);
  assert.doesNotMatch(postbox, /Oranges Reward for your first post/);
  assert.equal(existsSync(new URL('../screens/Navigation/Oranges/ShopScreen.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../screens/Navigation/Oranges/GiftScreen.js', import.meta.url)), false);
});
