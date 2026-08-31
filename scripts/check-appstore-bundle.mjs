import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const FORBIDDEN_APPSTORE_BUNDLE_MARKERS = Object.freeze([
  '/swap/quote-preview',
  '/swap/log',
  '/orange/claims/daily-activity',
  'Base Route Estimate Lab',
  'Daily Participation',
  'Passkey · 준비 중',
  'Sign up with Wallet',
  'signer required (Privy embedded wallet not ready)',
  'swap log failed (reward may not credit)',
  'Watch AD',
  'Invite reward',
  'Invite Friends',
  'convertible into assets such as NFT',
  'Go to Shop Box',
  'oranges-help-invite',
  'Orange Rewards',
  'Orange Collected!',
  "You've earned 50 Oranges",
  '+50 Oranges',
  'Discover New Rewards!',
  'Go to Reward Page',
  'Starbucks Gifticon Entry',
  'Winning Chance 2%',
  'Guaranteed Coffee Coupon',
  "You've received a Starbucks Gifticon!",
  "You've received a free cup of coffee!",
  'Easycon whitelist',
  'SQUID_BRIDGE',
]);

export function findForbiddenAppStoreMarkers(contents) {
  const text = Buffer.isBuffer(contents) ? contents.toString('utf8') : String(contents || '');
  const matches = FORBIDDEN_APPSTORE_BUNDLE_MARKERS.filter((marker) => text.includes(marker));
  if (/\/swap\/quote(?!-preview)/.test(text)) {
    matches.push('/swap/quote (execution route)');
  }
  return matches;
}

export function assertAppStoreBundleSafe(bundlePath) {
  const matches = findForbiddenAppStoreMarkers(readFileSync(bundlePath));
  if (matches.length > 0) {
    const error = new Error(`App Store bundle contains forbidden review-risk markers: ${matches.join(', ')}`);
    error.code = 'appstore_bundle_contains_forbidden_marker';
    error.matches = matches;
    throw error;
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bundlePaths = process.argv.slice(2);
  if (bundlePaths.length === 0) {
    console.error('Usage: node scripts/check-appstore-bundle.mjs <ios-js-bundle> [bundle...]');
    process.exitCode = 2;
  } else {
    for (const bundlePath of bundlePaths) {
      assertAppStoreBundleSafe(bundlePath);
      console.log(`App Store bundle check passed: ${bundlePath}`);
    }
  }
}
