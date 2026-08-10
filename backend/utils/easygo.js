/**
 * EasyGo phase flags.
 *
 * Path C v2 flags ship dormant; see docs/BACKEND_ROADMAP.md for the
 * sequenced PR plan (S0..S9) that flips each flag.
 */
const enabled = (name) => process.env[name] === 'true';

export const PHASE = Object.freeze({
  SIWE_AUTH_ENABLED: enabled('SIWE_AUTH_ENABLED'),
  JUSTANAME_ENABLED: enabled('JUSTANAME_ENABLED'),
  SEGMENTS_ENABLED: enabled('SEGMENTS_ENABLED'),
  QUESTS_ENABLED: enabled('QUESTS_ENABLED'),
  ADVERTISER_ADMIN_ENABLED: enabled('ADVERTISER_ADMIN_ENABLED'),
});
