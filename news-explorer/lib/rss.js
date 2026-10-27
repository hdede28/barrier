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

const first = (xml, names) => {
  for (const n of names) {
    const v = tag(xml, n);
    if (v) return v;
  }
  return '';
};

const attr = (xml, name, a) => {
  const m = new RegExp(`<${name}\\s[^>]*${a}="([^"]*)"`, 'i').exec(xml);
  return m ? decode(m[1]) : '';
};

const isHttpUrl = (u) => /^https?:\/\//i.test(u);

// HTML'i düz metne çevirir (sosyal medya gönderileri ve açıklamalar için).
const plain = (html) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// RSS: <link>url</link>. Atom: <link rel="alternate" href="url"/>.
function linkOf(block) {
  const text = tag(block, 'link');
  if (isHttpUrl(text)) return text;
  const links = [...block.matchAll(/<link\s[^>]*>/gi)].map((m) => m[0]);
  const alt = links.find((l) => /rel="alternate"/i.test(l)) || links.find((l) => !/rel=/i.test(l)) || links[0];
  const href = alt && /href="([^"]*)"/i.exec(alt);
  return href ? decode(href[1]) : '';
}

// Bing, gerçek adresi apiclick yönlendirmesinin url= parametresinde taşır.
function unwrapBing(link) {
  try {
    const u = new URL(link);
    if (/(^|\.)bing\.com$/.test(u.hostname) && u.pathname.includes('/apiclick')) {
      const real = u.searchParams.get('url');
      if (real && isHttpUrl(real)) return real;
    }
  } catch { /* geçersiz adres: olduğu gibi bırak */ }
  return link;
}

// RSS 2.0, RDF ve Atom çıktısını [{title, link, source, sourceUrl, published, summary}] listesine çevirir.
// limit: yeterli haber toplanınca ayrıştırmayı bırakır (Worker CPU süresini kısa tutar).
function parseFeed(xml, limit = Infinity) {
  const items = [];
  const re = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m;
  while (items.length < limit && (m = re.exec(xml))) {
    const block = m[2];
    const link = unwrapBing(linkOf(block));
    if (!isHttpUrl(link)) continue;
    const source = plain(first(block, ['source', 'News:Source']) || tag(tag(block, 'author'), 'name'));
    const summary = plain(first(block, ['description', 'summary', 'content', 'media:description']));
    let title = plain(tag(block, 'title'));
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    // Başlıksız gönderiler (Mastodon, Bluesky): metnin başı başlık olur.
    if (!title && summary) title = summary.length > 200 ? `${summary.slice(0, 197)}…` : summary;
    if (!title) continue;
    const date = new Date(first(block, ['pubDate', 'dc:date', 'published', 'updated']));
    items.push({
      title,
      link,
      source,
      sourceUrl: attr(block, 'source', 'url'),
      published: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      summary: summary.slice(0, 400),
    });
  }
  return items;
}

module.exports = { parseRss: parseFeed, parseFeed, decode, plain };
