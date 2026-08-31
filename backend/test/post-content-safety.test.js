import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inspectPostContentSafety,
  inspectPostMediaSafety,
  normalizePostContentForSafety,
  POST_CONTENT_SAFETY_POLICY_VERSION,
  POST_CONTENT_SAFETY_REJECTION_CODE,
  POST_CONTENT_SAFETY_RULE_IDS,
  POST_MEDIA_SAFETY_REJECTION_CODE,
} from '../src/lib/post-content-safety.js';

test('post content safety contract has a stable public code and auditable rule set', () => {
  assert.equal(POST_CONTENT_SAFETY_POLICY_VERSION, '2026-08-31.v1');
  assert.equal(POST_CONTENT_SAFETY_REJECTION_CODE, 'post_content_rejected');
  assert.equal(POST_MEDIA_SAFETY_REJECTION_CODE, 'post_media_rejected');
  assert.deepEqual(POST_CONTENT_SAFETY_RULE_IDS, [
    'sexual_exploitation',
    'nonconsensual_sexual_content',
    'sexual_solicitation',
    'self_harm_encouragement',
    'violent_threat',
    'hateful_abuse',
  ]);
  assert.equal(Object.isFrozen(POST_CONTENT_SAFETY_RULE_IDS), true);
});

test('media policy fails closed for every non-null URL without echoing it', () => {
  assert.equal(inspectPostMediaSafety(undefined).allowed, true);
  assert.equal(inspectPostMediaSafety(null).allowed, true);
  const mediaUrl = 'https://uploads.invalid/private.png?token=secret';
  const result = inspectPostMediaSafety(mediaUrl);
  assert.deepEqual(result, {
    allowed: false,
    policyVersion: POST_CONTENT_SAFETY_POLICY_VERSION,
    ruleId: 'unscanned_remote_media',
  });
  assert.equal(JSON.stringify(result).includes(mediaUrl), false);
});

test('normalization folds Unicode compatibility, format characters, marks, confusables, leet, separators, and repetition', () => {
  const expected = normalizePostContentForSafety('kill yourself');
  for (const value of [
    'ＫＩＬＬ　ＹＯＵＲＳＥＬＦ',
    'k\u200Bi.l.l y-o-u-r-s-e-l-f',
    'k1ll y0ur53lf',
    'kіll yοurѕelf',
    'kіӏӏ yourself',
    'kííílllll yoouuurself',
  ]) {
    assert.equal(normalizePostContentForSafety(value), expected, value);
  }
});

test('policy rejects direct English and Korean examples in every safety category', () => {
  for (const [text, ruleId] of [
    ['send child nudes', 'sexual_exploitation'],
    ['아동 성착취물', 'sexual_exploitation'],
    ['share her leaked nudes', 'nonconsensual_sexual_content'],
    ['불법 촬영물 공유', 'nonconsensual_sexual_content'],
    ['send me nudes', 'sexual_solicitation'],
    ['야동 링크 보내', 'sexual_solicitation'],
    ['go kill yourself', 'self_harm_encouragement'],
    ['자살해 버려', 'self_harm_encouragement'],
    ['I am going to kill you', 'violent_threat'],
    ['너를 죽이겠다', 'violent_threat'],
    ['gas the jews', 'hateful_abuse'],
  ]) {
    assert.deepEqual(inspectPostContentSafety(text), {
      allowed: false,
      policyVersion: POST_CONTENT_SAFETY_POLICY_VERSION,
      ruleId,
    });
  }
});

test('policy rejects representative mixed evasion without echoing submitted text', () => {
  const rejectedText = 'Ｋ\u200B1.l.l yοurѕééélf';
  const result = inspectPostContentSafety(rejectedText);
  assert.deepEqual(result, {
    allowed: false,
    policyVersion: POST_CONTENT_SAFETY_POLICY_VERSION,
    ruleId: 'self_harm_encouragement',
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(JSON.stringify(result).includes(rejectedText), false);
});

test('Hangul rules match inside ordinary Korean spacing and particles', () => {
  assert.equal(inspectPostContentSafety('너는그냥죽어버려야해').allowed, false);
  assert.equal(inspectPostContentSafety('이것은 아동성착취물입니다').allowed, false);
});

test('policy remains bounded at the route body limit and rejects fused boundaries', () => {
  const padded = `${'a'.repeat(1_980)} kill yourself`;
  assert.equal(padded.length <= 2_000, true);
  assert.equal(inspectPostContentSafety(padded).allowed, false);
  assert.equal(inspectPostContentSafety('xkill yourself').allowed, false);
  assert.equal(inspectPostContentSafety('kill yourselfx').allowed, false);
  assert.equal(inspectPostContentSafety('kill yourself.foo').allowed, false);
  const separatorHeavy = `${'k.'.repeat(990)}kill yourself`;
  assert.equal(separatorHeavy.length <= 2_000, true);
  assert.equal(inspectPostContentSafety(separatorHeavy).allowed, false);
});

test('word-boundary metadata stays aligned after supplementary-plane Unicode letters', () => {
  assert.equal(inspectPostContentSafety('\u{10400} kill yourself').allowed, false);
  assert.equal(inspectPostContentSafety('kill yourself \u{10400}').allowed, false);
  assert.equal(inspectPostContentSafety('\u{10400} skill yourself').allowed, true);
});

test('policy permits benign near matches and preserves comparison-only behavior', () => {
  for (const text of [
    'Use the emergency kill switch during an outage.',
    'Learn this skill yourself.',
    'I will kill your process during the test.',
    'Build your skills yourself with this tutorial.',
    'Community news from Niger and Nigeria.',
    'The guide says to help yourself. Follow up with friends.',
    'Please send me the updated release notes.',
    'A nude color palette is common in design.',
    'This policy explains how to report abuse and seek help.',
    '폭력과 괴롭힘을 신고하는 방법을 안내합니다.',
    '#EasyGo daily check-in 2026',
  ]) {
    assert.deepEqual(inspectPostContentSafety(text), {
      allowed: true,
      policyVersion: POST_CONTENT_SAFETY_POLICY_VERSION,
      ruleId: null,
    }, text);
  }
});

test('policy is deterministic, stateless, and fails closed for non-string input', () => {
  const input = 'ordinary community update';
  const first = inspectPostContentSafety(input);
  assert.deepEqual(inspectPostContentSafety(input), first);
  assert.deepEqual(inspectPostContentSafety(input), first);
  assert.deepEqual(inspectPostContentSafety(null), {
    allowed: false,
    policyVersion: POST_CONTENT_SAFETY_POLICY_VERSION,
    ruleId: 'invalid_input',
  });
  assert.equal(normalizePostContentForSafety(null), '');
});
