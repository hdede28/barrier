'use strict';

const { createTranslator } = require('./translate');
const { createFreeTranslator } = require('./translate-free');

// ANTHROPIC_API_KEY varsa Claude (kaliteli, ücretli), yoksa ücretsiz MyMemory.
function translatorFromEnv(env = process.env) {
  return createTranslator({
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.TRANSLATE_MODEL,
    dailyLimit: env.TRANSLATE_DAILY_LIMIT,
    baseURL: env.ANTHROPIC_BASE_URL,
  }) || createFreeTranslator({
    email: env.MYMEMORY_EMAIL,
    dailyChars: env.MYMEMORY_DAILY_CHARS,
    baseURL: env.MYMEMORY_BASE_URL,
  });
}

// null = çevrilemeyen başlık (kota doldu); arayüz bunların orijinalini gösterir.
function translationResponse(translator, translations) {
  const partial = translations.some((t) => t === null);
  return {
    translations,
    provider: translator.provider,
    model: translator.model,
    ...(partial && { warning: 'Ücretsiz çeviri kotası doldu; bazı başlıklar çevrilemedi.' }),
  };
}

module.exports = { translatorFromEnv, translationResponse };
