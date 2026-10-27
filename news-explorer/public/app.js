'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const el = {
    form: $('search'), country: $('country'), city: $('city'), cityCustom: $('cityCustom'), cityCustomWrap: $('cityCustomWrap'),
    countryNote: $('countryNote'), lang: $('lang'), viewOriginal: $('viewOriginal'), viewTr: $('viewTr'), langNote: $('langNote'), topic: $('topic'), range: $('range'), from: $('from'), to: $('to'), keyword: $('keyword'), go: $('go'),
    status: $('status'), timeline: $('timeline'), toolbar: $('toolbar'), filter: $('filter'), sort: $('sort'), list: $('list'),
  };
  const CUSTOM_CITY = '__custom';
  const fmtMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
  const fmtMonthShort = new Intl.DateTimeFormat('tr-TR', { month: 'short', year: '2-digit' });
  const fmtDay = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  let meta;
  let data = null;
  let activeWindow = null;
  let controller = null;
  let view = 'original';
  let searchedCountry = '';
  let translationOn = false;
  const translations = new Map(); // orijinal başlık -> Türkçe
  let translateRun = 0;

  const store = {
    get() { try { return JSON.parse(localStorage.getItem('haber-atlasi') || '{}'); } catch { return {}; } },
    set(v) { try { localStorage.setItem('haber-atlasi', JSON.stringify(v)); } catch { /* özel pencere vb. */ } },
  };

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const option = (value, text, selected) => Object.assign(document.createElement('option'), { value, textContent: text, selected: !!selected });

  // Türkiye başta, diğerleri Türkçe alfabeye göre.
  function fillCountries(selected) {
    const sorted = meta.countries.slice().sort((a, b) =>
      (b.code === 'TR') - (a.code === 'TR') || a.name.localeCompare(b.name, 'tr'));
    el.country.replaceChildren(...sorted.map((c) => option(c.code, `${c.flag} ${c.name}`, c.code === selected)));
  }

  function syncCountryNote() {
    el.countryNote.hidden = !meta.countries.find((c) => c.code === el.country.value)?.approximate;
  }

  function fillCities(selectedCity) {
    const c = meta.countries.find((x) => x.code === el.country.value);
    const known = c.cities.includes(selectedCity);
    el.city.replaceChildren(
      option('', 'Tüm ülke', !selectedCity),
      ...c.cities.map((n) => option(n, n, n === selectedCity)),
      option(CUSTOM_CITY, 'Başka şehir…', !!selectedCity && !known),
    );
    el.cityCustom.value = selectedCity && !known ? selectedCity : '';
    syncCustomCity();
  }

  function syncCustomCity() {
    el.cityCustomWrap.hidden = el.city.value !== CUSTOM_CITY;
  }

  function syncCustomRange() {
    const custom = el.range.value === 'custom';
    document.querySelectorAll('.custom-date').forEach((n) => { n.hidden = !custom; });
  }

  const selectedCity = () => (el.city.value === CUSTOM_CITY ? el.cityCustom.value.trim() : el.city.value);

  function currentRange() {
    if (el.range.value === 'custom') return { from: el.from.value, to: el.to.value };
    return { from: iso(daysAgo(Number(el.range.value) - 1)), to: iso(new Date()) };
  }

  function setStatus(text, kind, extra) {
    el.status.hidden = !text;
    el.status.className = `status${kind ? ` ${kind}` : ''}`;
    el.status.replaceChildren(text || '');
    if (extra) el.status.append(' ', Object.assign(document.createElement('code'), { textContent: extra }));
  }

  function writeUrl(params) {
    const qs = new URLSearchParams(params);
    history.replaceState(null, '', `${location.pathname}?${qs}`);
  }

  async function runSearch() {
    const range = currentRange();
    if (!range.from || !range.to) return setStatus('Özel aralık için başlangıç ve bitiş tarihini seç.', 'error');
    if (range.from > range.to) return setStatus('Başlangıç tarihi bitişten sonra olamaz.', 'error');

    const ui = { country: el.country.value, city: selectedCity(), topic: el.topic.value, range: el.range.value, q: el.keyword.value.trim() };
    if (ui.range === 'custom') Object.assign(ui, range);
    store.set(ui);
    writeUrl(Object.fromEntries(Object.entries(ui).filter(([, v]) => v)));

    controller?.abort();
    controller = new AbortController();
    el.go.disabled = true;
    el.go.textContent = 'Getiriliyor…';
    setStatus('Haberler getiriliyor…');
    el.timeline.hidden = el.toolbar.hidden = true;
    el.list.replaceChildren();

    try {
      const params = new URLSearchParams({ country: ui.country, city: ui.city, topic: ui.topic, q: ui.q, from: range.from, to: range.to });
      const res = await fetch(`/api/news?${params}`, { signal: controller.signal });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Sunucu hatası (${res.status})`);
      data = body;
      activeWindow = null;
      view = 'original';
      translateRun++;
      searchedCountry = ui.country;
      render();
    } catch (err) {
      if (err.name === 'AbortError') return;
      data = null;
      setStatus(err.message || 'Bir hata oluştu.', 'error');
    } finally {
      el.go.disabled = false;
      el.go.textContent = 'Haberleri getir';
    }
  }

  function render() {
    if (!data) return;
    const failed = data.windows.filter((w) => w.error).length;
    const note = failed ? ` ${failed} dönem alınamadı.` : '';
    setStatus(`${data.total} haber bulundu.${note} Arama:`, failed ? 'error' : '', data.query);
    renderTimeline();

    const q = el.filter.value.trim().toLocaleLowerCase('tr');
    let items = data.items.filter((it) =>
      (activeWindow === null || it.window === activeWindow) &&
      (!q || `${it.title} ${translations.get(it.title) || ''} ${it.source}`.toLocaleLowerCase('tr').includes(q)));
    if (el.sort.value === 'asc') items = items.slice().reverse();

    el.toolbar.hidden = data.total === 0;
    syncLang();
    el.list.replaceChildren(...(items.length ? renderGroups(items) : [emptyState(data.total)]));
  }

  function emptyState(total) {
    return Object.assign(document.createElement('p'), {
      className: 'empty',
      textContent: total ? 'Filtreye uyan haber yok.' : 'Bu seçimle haber bulunamadı. Başka bir dönem, konu veya şehir dene.',
    });
  }

  function renderTimeline() {
    if (data.windows.length < 2) { el.timeline.hidden = true; return; }
    const max = Math.max(1, ...data.windows.map((w) => w.count));
    const bars = data.windows.map((w, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `bar${w.error ? ' err' : ''}`;
      b.setAttribute('aria-pressed', String(activeWindow === i));
      b.title = `${w.from} – ${w.to}: ${w.error ? w.error : `${w.count} haber`}`;
      b.setAttribute('aria-label', b.title);
      const fill = document.createElement('i');
      fill.style.height = `${w.error ? 100 : Math.max(3, (w.count / max) * 100)}%`;
      const label = document.createElement('span');
      label.textContent = fmtMonthShort.format(new Date(`${w.from}T12:00:00`));
      b.append(fill, label);
      b.addEventListener('click', () => { activeWindow = activeWindow === i ? null : i; render(); });
      return b;
    });
    const title = Object.assign(document.createElement('h2'), { textContent: 'Zaman çizelgesi — bir döneme tıklayarak süz' });
    const wrap = Object.assign(document.createElement('div'), { className: 'bars' });
    wrap.append(...bars);
    el.timeline.replaceChildren(title, wrap);
    el.timeline.hidden = false;
  }

  function renderGroups(items) {
    const byMonth = data.windows.length > 1;
    const fmt = byMonth ? fmtMonth : fmtDay;
    const groups = [];
    let last = null;
    for (const it of items) {
      const label = it.published ? fmt.format(new Date(it.published)) : 'Tarihsiz';
      if (label !== last) { groups.push({ label, items: [] }); last = label; }
      groups.at(-1).items.push(it);
    }
    return groups.map((g) => {
      const sec = Object.assign(document.createElement('section'), { className: 'group' });
      const h = document.createElement('h3');
      h.append(g.label, Object.assign(document.createElement('small'), { textContent: `${g.items.length} haber` }));
      sec.append(h, ...g.items.map(card));
      return sec;
    });
  }

  function card(it) {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = /^https?:\/\//i.test(it.link) ? it.link : '#';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    const tr = view === 'tr' ? translations.get(it.title) : null;
    const t = Object.assign(document.createElement('div'), { className: 't', textContent: tr || it.title, dir: 'auto' });
    const parts = [t];
    // Çeviri gösterilirken orijinal başlık da altta kalır.
    if (tr && tr !== it.title) parts.push(Object.assign(document.createElement('div'), { className: 'o', textContent: it.title, dir: 'auto' }));
    const m = document.createElement('div');
    m.className = 'm';
    if (it.source) m.append(Object.assign(document.createElement('span'), { className: 'src', textContent: it.source }));
    if (it.published) m.append(Object.assign(document.createElement('span'), { textContent: fmtTime.format(new Date(it.published)) }));
    a.append(...parts, m);
    return a;
  }

  // Orijinal | Türkçe geçişi: Türkiye seçiliyken gösterilmez.
  function syncLang() {
    const foreign = searchedCountry !== 'TR' && Boolean(data) && data.total > 0;
    el.lang.hidden = !foreign;
    el.viewOriginal.setAttribute('aria-pressed', String(view === 'original'));
    el.viewTr.setAttribute('aria-pressed', String(view === 'tr'));
    el.viewTr.disabled = !translationOn;
    el.viewTr.title = translationOn ? '' : 'Çeviri bu sunucuda kapalı';
    el.langNote.hidden = !foreign || translationOn;
    el.langNote.textContent = 'Türkçe çeviri için sunucuda ANTHROPIC_API_KEY tanımlı olmalı. Şimdilik başlıklar orijinal dilinde gösteriliyor.';
  }

  async function setView(next) {
    if (next === view || !data) return;
    const run = ++translateRun;
    if (next === 'original') { view = 'original'; return render(); }
    const pending = [...new Set(data.items.map((i) => i.title).filter((t) => t && !translations.has(t)))];
    el.viewTr.disabled = el.viewOriginal.disabled = true;
    try {
      for (let i = 0; i < pending.length; i += 40) {
        setStatus(`Türkçeye çevriliyor… ${Math.min(i + 40, pending.length)}/${pending.length}`);
        const chunk = pending.slice(i, i + 40);
        const res = await fetch('/api/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texts: chunk }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Çeviri başarısız (${res.status})`);
        chunk.forEach((t, k) => translations.set(t, body.translations[k]));
      }
      if (run !== translateRun) return;
      view = 'tr';
      render();
    } catch (err) {
      if (run !== translateRun) return;
      view = 'original';
      render();
      setStatus(`${err.message} Başlıklar orijinal dilinde gösteriliyor.`, 'error');
    } finally {
      el.viewOriginal.disabled = false;
      syncLang();
    }
  }

  async function init() {
    try {
      meta = await (await fetch('/api/meta')).json();
      translationOn = Boolean(meta.translation);
    } catch {
      return setStatus('Uygulama verileri yüklenemedi. Sunucunun çalıştığından emin ol.', 'error');
    }
    const q = Object.fromEntries(new URLSearchParams(location.search));
    const saved = { ...store.get(), ...q };

    fillCountries(meta.countries.some((c) => c.code === saved.country) ? saved.country : 'TR');
    fillCities(saved.city || '');
    syncCountryNote();
    el.topic.replaceChildren(...meta.topics.map((t) => option(t.id, `${t.icon} ${t.label}`, t.id === saved.topic)));
    if ([...el.range.options].some((o) => o.value === saved.range)) el.range.value = saved.range;
    el.from.value = saved.from || iso(daysAgo(365));
    el.to.value = saved.to || iso(new Date());
    el.to.max = iso(new Date());
    el.from.max = el.to.max;
    el.keyword.value = saved.q || '';
    syncCustomRange();

    el.country.addEventListener('change', () => { fillCities(''); syncCountryNote(); });
    el.city.addEventListener('change', () => { syncCustomCity(); if (el.city.value === CUSTOM_CITY) el.cityCustom.focus(); });
    el.range.addEventListener('change', syncCustomRange);
    el.filter.addEventListener('input', render);
    el.sort.addEventListener('change', render);
    el.viewOriginal.addEventListener('click', () => setView('original'));
    el.viewTr.addEventListener('click', () => setView('tr'));
    el.form.addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });

    if (q.country) runSearch(); // paylaşılan bağlantı: otomatik ara
  }

  init();
})();
