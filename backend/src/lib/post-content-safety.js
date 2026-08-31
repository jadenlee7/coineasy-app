/**
 * Deterministic minimum safety screen for user-authored post text.
 *
 * The policy deliberately uses a small, reviewable set of high-confidence
 * phrases. It is enforced by the server before both create and edit writes and
 * is not a replacement for reporting or human moderation. Matching uses only
 * local string operations; no rejected text leaves this module.
 */

export const POST_CONTENT_SAFETY_POLICY_VERSION = '2026-08-31.v1';
export const POST_CONTENT_SAFETY_REJECTION_CODE = 'post_content_rejected';
export const POST_MEDIA_SAFETY_REJECTION_CODE = 'post_media_rejected';

const FORMAT_CHARACTERS = /\p{Cf}/gu;
const COMBINING_MARKS = /\p{M}/gu;
const ALPHANUMERIC_CHARACTER = /^[\p{L}\p{N}]$/u;
const HANGUL_CHARACTER = /\p{Script=Hangul}/u;

// Common leetspeak and mixed-script confusables used to evade simple word
// matching. Keep this table explicit so policy changes remain reviewable.
const CHARACTER_FOLD = Object.freeze({
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '!': 'i',
  '$': 's',
  '+': 't',
  '@': 'a',
  '|': 'i',
  'ı': 'i',
  'ſ': 's',
  'α': 'a',
  'β': 'b',
  'ε': 'e',
  'ι': 'i',
  'κ': 'k',
  'μ': 'm',
  'ν': 'n',
  'ο': 'o',
  'ρ': 'p',
  'τ': 't',
  'υ': 'u',
  'χ': 'x',
  'ϲ': 'c',
  'а': 'a',
  'в': 'b',
  'е': 'e',
  'і': 'i',
  'ј': 'j',
  'к': 'k',
  'ӏ': 'l',
  'м': 'm',
  'о': 'o',
  'р': 'p',
  'с': 'c',
  'т': 't',
  'у': 'y',
  'х': 'x',
  'ѕ': 's',
});

const RULE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'sexual_exploitation',
    phrases: Object.freeze([
      'child porn',
      'child pornography',
      'child sexual abuse material',
      'send child nudes',
      'minor nude pictures',
      '아동 음란물',
      '아동 성착취물',
      '미성년자 나체 사진',
    ]),
  }),
  Object.freeze({
    id: 'nonconsensual_sexual_content',
    phrases: Object.freeze([
      'rape porn',
      'revenge porn',
      'leaked nudes',
      'share her nudes',
      'share his nudes',
      '리벤지 포르노',
      '불법 촬영물 공유',
      '몰카 영상 공유',
    ]),
  }),
  Object.freeze({
    id: 'sexual_solicitation',
    phrases: Object.freeze([
      'send me nudes',
      'send nudes',
      'nude pics please',
      'porn link please',
      '누드 사진 보내',
      '나체 사진 보내',
      '야동 링크 보내',
    ]),
  }),
  Object.freeze({
    id: 'self_harm_encouragement',
    phrases: Object.freeze([
      'kill yourself',
      'go kill yourself',
      'you should kill yourself',
      'commit suicide',
      'go commit suicide',
      '자살해',
      '자살해 버려',
      '죽어 버려',
      '죽어버려',
    ]),
  }),
  Object.freeze({
    id: 'violent_threat',
    phrases: Object.freeze([
      'i will kill you',
      'i am going to kill you',
      'im going to kill you',
      'gonna kill you',
      'i will murder you',
      '너를 죽이겠다',
      '널 죽이겠다',
      '죽여 버릴 거야',
      '죽여버릴거야',
    ]),
  }),
  Object.freeze({
    id: 'hateful_abuse',
    phrases: Object.freeze([
      'gas the jews',
      'kill all jews',
      'kill all muslims',
      'kill all black people',
      'kill all gay people',
      'you are a nigger',
      'dirty nigger',
      'you are a faggot',
      'you fucking faggot',
    ]),
  }),
]);

