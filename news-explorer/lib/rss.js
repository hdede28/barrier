'use strict';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function tag(xml, name) {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  if (!m) return '';
  const body = m[1].trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(body);
  return cdata ? cdata[1].trim() : decode(body);
}

const attr = (xml, name, a) => {
  const m = new RegExp(`<${name}\\s[^>]*${a}="([^"]*)"`, 'i').exec(xml);
  return m ? decode(m[1]) : '';
};

const isHttpUrl = (u) => /^https?:\/\//i.test(u);

// Google News RSS çıktısını [{title, link, source, sourceUrl, published}] listesine çevirir.
function parseRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const link = tag(block, 'link');
    if (!isHttpUrl(link)) continue;
    const source = tag(block, 'source');
    let title = tag(block, 'title');
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const date = new Date(tag(block, 'pubDate'));
    items.push({
      title,
      link,
      source,
      sourceUrl: attr(block, 'source', 'url'),
      published: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    });
  }
  return items;
}

module.exports = { parseRss };
