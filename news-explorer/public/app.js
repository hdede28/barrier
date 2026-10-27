'use strict';

(() => {
  const $ = (id) => document.getElementById(id);
  const el = {
    form: $('search'), tabs: $('tabs'), country: $('country'), city: $('city'), cityCustom: $('cityCustom'), cityCustomWrap: $('cityCustomWrap'),
    countryNote: $('countryNote'), lang: $('lang'), viewOriginal: $('viewOriginal'), viewTr: $('viewTr'), langNote: $('langNote'),
    topic: $('topic'), range: $('range'), from: $('from'), to: $('to'), keyword: $('keyword'), go: $('go'), hours: $('hours'),
    hoursWrap: $('hoursWrap'), autoWrap: $('autoWrap'), auto: $('auto'), lastUpdate: $('lastUpdate'), maarifBox: $('maarifBox'), maarifNames: $('maarifNames'),
    tstrict: $('tstrict'), topicStrictWrap: $('topicStrictWrap'), srcNotes: $('srcNotes'), version: $('version'),
    kind: $('kind'), place: $('place'), strict: $('strict'), strictWrap: $('strictWrap'), worldNote: $('worldNote'), hiddenNote: $('hiddenNote'),
    hiddenText: $('hiddenText'), showHidden: $('showHidden'), sourceBoxes: $('sourceBoxes'), srcSummary: $('srcSummary'),
    status: $('status'), timeline: $('timeline'), toolbar: $('toolbar'), filter: $('filter'), sort: $('sort'), list: $('list'),
  };
  const CUSTOM_CITY = '__custom';
  const AUTO_REFRESH_MS = 90000;
  const SEARCH_TIMEOUT_MS = 60000; // bu süre dolarsa beklemeyi bırakır, o ana kadar gelenleri korur
  const GO_LABEL = { search: 'Haberleri getir', breaking: 'Son dakikayı getir', maarif: 'Maarif haberlerini getir' };
  const fmtMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
  const fmtMonthShort = new Intl.DateTimeFormat('tr-TR', { month: 'short', year: '2-digit' });
  const fmtDay = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtClock = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });

  let meta;
  let mode = 'search'; // 'search' | 'breaking' | 'maarif'
  let data = null;
  let activeWindow = null;
  let controller = null;
  let loading = false;
  let view = 'original';
  let provider = false; // 'claude' | 'mymemory' | false
  let autoTimer = null;
  let seen = new Set(); // son dakikada daha önce gösterilen bağlantılar
  let fresh = new Set(); // bu yenilemede ilk kez görünenler
  const translations = new Map(); // orijinal başlık -> Türkçe
  let translateRun = 0;

  const store = {
    get() { try { return JSON.parse(localStorage.getItem('haber-atlasi') || '{}'); } catch { return {}; } },
    set(v) { try { localStorage.setItem('haber-atlasi', JSON.stringify(v)); } catch { /* özel pencere vb. */ } },
  };

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const option = (value, text, selected) => Object.assign(document.createElement('option'), { value, textContent: text, selected: !!selected });
  const node = (tag, props, ...children) => { const n = Object.assign(document.createElement(tag), props); n.append(...children); return n; };

  const isWorld = () => el.country.value === meta.world?.code;

  // Sekmeye göre alanlar: data-modes="search breaking" olan öğeler yalnızca o modlarda görünür; ek koşullar aşağıda.
  function syncFields() {
    document.querySelectorAll('[data-modes]').forEach((n) => { n.hidden = !n.dataset.modes.split(' ').includes(mode); });
    const searchLike = mode !== 'maarif';
    const world = searchLike && isWorld();
    el.countryNote.hidden = !searchLike || world || !meta.countries.find((c) => c.code === el.country.value)?.approximate;
    el.worldNote.hidden = !world;
    el.city.closest('label').hidden = !searchLike || world;
    el.cityCustomWrap.hidden = !searchLike || world || el.city.value !== CUSTOM_CITY;
    el.strictWrap.hidden = !searchLike || world;
    el.topicStrictWrap.hidden = !searchLike || el.topic.value === 'general';
    const custom = el.range.value === 'custom' && mode !== 'breaking';
    document.querySelectorAll('.custom-date').forEach((n) => { n.hidden = !custom; });
    el.go.textContent = loading ? 'Getiriliyor…' : GO_LABEL[mode];
    el.tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  }

  // Kaynak seçimi: varsayılan hepsi açık; seçim tarayıcıda hatırlanır.
  function renderSourceBoxes(selected) {
    if (selected && !selected.some((id) => meta.sources.some((x) => x.id === id))) selected = null; // eski/geçersiz kayıt: hepsi açık
    el.sourceBoxes.replaceChildren(...meta.sources.map((src) => {
      const label = document.createElement('label');
      const box = Object.assign(document.createElement('input'), { type: 'checkbox', value: src.id, checked: selected ? selected.includes(src.id) : src.defaultOn !== false });
      label.append(box, src.label);
      if (src.kind === 'social') label.append(node('small', { textContent: '(doğrulanmamış olabilir)' }));
      return label;
    }));
  }

  const checkedSources = () => [...el.sourceBoxes.querySelectorAll('input:checked')].map((b) => b.value);

  // Haberlerde birden çok ülke varsa (dünya araması) ülkeye göre süzme listesi.
  function renderPlaces() {
    const counts = new Map();
    data.items.forEach((i) => i.place && counts.set(i.place, (counts.get(i.place) || 0) + 1));
    const prev = el.place.value;
    el.place.hidden = counts.size < 2;
    el.place.replaceChildren(option('all', `Tüm ülkeler (${counts.size})`, true),
      ...[...counts].sort((a, b) => b[1] - a[1]).map(([name, n]) => option(name, `${name} (${n})`, false)));
    el.place.value = counts.has(prev) ? prev : 'all';
  }

  function renderSourceSummary() {
    const list = data?.sources || [];
    el.srcSummary.hidden = !list.length;
    el.srcSummary.replaceChildren(...list.map((src) => {
      const li = document.createElement('li');
      if (src.pending) {
        li.className = 'pending';
        li.textContent = `${src.label} …`;
      } else if (src.error) {
        li.className = 'err';
        li.textContent = `${src.label}: alınamadı`;
      } else if (src.skipped) {
        li.className = 'skip';
        li.textContent = `${src.label}: atlandı`;
      } else {
        li.append(`${src.label} `, node('b', { textContent: src.found }));
      }
      return li;
    }));
    // Hata, atlama nedeni ve notlar tooltip'te değil, ekranda görünür (telefonda tooltip yok).
    const notes = list.flatMap((src) => [
      src.error && { text: `${src.label}: ${src.error}` },
      src.skipped && { text: `${src.label}: ${src.skipped}`, info: true },
      src.note && !src.error && { text: `${src.label}: ${src.note}`, info: true },
      !src.pending && !src.error && src.ms > 6000 && { text: `${src.label}: yavaş yanıt verdi (${Math.round(src.ms / 1000)} sn)`, info: true },
    ]).filter(Boolean);
    el.srcNotes.hidden = !notes.length;
    el.srcNotes.replaceChildren(...notes.map((n) => node('li', { className: n.info ? 'info' : '', textContent: n.text })));
  }

  // Türkiye başta, diğerleri Türkçe alfabeye göre.
  function fillCountries(selected) {
    const sorted = meta.countries.slice().sort((a, b) =>
      (b.code === 'TR') - (a.code === 'TR') || a.name.localeCompare(b.name, 'tr'));
    const world = meta.world ? [option(meta.world.code, `${meta.world.flag} ${meta.world.name}`, meta.world.code === selected)] : [];
    el.country.replaceChildren(...world, ...sorted.map((c) => option(c.code, `${c.flag} ${c.name}`, c.code === selected)));
  }

  function fillCities(selectedCity) {
    const c = meta.countries.find((x) => x.code === el.country.value);
    if (!c) { el.city.replaceChildren(option('', '—', true)); el.cityCustom.value = ''; return; }
    const known = c.cities.includes(selectedCity);
    el.city.replaceChildren(
      option('', 'Tüm ülke', !selectedCity),
      ...c.cities.map((n) => option(n, n, n === selectedCity)),
      option(CUSTOM_CITY, 'Başka şehir…', !!selectedCity && !known),
    );
    el.cityCustom.value = selectedCity && !known ? selectedCity : '';
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
    if (extra) el.status.append(' ', node('code', { textContent: extra }));
  }

  function writeUrl(params) {
    history.replaceState(null, '', `${location.pathname}?${new URLSearchParams(params)}`);
  }

  function resetResults() {
    data = null;
    el.timeline.hidden = el.toolbar.hidden = el.srcSummary.hidden = el.srcNotes.hidden = el.hiddenNote.hidden = el.lang.hidden = el.langNote.hidden = true;
    el.list.replaceChildren();
    setStatus('');
  }

  // Son dakikada sayfa açıkken 90 sn'de bir sessizce yenilenir (sekme gizliyken beklenir).
  function scheduleAuto() {
    clearInterval(autoTimer);
    autoTimer = null;
    if (mode === 'breaking' && el.auto.checked) {
      autoTimer = setInterval(() => { if (!document.hidden && !loading) runSearch({ silent: true }); }, AUTO_REFRESH_MS);
    }
  }

  // Sonuçlar akış halinde (NDJSON) gelir: her kaynak bittikçe ara sonuç, sonunda "final". Akış desteklenmiyorsa tek yanıt.
  async function fetchNews(params, signal, onPartial) {
    if (!meta.stream || !window.ReadableStream) {
      const res = await fetch(`/api/news?${params}`, { signal });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Sunucu hatası (${res.status})`);
      return body;
    }
    params.set('stream', '1');
    const res = await fetch(`/api/news?${params}`, { signal });
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Sunucu hatası (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line);
        if (msg.type === 'partial') onPartial(msg.body);
        else if (msg.type === 'final') return msg.body;
        else if (msg.type === 'error') throw new Error(msg.error);
      }
      if (done) throw new Error('Bağlantı yarıda kesildi. Yeniden dene.');
    }
  }

  async function runSearch({ silent = false } = {}) {
    const breaking = mode === 'breaking';
    const range = breaking ? { from: '', to: '' } : currentRange();
    if (!breaking && (!range.from || !range.to)) return setStatus('Özel aralık için başlangıç ve bitiş tarihini seç.', 'error');
    if (!breaking && range.from > range.to) return setStatus('Başlangıç tarihi bitişten sonra olamaz.', 'error');

    const sources = checkedSources();
    if (!sources.length) return setStatus('En az bir haber kaynağı seç.', 'error');
    const all = sources.length === meta.sources.filter((x) => x.defaultOn !== false).length && sources.every((id) => meta.sources.find((x) => x.id === id)?.defaultOn !== false);
    const searchLike = mode !== 'maarif';
    const world = !searchLike || isWorld();
    const ui = {
      mode, country: searchLike ? el.country.value : '', city: world ? '' : selectedCity(), topic: searchLike ? el.topic.value : 'general',
      range: el.range.value, q: el.keyword.value.trim(), sources: all ? '' : sources.join(','), hours: breaking ? el.hours.value : '',
      strict: !world && !el.strict.checked ? '0' : '', tstrict: searchLike && el.topic.value !== 'general' && !el.tstrict.checked ? '0' : '',
    };
    if (ui.range === 'custom') Object.assign(ui, range);
    if (!silent) {
      store.set(ui);
      writeUrl(Object.fromEntries(Object.entries(ui).filter(([, v]) => v)));
    }

    controller?.abort();
    const mine = (controller = new AbortController());
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; mine.abort(); }, SEARCH_TIMEOUT_MS);
    const started = Date.now();
    // Hiç sonuç gelmediyse geçen süre görünür: "takıldı mı?" belirsizliği kalmasın.
    const ticker = silent ? null : setInterval(() => { if (!data) setStatus(`${breaking ? 'Son dakika haberleri' : 'Haberler'} getiriliyor… ${Math.round((Date.now() - started) / 1000)} sn`); }, 1000);
    loading = true;
    data = silent ? data : null;
    if (!silent) {
      syncFields();
      setStatus(breaking ? 'Son dakika haberleri getiriliyor…' : 'Haberler getiriliyor…');
      el.timeline.hidden = el.toolbar.hidden = el.srcSummary.hidden = el.srcNotes.hidden = el.hiddenNote.hidden = true;
      el.list.replaceChildren();
    }
    el.go.disabled = true;

    try {
      const params = new URLSearchParams({
        mode, country: ui.country || 'ALL', city: ui.city, topic: ui.topic, q: ui.q, sources: ui.sources, strict: ui.strict,
        tstrict: ui.tstrict, hours: ui.hours, from: range.from, to: range.to,
      });
      const body = await fetchNews(params, mine.signal, (partial) => {
        if (silent || mine !== controller) return;
        // Ara sonuç: o ana kadar bitmiş kaynakların haberleri hemen gösterilir.
        data = partial;
        activeWindow = null;
        view = 'original';
        render();
      });
      // Son dakika: önceki yenilemede görünmeyenler "YENİ" işaretlenir (ilk yüklemede işaret yok).
      const links = new Set(body.items.map((i) => i.link));
      fresh = silent || seen.size ? new Set([...links].filter((l) => !seen.has(l))) : new Set();
      seen = links;
      data = body;
      if (!silent) { activeWindow = null; translateRun++; if (view === 'tr') view = 'original'; }
      render();
      if (breaking) el.lastUpdate.textContent = `· son güncelleme ${fmtClock.format(new Date())}`;
    } catch (err) {
      if (err.name === 'AbortError' && !timedOut) return; // yeni bir arama başladı
      if (silent) { el.lastUpdate.textContent = '· yenileme başarısız, tekrar denenecek'; return; }
      const message = timedOut
        ? 'Sunucu zamanında yanıt vermedi (60 sn). Bazı kaynaklar yavaş olabilir; birkaç saniye sonra yeniden dene ya da kaynak sayısını azalt.'
        : err.message || 'Bir hata oluştu.';
      if (data?.items?.length) { render(); setStatus(`${message} Aşağıda o ana kadar gelen haberler var.`, 'error'); }
      else { data = null; setStatus(message, 'error'); }
    } finally {
      clearTimeout(timer);
      clearInterval(ticker);
      if (mine === controller) { loading = false; el.go.disabled = false; syncFields(); }
    }
  }

  const ago = (iso8601) => {
    const m = Math.round((Date.now() - Date.parse(iso8601)) / 60000);
    if (m < 1) return 'az önce';
    if (m < 60) return rtf.format(-m, 'minute');
    if (m < 1440) return rtf.format(-Math.round(m / 60), 'hour');
    return rtf.format(-Math.round(m / 1440), 'day');
  };

  const weight = (it) => it.story?.count ?? 1 + (it.alsoIn?.length || 0);

  function render() {
    if (!data) return;
    const failed = data.windows.filter((w) => w.error).length;
    const note = failed ? ` ${failed} dönem alınamadı.` : '';
    const wait = data.partial ? ` ${data.pending} kaynak bekleniyor…` : '';
    const head = data.mode === 'breaking' ? `${data.total} haber · son ${data.hours} saat.${note}${wait}` : `${data.total} haber bulundu.${note}${wait}`;
    const detail = data.mode === 'maarif' ? 'Türkiye Maarif Vakfı' : data.mode === 'breaking' ? '' : `Arama:`;
    const what = [el.city.value && el.city.value !== CUSTOM_CITY ? el.city.value : el.cityCustom.value.trim(), el.topic.value !== 'general' ? el.topic.selectedOptions[0]?.textContent.trim() : '', el.keyword.value.trim()].filter(Boolean).join(' · ');
    setStatus(`${head} ${detail}`.trim(), failed ? 'error' : '', data.mode === 'search' ? what : '');
    renderSourceSummary();
    const by = data.hiddenBy || {};
    el.hiddenNote.hidden = !data.hidden;
    el.hiddenText.textContent = `${data.hidden} haber gizlendi (${[by.country && `${by.country} başka ülkeyi konu alıyor`, by.topic && `${by.topic} seçilen konuyla ilgisiz`].filter(Boolean).join(', ')}).`;
    renderPlaces();
    renderTimeline();
    const hasSocial = data.items.some((i) => i.kind === 'social');
    el.kind.hidden = !hasSocial;
    if (!hasSocial) el.kind.value = 'all';

    const q = el.filter.value.trim().toLocaleLowerCase('tr');
    let items = data.items.filter((it) =>
      (activeWindow === null || it.window === activeWindow) &&
      (el.kind.value === 'all' || it.kind === el.kind.value) &&
      (el.place.value === 'all' || (it.place || '') === el.place.value) &&
      (!q || `${it.title} ${translations.get(it.title) || ''} ${it.source}`.toLocaleLowerCase('tr').includes(q)));
    if (el.sort.value === 'asc') items = items.slice().reverse();
    if (el.sort.value === 'sources') items = items.slice().sort((a, b) => weight(b) - weight(a));

    el.toolbar.hidden = data.total === 0;
    syncLang();
    el.list.replaceChildren(...(items.length ? renderGroups(items) : [emptyState(data.total)]));
  }

  function emptyState(total) {
    return node('p', {
      className: 'empty',
      textContent: total ? 'Filtreye uyan haber yok.' : data.mode === 'breaking'
        ? 'Seçilen sürede haber bulunamadı. Süreyi uzat ya da konu/şehir seçimini kaldır.'
        : 'Bu seçimle haber bulunamadı. Başka bir dönem, konu veya şehir dene.',
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
      b.append(fill, node('span', { textContent: fmtMonthShort.format(new Date(`${w.from}T12:00:00`)) }));
      b.addEventListener('click', () => { activeWindow = activeWindow === i ? null : i; render(); });
      return b;
    });
    el.timeline.replaceChildren(node('h2', { textContent: 'Zaman çizelgesi — bir döneme tıklayarak süz' }), node('div', { className: 'bars' }, ...bars));
    el.timeline.hidden = false;
  }

  function renderGroups(items) {
    if (data.mode === 'breaking') return [group(`Son ${data.hours} saat`, items)];
    const fmt = data.windows.length > 1 ? fmtMonth : fmtDay;
    const groups = [];
    let last = null;
    for (const it of items) {
      const label = it.published ? fmt.format(new Date(it.published)) : 'Tarihsiz';
      if (label !== last) { groups.push({ label, items: [] }); last = label; }
      groups.at(-1).items.push(it);
    }
    return groups.map((g) => group(g.label, g.items));
  }

  function group(label, items) {
    return node('section', { className: 'group' }, node('h3', {}, label, node('small', { textContent: `${items.length} haber` })), ...items.map(card));
  }

  function card(it) {
    const tr = view === 'tr' ? translations.get(it.title) : null;
    const href = /^https?:\/\//i.test(it.link) ? it.link : '#';
    const title = node('div', { className: 't', dir: 'auto' }, node('a', { href, target: '_blank', rel: 'noopener noreferrer', textContent: tr || it.title }));
    const parts = [title];
    // Çeviri gösterilirken orijinal başlık da altta kalır.
    if (tr && tr !== it.title) parts.push(node('div', { className: 'o', textContent: it.title, dir: 'auto' }));
    const m = node('div', { className: 'm' });
    const badge = (text, cls = '', t = '') => m.append(node('span', { className: `badge ${cls}`.trim(), textContent: text, title: t }));
    if (fresh.has(it.link)) badge('YENİ', 'new');
    if (it.kind === 'social') badge('Sosyal medya · doğrulanmamış', 'social');
    if (data.world && it.place) badge(it.place);
    if (it.source) m.append(node('span', { className: 'src', textContent: it.source }));
    if (it.published) {
      m.append(node('span', { textContent: data.mode === 'breaking' ? ago(it.published) : fmtTime.format(new Date(it.published)), title: fmtTime.format(new Date(it.published)) }));
    }
    const count = it.story?.count || 0;
    if (count > 1) badge(`${count} kaynakta`, 'story', 'Aynı haberi yayınlayan bağımsız haber kaynağı sayısı');
    else if (it.alsoIn?.length) badge(`+${it.alsoIn.length} kaynakta daha`, '', it.alsoIn.join(', '));
    parts.push(m);
    // Aynı haberi veren diğer kaynaklar: karşılaştırmak için bağlantılar
    const others = [...new Map((it.story?.also || []).filter((a) => a.source !== it.source).map((a) => [a.source, a])).values()];
    if (others.length) {
      parts.push(node('div', { className: 'also' }, 'Aynı haber:', ...others.map((a) => node('a', { href: /^https?:\/\//i.test(a.link) ? a.link : '#', target: '_blank', rel: 'noopener noreferrer', textContent: a.source }))));
    }
    return node('article', { className: `card${fresh.has(it.link) ? ' fresh' : ''}` }, ...parts);
  }

  // Orijinal | Türkçe geçişi: yalnızca Türkçe olmayan başlık varsa görünür.
  function syncLang() {
    const foreign = Boolean(data) && data.items.some((i) => (i.lang || 'tr') !== 'tr');
    el.lang.hidden = !foreign;
    el.viewOriginal.setAttribute('aria-pressed', String(view === 'original'));
    el.viewTr.setAttribute('aria-pressed', String(view === 'tr'));
    el.viewTr.disabled = !provider;
    el.viewTr.title = provider ? '' : 'Çeviri bu sunucuda kapalı';
    const note = provider === 'mymemory'
      ? 'Ücretsiz çeviri servisi kullanılıyor: günlük kotası sınırlı ve kalitesi daha basit olabilir. Kota dolarsa kalan başlıklar orijinal dilinde kalır.'
      : provider ? '' : 'Bu sunucuda çeviri kapalı. Başlıklar orijinal dilinde gösteriliyor.';
    el.langNote.hidden = !foreign || !note;
    el.langNote.textContent = note;
  }

  async function setView(next) {
    if (next === view || !data) return;
    const run = ++translateRun;
    if (next === 'original') { view = 'original'; return render(); }
    // Başlıklar kaynak dile göre gruplanır (ücretsiz servis kaynak dili ister); Türkçe olanlar çevrilmez.
    const langOf = new Map();
    data.items.forEach((i) => { if (i.title && !translations.has(i.title) && !langOf.has(i.title)) langOf.set(i.title, i.lang || 'tr'); });
    const groups = new Map();
    for (const [title, lang] of langOf) if (lang !== 'tr') groups.set(lang, [...(groups.get(lang) || []), title]);
    const jobs = [...groups].flatMap(([lang, titles]) => Array.from({ length: Math.ceil(titles.length / 40) }, (_, k) => ({ lang, chunk: titles.slice(k * 40, k * 40 + 40) })));
    const total = jobs.reduce((n, j) => n + j.chunk.length, 0);
    let done = 0;
    el.viewTr.disabled = el.viewOriginal.disabled = true;
    let warning = '';
    let failure = null;
    try {
      for (const { lang, chunk } of jobs) {
        setStatus(`Türkçeye çevriliyor… ${done}/${total}`);
        const res = await fetch('/api/translate', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ texts: chunk, source: lang }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Çeviri başarısız (${res.status})`);
        chunk.forEach((t, k) => { if (typeof body.translations[k] === 'string') translations.set(t, body.translations[k]); });
        done += chunk.length;
        if (body.warning) { warning = body.warning; break; } // kota doldu: kalanı denemenin anlamı yok
      }
    } catch (err) {
      failure = err;
    }
    if (run === translateRun) {
      const translated = data.items.filter((i) => translations.has(i.title)).length;
      // Hiç çeviri yoksa orijinalde kal; kısmi sonuç varsa göster ve uyar.
      view = translated ? 'tr' : 'original';
      render();
      if (failure || warning) {
        const msg = failure ? failure.message : warning;
        setStatus(translated ? `${msg} ${translated}/${data.total} haber çevrildi, kalanı orijinal dilinde.` : `${msg} Başlıklar orijinal dilinde gösteriliyor.`, 'error');
      }
    }
    el.viewOriginal.disabled = false;
    syncLang();
  }

  function setMode(next, { run = true } = {}) {
    if (next === mode) return;
    mode = next;
    seen = new Set();
    fresh = new Set();
    controller?.abort();
    resetResults();
    syncFields();
    scheduleAuto();
    if (run && (next === 'breaking' || next === 'maarif')) runSearch(); // bu sekmelerde varsayılanlarla hemen çalışır
    else writeUrl({ mode: next });
  }

  async function init() {
    try {
      meta = await (await fetch('/api/meta')).json();
      provider = meta.translation || false;
    } catch {
      return setStatus('Uygulama verileri yüklenemedi. Sunucunun çalıştığından emin ol.', 'error');
    }
    const q = Object.fromEntries(new URLSearchParams(location.search));
    const saved = { ...store.get(), ...q };

    fillCountries(meta.countries.some((c) => c.code === saved.country) || saved.country === meta.world?.code ? saved.country : 'TR');
    fillCities(saved.city || '');
    renderSourceBoxes(saved.sources ? saved.sources.split(',') : null);
    el.topic.replaceChildren(...meta.topics.map((t) => option(t.id, `${t.icon} ${t.label}`, t.id === saved.topic)));
    if ([...el.range.options].some((o) => o.value === saved.range)) el.range.value = saved.range;
    if ([...el.hours.options].some((o) => o.value === saved.hours)) el.hours.value = saved.hours;
    el.from.value = saved.from || iso(daysAgo(365));
    el.to.value = saved.to || iso(new Date());
    el.to.max = iso(new Date());
    el.from.max = el.to.max;
    el.keyword.value = saved.q || '';
    el.strict.checked = saved.strict !== '0';
    el.tstrict.checked = saved.tstrict !== '0';
    el.version.textContent = meta.version ? `Sürüm ${meta.version}` : '';
    el.maarifNames.replaceChildren(...Object.entries(meta.maarif?.names || {}).map(([lang, names]) => node('li', {}, node('b', { textContent: lang }), names.join(' · '))));

    // Paylaşılan bağlantıda mod adreste gelir; kayıtlı mod yalnızca adres boşsa kullanılmaz (her açılış "Arama" ile başlar).
    if (['breaking', 'maarif'].includes(q.mode)) mode = q.mode;
    syncFields();

    el.country.addEventListener('change', () => { fillCities(''); syncFields(); });
    el.city.addEventListener('change', () => { syncFields(); if (el.city.value === CUSTOM_CITY) el.cityCustom.focus(); });
    el.range.addEventListener('change', syncFields);
    el.topic.addEventListener('change', syncFields);
    el.filter.addEventListener('input', render);
    el.sort.addEventListener('change', render);
    el.place.addEventListener('change', render);
    el.kind.addEventListener('change', render);
    el.auto.addEventListener('change', scheduleAuto);
    el.showHidden.addEventListener('click', () => { el.strict.checked = false; el.tstrict.checked = false; runSearch(); });
    el.viewOriginal.addEventListener('click', () => setView('original'));
    el.viewTr.addEventListener('click', () => setView('tr'));
    el.tabs.addEventListener('click', (e) => { const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode); });
    el.form.addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });

    scheduleAuto();
    if (q.country || ['breaking', 'maarif'].includes(q.mode)) runSearch(); // paylaşılan bağlantı: otomatik ara
  }

  init();
})();
