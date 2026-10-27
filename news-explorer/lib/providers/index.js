'use strict';

const google = require('./google');
const gdelt = require('./gdelt');
const bing = require('./bing');
const { createFeedProvider } = require('./feeds');
const { mastodon, reddit, hn } = require('./social');

const DEFAULT_BASES = {
  google: 'https://news.google.com',
  gdelt: 'https://api.gdeltproject.org',
  bing: 'https://www.bing.com',
  reddit: 'https://www.reddit.com',
  hn: 'https://hn.algolia.com',
  mastodon: 'https://mastodon.social,https://journa.host',
};

// Sıra aynı zamanda öncelik sırasıdır: aynı haber birden çok kaynakta çıkarsa ilk sıradaki gösterilir.
function createProviders({ feeds = [] } = {}) {
  return [
    { ...google, available: true },
    { ...gdelt, available: true },
    { ...bing, available: true },
    createFeedProvider({ kind: 'news', feeds }),
    createFeedProvider({ kind: 'social', feeds }),
    mastodon,
    reddit,
    hn,
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
