import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAmaTranslator,
  responseOutputText,
} from '../src/lib/ama-translation.js';

test('Responses API output text is extracted from raw response content', () => {
  assert.equal(responseOutputText({
    output: [{
      content: [
        { type: 'output_text', text: '첫 문장' },
        { type: 'output_text', text: '둘째 문장' },
      ],
    }],
  }), '첫 문장\n둘째 문장');
});

test('AMA translator uses the Responses API without storing the response', async () => {
  const requests = [];
  const translator = createAmaTranslator({
    config: {
      translationApiKey: 'secret',
      translationModel: 'translation-model',
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        async json() {
          return { output: [{ content: [{ type: 'output_text', text: '자연스러운 번역' }] }] };
        },
      };
    },
  });

  assert.equal(await translator.translateToKorean('Approved answer.'), '자연스러운 번역');
  assert.equal(await translator.translateQuestionToEnglish('다음 계획은 무엇인가요?'), '자연스러운 번역');
  assert.equal(await translator.composeQuestionPack([
    { id: 'q1', questionText: 'Squid 앱의 다음 계획은 무엇인가요?' },
  ]), '자연스러운 번역');
  const request = requests[0];
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  const body = JSON.parse(request.options.body);
  assert.equal(body.store, false);
  assert.equal(body.input, 'Approved answer.');
  assert.equal(body.model, 'translation-model');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.match(JSON.parse(requests[1].options.body).instructions, /English/);
  const packRequest = JSON.parse(requests[2].options.body);
  assert.match(packRequest.instructions, /source question IDs/);
  assert.match(packRequest.input, /\[q1\]/);
});

test('AMA translator fails closed when it is not configured', async () => {
  const translator = createAmaTranslator({ config: {}, fetchImpl: async () => ({ ok: true }) });
  assert.equal(translator.configured(), false);
  await assert.rejects(
    translator.translateToKorean('Answer'),
    /not configured/,
  );
  await assert.rejects(
    translator.composeQuestionPack([]),
    /At least one/,
  );
});