function foldPostContentCharacters(value) {
  if (typeof value !== 'string') return '';
  const compatibilityFolded = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(FORMAT_CHARACTERS, '')
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '');
  return Array.from(
    compatibilityFolded,
    (character) => CHARACTER_FOLD[character] || character,
  ).join('');
}

function createSafetySequence(value) {
  const compact = [];
  const wordEnds = [];
  const wordStarts = [];
  let startsWord = true;

  for (const character of Array.from(foldPostContentCharacters(value))) {
    if (!ALPHANUMERIC_CHARACTER.test(character)) {
      if (wordEnds.length > 0) wordEnds[wordEnds.length - 1] = true;
      startsWord = true;
      continue;
    }
    if (compact.at(-1) === character) {
      if (startsWord) wordStarts[wordStarts.length - character.length] = true;
      startsWord = false;
      continue;
    }
    compact.push(character);
    wordStarts.push(compact.length === 1 || startsWord);
    wordEnds.push(false);
    for (let index = 1; index < character.length; index += 1) {
      wordStarts.push(false);
      wordEnds.push(false);
    }
    startsWord = false;
  }
  if (wordEnds.length > 0) wordEnds[wordEnds.length - 1] = true;

  return Object.freeze({
    compact: compact.join(''),
    wordEnds: Object.freeze(wordEnds),
    wordStarts: Object.freeze(wordStarts),
  });
}

/**
 * Produce the comparison-only safety skeleton. The original post text is never
 * modified or returned by the policy.
 */
export function normalizePostContentForSafety(value) {
  return createSafetySequence(value).compact;
}

const COMPILED_RULES = Object.freeze(RULE_DEFINITIONS.map((definition) => (
  Object.freeze({
    id: definition.id,
    needles: Object.freeze(definition.phrases.map((phrase) => {
      const compact = normalizePostContentForSafety(phrase);
      return Object.freeze({
        compact,
        matchWithinWord: HANGUL_CHARACTER.test(phrase),
      });
    })),
  })
)));

export const POST_CONTENT_SAFETY_RULE_IDS = Object.freeze(
  COMPILED_RULES.map(({ id }) => id),
);

function verdict(allowed, ruleId = null) {
  return Object.freeze({
    allowed,
    policyVersion: POST_CONTENT_SAFETY_POLICY_VERSION,
    ruleId,
  });
}

function startsAtBoundaryOrXWrapper(sequence, index) {
  if (sequence.wordStarts[index]) return true;
  const wrapperIndex = index - 1;
  return wrapperIndex >= 0
    && sequence.compact[wrapperIndex] === 'x'
    && sequence.wordStarts[wrapperIndex] === true;
}

function endsAtBoundaryOrXWrapper(sequence, end) {
  if (sequence.wordEnds[end - 1]) return true;
  return sequence.compact[end] === 'x'
    && sequence.wordEnds[end] === true;
}

function containsBoundedNeedle(sequence, needle) {
  let index = sequence.compact.indexOf(needle);
  while (index !== -1) {
    const end = index + needle.length;
    if (
      startsAtBoundaryOrXWrapper(sequence, index)
      && endsAtBoundaryOrXWrapper(sequence, end)
    ) return true;
    index = sequence.compact.indexOf(needle, index + 1);
  }
  return false;
}

/**
 * Return metadata only. Callers must expose the generic public rejection code,
 * never the internal rule ID or submitted text.
 */
export function inspectPostContentSafety(value) {
  if (typeof value !== 'string') return verdict(false, 'invalid_input');
  const sequence = createSafetySequence(value);
  for (const rule of COMPILED_RULES) {
    if (rule.needles.some((needle) => (
      needle.matchWithinWord
        ? sequence.compact.includes(needle.compact)
        : containsBoundedNeedle(sequence, needle.compact)
    ))) {
      return verdict(false, rule.id);
    }
  }
  return verdict(true);
}

/**
 * Remote media is not yet scanned or proxied by EasyGo. Missing media preserves
 * an existing edit value and null explicitly removes it; every non-null URL is
 * rejected until an approved server-authoritative media policy exists.
 */
export function inspectPostMediaSafety(value) {
  return value === undefined || value === null
    ? verdict(true)
    : verdict(false, 'unscanned_remote_media');
}
