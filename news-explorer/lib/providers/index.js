'use strict';

const google = require('./google');
const gdelt = require('./gdelt');
const bing = require('./bing');
const { createFeedProvider } = require('./feeds');

const DEFAULT_BASES = {
  google: 'https://news.google.com',
  gdelt: 'https://api.gdeltproject.org',
  bing: 'https://www.bing.com',
};

// Sıra aynı zamanda öncelik sırasıdır: aynı haber birden çok kaynakta çıkarsa ilk sıradaki gösterilir.
function createProviders({ feeds = [] } = {}) {
  return [
    { ...google, available: true },
    { ...gdelt, available: true },
    { ...bing, available: true },
    createFeedProvider({ kind: 'news', feeds }),
    createFeedProvider({ kind: 'social', feeds }),
  ];
}

const describe = (providers) => providers.filter((p) => p.available).map(({ id, label, kind }) => ({ id, label, kind }));

// İstekte kaynak belirtilmezse tüm kullanılabilir kaynaklar çalışır.
function selectProviders(providers, ids) {
  const usable = providers.filter((p) => p.available);
  if (!ids.length) return usable;
  return usable.filter((p) => ids.includes(p.id));
}

module.exports = { createProviders, selectProviders, describe, DEFAULT_BASES };
