'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { HttpError } = require('./query');

const REASONS = ['offtopic', 'wrongcountry', 'source', 'other'];
const MODES = ['search', 'breaking', 'maarif', 'radar'];
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

// Kullanıcı geri bildirimi ("bu haber alakasız"). Kişisel veri tutulmaz: IP yalnızca hız sınırı için bellekte sayılır.
// Kayıtlar bellekte (son 1000) ve (yazılabiliyorsa) bir JSONL dosyasında tutulur; Render'da dosya yeniden başlatmada silinir.
// Okumak için ADMIN_TOKEN gerekir; verilmezse okuma kapalıdır.
function createFeedbackStore({ file, adminToken, max = 1000, perMinute = 20 } = {}) {
  const records = [];
  const hits = new Map();
  const target = file === 'off' ? null : file || path.join(os.tmpdir(), 'haber-atlasi-feedback.jsonl');

  function allow(ip) {
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || now - h.start > 60000) { hits.set(ip, { start: now, n: 1 }); if (hits.size > 5000) hits.delete(hits.keys().next().value); return true; }
    return ++h.n <= perMinute;
  }

  function add(body, ip = '') {
    const reason = REASONS.includes(body?.reason) ? body.reason : null;
    const title = clip(body?.title, 300);
    if (!reason || !title) throw new HttpError(400, 'Geçersiz geri bildirim.');
    if (!allow(ip)) throw new HttpError(429, 'Çok fazla geri bildirim gönderildi; biraz sonra tekrar dene.');
    const rec = {
      at: new Date().toISOString(), reason, title, source: clip(body.source, 80), lang: clip(body.lang, 8), topic: clip(body.topic, 20),
      country: clip(body.country, 8), mode: MODES.includes(body.mode) ? body.mode : 'search',
    };
    records.push(rec);
    if (records.length > max) records.shift();
    if (target) { try { fs.appendFileSync(target, `${JSON.stringify(rec)}\n`); } catch { /* yazılamıyorsa bellekte kalır */ } }
    return { ok: true };
  }

  function authorized(token) {
    if (!adminToken || typeof token !== 'string') return false;
    const a = crypto.createHash('sha256').update(token).digest();
    const b = crypto.createHash('sha256').update(adminToken).digest();
    return crypto.timingSafeEqual(a, b);
  }

  // Yöneticiye: hangi kaynak/başlıklar en çok işaretlendi? (süzgeci ve sözlüğü iyileştirmek için)
  function report(token) {
    if (!adminToken) throw new HttpError(404, 'Bulunamadı');
    if (!authorized(token)) throw new HttpError(403, 'Yetkisiz');
    const count = (key, reason) => {
      const m = new Map();
      for (const r of records) if (!reason || r.reason === reason) m.set(r[key], (m.get(r[key]) || 0) + 1);
      return [...m].filter(([k]) => k).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, n]) => ({ name, n }));
    };
    return {
      total: records.length,
      byReason: count('reason'),
      topSourcesReported: count('source', 'source'),
      topTopicsOffTopic: count('topic', 'offtopic'),
      recentOffTopic: records.filter((r) => r.reason === 'offtopic').slice(-40).reverse(),
    };
  }

  return { add, report, size: () => records.length };
}

module.exports = { createFeedbackStore, REASONS };
