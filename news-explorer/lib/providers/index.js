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
  mastodon: 'https://mastodon.social,https://journa.host,https://mastodon.world,https://mstdn.social,https://mastodon.online',
};

// Sıra aynı zamanda öncelik sırasıdır: aynı haber birden çok kaynakta çıkarsa ilk sıradaki gösterilir.
function createProviders({ feeds = [], disabled = [] } = {}) {
  return [
    { ...google, available: true },
    { ...gdelt, available: true },
    { ...bing, available: true },
    createFeedProvider({ kind: 'news', feeds }),
    createFeedProvider({ kind: 'social', feeds }),
    createFeedProvider({ kind: 'factcheck', feeds }),
    mastodon,
    reddit,
    hn,
  ].map((p) => (disabled.includes(p.id) ? { ...p, available: false } : p));
}

const describe = (providers) => providers.filter((p) => p.available).map(({ id, label, kind, defaultOn }) => ({ id, label, kind, defaultOn: defaultOn !== false }));

// İstekte kaynak belirtilmezse tüm kullanılabilir kaynaklar çalışır.
function selectProviders(providers, ids) {
  const usable = providers.filter((p) => p.available);
  if (!ids.length) return usable.filter((p) => p.defaultOn !== false);
  return usable.filter((p) => ids.includes(p.id));
}

module.exports = { createProviders, selectProviders, describe, DEFAULT_BASES };
