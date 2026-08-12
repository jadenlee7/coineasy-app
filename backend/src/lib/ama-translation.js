const TRANSLATION_INSTRUCTIONS = [
  'Translate the supplied Squid AMA answer into natural, concise Korean.',
  'Preserve factual meaning and tone exactly.',
  'Do not add claims, explanations, disclaimers, or marketing language.',
  'Keep URLs, Telegram handles, numbers, dates, $QUID, TGE, Squid, and product names unchanged.',
  'Return only the Korean translation.',
].join(' ');

const QUESTION_TRANSLATION_INSTRUCTIONS = [
  'Translate the supplied Korean Squid AMA question into clear, natural English.',
  'Preserve factual meaning exactly.',
  'Do not answer the question or add context.',
  'Keep URLs, Telegram handles, numbers, dates, $QUID, TGE, Squid, and product names unchanged.',
  'Return only the English translation.',
].join(' ');

const QUESTION_PACK_INSTRUCTIONS = [
  'Create a concise English question-review pack for the Squid team from the supplied Korean and English community questions.',
  'Merge questions that ask the same thing, but preserve distinct user intent.',
  'Exclude price predictions, return or yield promises, financial advice, exchange-listing speculation, and confidential requests.',
  'Group the remaining questions under Product, $QUID, Staking, Roadmap, Partnerships, or Other.',
  'For each question, include its source question IDs in parentheses so CoinEasy can audit the merge.',
  'Do not answer any question, invent facts, or add marketing claims.',
  'Return clean Markdown only, starting with a one-line count summary.',
].join(' ');

export function responseOutputText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const parts = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text);
      }
    }
  }
  return parts.join('\n').trim();
}

export function createAmaTranslator({
  config,
  fetchImpl = globalThis.fetch,
  timeoutMs = 20_000,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation is required');

  async function requestTranslation(inputValue, instructions) {
    const input = String(inputValue || '').trim();
    if (!input) throw new TypeError('Translation input is required');
    if (!(config?.translationApiKey && config?.translationModel)) {
      throw new Error('AMA translation is not configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.translationApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.translationModel,
          instructions,
          input,
          store: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AMA translation request failed with status ${response.status}`);
      }

      const translated = responseOutputText(await response.json());
      if (!translated) throw new Error('AMA translation returned no text');
      return translated;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    configured() {
      return Boolean(config?.translationApiKey && config?.translationModel);
    },

    async translateToKorean(answerEn) {
      return requestTranslation(answerEn, TRANSLATION_INSTRUCTIONS);
    },

    async translateQuestionToEnglish(questionKo) {
      return requestTranslation(questionKo, QUESTION_TRANSLATION_INSTRUCTIONS);
    },

    async composeQuestionPack(questions) {
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new TypeError('At least one AMA question is required');
      }
      const input = questions.map((question) => (
        `[${question.id}] ${String(question.questionText || '').trim()}`
      )).join('\n');
      return requestTranslation(input, QUESTION_PACK_INSTRUCTIONS);
    },
  };
}
