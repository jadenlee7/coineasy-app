import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AMA_PREPARED_QUESTIONS,
  normalizeQuestionText,
  questionHash,
  referralCodeFor,
  restrictedQuestionReason,
} from '../src/lib/ama-service.js';

test('AMA question normalization makes duplicate detection stable', () => {
  assert.equal(
    normalizeQuestionText('  What   comes NEXT?  '),
    normalizeQuestionText('what comes next?'),
  );
  assert.equal(
    questionHash('Squid 앱의 다음 단계는 무엇인가요?'),
    questionHash('  Squid 앱의   다음 단계는 무엇인가요?  '),
  );
});

test('AMA filters price and financial-advice prompts without blocking product prompts', () => {
  assert.equal(restrictedQuestionReason('What is the target price for $QUID?'), 'price_or_financial_advice');
  assert.equal(restrictedQuestionReason('$QUID 가격 전망을 알려주세요'), 'price_or_financial_advice');
  assert.equal(restrictedQuestionReason('What comes next for the Squid app?'), undefined);
});

test('five bilingual prepared questions cover the agreed AMA topics', () => {
  assert.equal(AMA_PREPARED_QUESTIONS.length, 5);
  assert.deepEqual(
    AMA_PREPARED_QUESTIONS.map((item) => item.position),
    [1, 2, 3, 4, 5],
  );
  assert.equal(AMA_PREPARED_QUESTIONS.every((item) => item.questionKo && item.questionEn), true);
});

test('AMA referral codes are stable, campaign-scoped, and safe for Telegram deep links', () => {
  const first = referralCodeFor('squid_ama_2026_08_05', '123456789');
  assert.equal(first, referralCodeFor('squid_ama_2026_08_05', '123456789'));
  assert.notEqual(first, referralCodeFor('another_campaign', '123456789'));
  assert.match(first, /^[a-f0-9]{12}$/);
});
