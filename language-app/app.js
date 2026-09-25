// LinguaPath — client-side English learning app.
// No backend: progress is stored in localStorage; audio uses the Web Speech API.

const STORAGE_KEY = "linguapath_state_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { level: null, xp: 0, streak: 0, lastActiveDay: null };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

const state = loadState();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function bumpStreak() {
  const today = todayStr();
  if (state.lastActiveDay === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak = state.lastActiveDay === yesterday ? state.streak + 1 : 1;
  state.lastActiveDay = today;
  saveState();
}

function addXp(amount) {
  state.xp += amount;
  bumpStreak();
  saveState();
  renderStats();
}

function renderStats() {
  document.getElementById("levelBadge").textContent =
    "Seviye: " + (state.level ? LEVEL_LABELS[state.level] : "—");
  document.getElementById("xpBadge").textContent = "⭐ XP: " + state.xp;
  document.getElementById("streakBadge").textContent = "🔥 Seri: " + state.streak;
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------------
// PLACEMENT TEST
// ------------------------------------------------------------------
let placementIndex = 0;
let placementScore = 0;
let placementOrder = [];

function startPlacementTest() {
  placementIndex = 0;
  placementScore = 0;
  placementOrder = shuffle(PLACEMENT_QUESTIONS);
  showScreen("screen-placement");
  renderPlacementQuestion();
}

function renderPlacementQuestion() {
  const total = placementOrder.length;
  document.getElementById("placementProgress").style.width =
    Math.round((placementIndex / total) * 100) + "%";

  if (placementIndex >= total) {
    finishPlacementTest();
    return;
  }

  const q = placementOrder[placementIndex];
  const card = document.getElementById("placementQuestionCard");
  card.innerHTML = `
    <div class="quiz-question">${placementIndex + 1}/${total}. ${q.q}</div>
    <div id="placementOptions"></div>
  `;
  const optsEl = document.getElementById("placementOptions");
  shuffle(q.options).forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.onclick = () => handlePlacementAnswer(opt, q, btn, optsEl);
    optsEl.appendChild(btn);
  });
}

function handlePlacementAnswer(selected, q, btn, container) {
  container.querySelectorAll("button").forEach((b) => (b.disabled = true));
  const correct = selected === q.answer;
  if (correct) {
    btn.classList.add("correct");
    placementScore += q.weight;
  } else {
    btn.classList.add("incorrect");
    container.querySelectorAll("button").forEach((b) => {
      if (b.textContent === q.answer) b.classList.add("correct");
    });
  }
  setTimeout(() => {
    placementIndex++;
    renderPlacementQuestion();
  }, 700);
}

function finishPlacementTest() {
  const maxScore = PLACEMENT_QUESTIONS.reduce((s, q) => s + q.weight, 0);
  const ratio = placementScore / maxScore;
  let level;
  if (ratio < 0.35) level = "beginner";
  else if (ratio < 0.7) level = "intermediate";
  else level = "advanced";

  state.level = level;
  addXp(10);

  document.getElementById("resultLevel").textContent = LEVEL_LABELS[level];
  document.getElementById("resultMessage").textContent =
    level === "beginner"
      ? "Temel gramer ve kelime bilginle harika bir başlangıç yapabilirsin!"
      : level === "intermediate"
      ? "Sağlam bir temelin var — akıcılığını geliştirmeye odaklanabilirsin."
      : "Güçlü bir seviyedesin! İnce nüansları ve akademik dili geliştirebilirsin.";

  showScreen("screen-result");
}

// ------------------------------------------------------------------
// DASHBOARD
// ------------------------------------------------------------------
function goDashboard() {
  if (!state.level) state.level = "intermediate";
  document.getElementById("dashLevel").textContent = LEVEL_LABELS[state.level];
  document.getElementById("levelSelect").value = state.level;
  saveState();
  renderStats();
  showScreen("screen-dashboard");
}

function ensureLevel() {
  if (!state.level) {
    state.level = "intermediate";
    saveState();
    renderStats();
    toast("Seviye testi atlandı, varsayılan olarak 'Orta Seviye' ayarlandı.");
  }
  return true;
}

// ------------------------------------------------------------------
// DICTIONARY POPUP (Free Dictionary API + Wiktionary fallback)
// ------------------------------------------------------------------
function makeClickableText(text) {
  return text.replace(/[A-Za-z']+/g, (word) => `<span class="word-link" data-word="${word}">${word}</span>`);
}

function wireClickableWords(root) {
  root.querySelectorAll(".word-link").forEach((el) => {
    el.addEventListener("click", () => showDictPopup(el.dataset.word));
  });
}

async function showDictPopup(word) {
  const popup = document.getElementById("dictPopup");
  const content = document.getElementById("dictPopupContent");
  content.innerHTML = `<p>"${word}" aranıyor…</p>`;
  popup.classList.add("show");

  const result = await lookupWord(word);
  if (!result) {
    content.innerHTML = `
      <h3>${word}</h3>
      <p>Sözlükte bulunamadı.</p>
      <button class="btn btn-secondary" id="btnCloseDictPopup">Kapat</button>`;
  } else {
    const meaningsHtml = result.meanings
      .map(
        (m) => `
        <div class="meaning-block">
          <div class="meaning-pos">${m.partOfSpeech}</div>
          <div>${m.definition}</div>
          ${m.example ? `<div class="tip-text">"${m.example}"</div>` : ""}
          ${m.synonyms.length ? `<div class="tip-text">Eş anlamlı: ${m.synonyms.join(", ")}</div>` : ""}
        </div>`
      )
      .join("");
    content.innerHTML = `
      <h3>${result.word} ${result.phonetic ? `<span class="tip-text">${result.phonetic}</span>` : ""}
        ${result.audio ? `<button class="dict-audio-btn" id="btnPlayDictAudio">🔊</button>` : ""}
      </h3>
      ${meaningsHtml}
      <div class="tip-text">Kaynak: ${result.source}</div>
      <button class="btn btn-secondary" id="btnCloseDictPopup">Kapat</button>
    `;
    if (result.audio) {
      document.getElementById("btnPlayDictAudio").onclick = () => new Audio(result.audio).play();
    }
  }
  document.getElementById("btnCloseDictPopup").onclick = () => popup.classList.remove("show");
}

// ------------------------------------------------------------------
// READING
// ------------------------------------------------------------------
function openReading() {
  if (!ensureLevel()) return;
  showScreen("screen-reading");
  const passages = READING[state.level];
  const passage = passages[Math.floor(Math.random() * passages.length)];
  const container = document.getElementById("readingContent");

  container.innerHTML = `
    <h3>${passage.title}</h3>
    <div class="passage-text" id="passageText">${makeClickableText(passage.text)}</div>
    <button class="inline-btn" id="btnTranslatePassage">🌐 Türkçeye Çevir</button>
    <div id="translationBox"></div>
    <div id="readingQuestions"></div>
  `;
  wireClickableWords(document.getElementById("passageText"));

  document.getElementById("btnTranslatePassage").onclick = async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = "Çevriliyor…";
    const translated = await translateText(passage.text, "tr");
    btn.disabled = false;
    btn.textContent = "🌐 Türkçeye Çevir";
    const box = document.getElementById("translationBox");
    box.innerHTML = translated
      ? `<div class="api-result-box">${translated}</div>`
      : `<div class="api-result-box">Çeviri servisine şu anda ulaşılamıyor, tekrar deneyin.</div>`;
  };

  const qContainer = document.getElementById("readingQuestions");
  let answered = 0;
  let correctCount = 0;

  passage.questions.forEach((q, idx) => {
    const block = document.createElement("div");
    block.className = "quiz-card";
    block.style.marginBottom = "16px";
    block.innerHTML = `<div class="quiz-question">${idx + 1}. ${q.q}</div>`;
    shuffle(q.options).forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt;
      btn.onclick = () => {
        block.querySelectorAll("button").forEach((b) => (b.disabled = true));
        if (opt === q.answer) {
          btn.classList.add("correct");
          correctCount++;
        } else {
          btn.classList.add("incorrect");
          block.querySelectorAll("button").forEach((b) => {
            if (b.textContent === q.answer) b.classList.add("correct");
          });
        }
        answered++;
        if (answered === passage.questions.length) {
          addXp(correctCount * 5);
          toast(`Okuma tamamlandı! ${correctCount}/${passage.questions.length} doğru. +${correctCount * 5} XP`);
        }
      };
      block.appendChild(btn);
    });
    qContainer.appendChild(block);
  });
}

// ------------------------------------------------------------------
// WRITING (fill in the blank)
// ------------------------------------------------------------------
let writingIndex = 0;
let writingSet = [];
let writingCorrect = 0;

function openWriting() {
  if (!ensureLevel()) return;
  writingIndex = 0;
  writingCorrect = 0;
  writingSet = shuffle(WRITING[state.level]);
  showScreen("screen-writing");
  renderWritingQuestion();
}

function renderWritingQuestion() {
  const total = writingSet.length;
  document.getElementById("writingProgress").style.width =
    Math.round((writingIndex / total) * 100) + "%";

  const container = document.getElementById("writingContent");
  if (writingIndex >= total) {
    container.innerHTML = `
      <div class="summary-card">
        <h3>Tamamlandı! ✍️</h3>
        <p>${writingCorrect}/${total} doğru cevap.</p>
        <button class="btn btn-primary" onclick="openWriting()">Tekrar Dene</button>
      </div>`;
    return;
  }

  const item = writingSet[writingIndex];
  container.innerHTML = `
    <div class="quiz-question">${writingIndex + 1}/${total}. ${item.sentence}</div>
    <div id="writingOptions"></div>
    <button class="inline-btn" id="btnSynonyms">🔎 Eş Anlamlı Öner (Words API)</button>
    <button class="inline-btn" id="btnAnalyze">🧠 Cümle Analizi (Google NL)</button>
    <div id="writingApiResult"></div>
  `;
  const optsEl = document.getElementById("writingOptions");

  document.getElementById("btnSynonyms").onclick = async () => {
    const box = document.getElementById("writingApiResult");
    box.innerHTML = `<div class="api-result-box">Aranıyor…</div>`;
    const res = await getSynonyms(item.answer.split(" ")[0]);
    if (res.error === "no-key") {
      box.innerHTML = `<div class="api-result-box">Bu özellik için Ayarlar (⚙️) menüsünden ücretsiz bir Words API (RapidAPI) anahtarı ekleyin.</div>`;
    } else if (res.error) {
      box.innerHTML = `<div class="api-result-box">İstek başarısız oldu (${res.status || res.error}).</div>`;
    } else {
      box.innerHTML = `<div class="api-result-box">Eş anlamlılar: ${res.synonyms.length ? res.synonyms.join(", ") : "bulunamadı"}</div>`;
    }
  };

  document.getElementById("btnAnalyze").onclick = async () => {
    const box = document.getElementById("writingApiResult");
    box.innerHTML = `<div class="api-result-box">Analiz ediliyor…</div>`;
    const plain = item.sentence.replace(/___[^.]*/, item.answer);
    const res = await analyzeSentence(plain);
    if (res.error === "no-key") {
      box.innerHTML = `<div class="api-result-box">Bu özellik için Ayarlar (⚙️) menüsünden ücretsiz bir Google Cloud Natural Language anahtarı ekleyin.</div>`;
    } else if (res.error) {
      box.innerHTML = `<div class="api-result-box">İstek başarısız oldu: ${res.message || res.error}.</div>`;
    } else {
      const tags = res.tokens.map((t) => `${t.word}<span class="tip-text">/${t.partOfSpeech}</span>`).join(" ");
      box.innerHTML = `<div class="api-result-box">${tags}</div>`;
    }
  };
  shuffle(item.options).forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.onclick = () => {
      optsEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
      if (opt === item.answer) {
        btn.classList.add("correct");
        writingCorrect++;
        addXp(4);
      } else {
        btn.classList.add("incorrect");
        optsEl.querySelectorAll("button").forEach((b) => {
          if (b.textContent === item.answer) b.classList.add("correct");
        });
      }
      setTimeout(() => {
        writingIndex++;
        renderWritingQuestion();
      }, 700);
    };
    optsEl.appendChild(btn);
  });
}

// ------------------------------------------------------------------
// LISTENING (speechSynthesis + comprehension question)
// ------------------------------------------------------------------
let listeningIndex = 0;
let listeningSet = [];
let listeningCorrect = 0;

function speak(text) {
  if (!("speechSynthesis" in window)) {
    toast("Bu tarayıcı sesli okumayı desteklemiyor.");
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
}

function openListening() {
  if (!ensureLevel()) return;
  listeningIndex = 0;
  listeningCorrect = 0;
  listeningSet = shuffle(LISTENING[state.level]);
  showScreen("screen-listening");
  renderListeningQuestion();
}

function renderListeningQuestion() {
  const total = listeningSet.length;
  document.getElementById("listeningProgress").style.width =
    Math.round((listeningIndex / total) * 100) + "%";

  const container = document.getElementById("listeningContent");
  if (listeningIndex >= total) {
    container.innerHTML = `
      <div class="summary-card">
        <h3>Tamamlandı! 🎧</h3>
        <p>${listeningCorrect}/${total} doğru cevap.</p>
        <button class="btn btn-primary" onclick="openListening()">Tekrar Dene</button>
      </div>`;
    return;
  }

  const item = listeningSet[listeningIndex];
  container.innerHTML = `
    <p>Aşağıdaki cümleyi dinle ve soruyu cevapla:</p>
    <button class="btn btn-secondary" id="playBtn">🔊 Cümleyi Oynat</button>
    <div class="quiz-question" style="margin-top:16px;">${listeningIndex + 1}/${total}. ${item.q}</div>
    <div id="listeningOptions"></div>
  `;
  document.getElementById("playBtn").onclick = () => speak(item.text);
  speak(item.text);

  const optsEl = document.getElementById("listeningOptions");
  shuffle(item.options).forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = opt;
    btn.onclick = () => {
      optsEl.querySelectorAll("button").forEach((b) => (b.disabled = true));
      if (opt === item.answer) {
        btn.classList.add("correct");
        listeningCorrect++;
        addXp(4);
      } else {
        btn.classList.add("incorrect");
        optsEl.querySelectorAll("button").forEach((b) => {
          if (b.textContent === item.answer) b.classList.add("correct");
        });
      }
      setTimeout(() => {
        listeningIndex++;
        renderListeningQuestion();
      }, 900);
    };
    optsEl.appendChild(btn);
  });
}

// ------------------------------------------------------------------
// SPEAKING (SpeechRecognition + similarity scoring for pronunciation)
// ------------------------------------------------------------------
let speakingIndex = 0;
let speakingSet = [];
let recognizer = null;

function normalizeText(s) {
  return s.toLowerCase().replace(/[^a-z0-9' ]/g, "").trim();
}

// Levenshtein distance based similarity, word-level.
function similarity(a, b) {
  const wa = normalizeText(a).split(/\s+/);
  const wb = normalizeText(b).split(/\s+/);
  const m = wa.length, n = wb.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        wa[i - 1] === wb[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const dist = dp[m][n];
  const maxLen = Math.max(m, n) || 1;
  return Math.max(0, 1 - dist / maxLen);
}

function getRecognizer() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = "en-US";
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

function openSpeaking() {
  if (!ensureLevel()) return;
  speakingIndex = 0;
  speakingSet = shuffle(SPEAKING[state.level]);
  showScreen("screen-speaking");
  renderSpeakingQuestion();
}

function renderSpeakingQuestion() {
  const total = speakingSet.length;
  document.getElementById("speakingProgress").style.width =
    Math.round((speakingIndex / total) * 100) + "%";

  const container = document.getElementById("speakingContent");
  if (speakingIndex >= total) {
    container.innerHTML = `
      <div class="summary-card">
        <h3>Tamamlandı! 🎤</h3>
        <p>Tüm cümleleri tamamladın.</p>
        <button class="btn btn-primary" onclick="openSpeaking()">Tekrar Dene</button>
      </div>`;
    return;
  }

  const item = speakingSet[speakingIndex];
  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  container.innerHTML = `
    <div class="target-phrase">${speakingIndex + 1}/${total}. "${item.text}"</div>
    <div class="tip-text">💡 ${item.tip}</div>
    <div class="speak-controls">
      <button class="btn btn-secondary" id="listenTargetBtn">🔊 Örneği Dinle</button>
      ${supported ? '<button class="mic-btn" id="micBtn" title="Kaydet">🎤</button>' : ""}
    </div>
    ${!supported ? '<p class="tip-text">Bu tarayıcı konuşma tanımayı desteklemiyor. Chrome kullanmayı deneyin.</p>' : ""}
    <div class="transcript-box" id="transcriptBox">Söylediğiniz burada görünecek…</div>
    <div id="scoreArea"></div>
    <div style="margin-top:16px;">
      <button class="btn btn-link" id="skipBtn">Sonraki Cümle →</button>
    </div>
  `;

  document.getElementById("listenTargetBtn").onclick = () => speak(item.text);
  document.getElementById("skipBtn").onclick = () => {
    speakingIndex++;
    renderSpeakingQuestion();
  };

  if (supported) {
    const micBtn = document.getElementById("micBtn");
    micBtn.onclick = () => recordSpeech(item.text, micBtn);
  }
}

function recordSpeech(targetText, micBtn) {
  if (recognizer) {
    try { recognizer.stop(); } catch (e) {}
  }
  recognizer = getRecognizer();
  if (!recognizer) {
    toast("Konuşma tanıma bu tarayıcıda kullanılamıyor.");
    return;
  }

  micBtn.classList.add("listening");
  document.getElementById("transcriptBox").textContent = "Dinleniyor…";

  recognizer.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById("transcriptBox").textContent = `"${transcript}"`;
    const score = similarity(transcript, targetText);
    showPronScore(score);
  };

  recognizer.onerror = (event) => {
    toast("Mikrofon hatası: " + event.error);
  };

  recognizer.onend = () => {
    micBtn.classList.remove("listening");
  };

  recognizer.start();
}

function showPronScore(score) {
  const pct = Math.round(score * 100);
  const area = document.getElementById("scoreArea");
  let cls = "low", msg = "Tekrar dene, biraz daha net telaffuz et.";
  if (pct >= 80) { cls = "good"; msg = "Harika telaffuz! 🎉"; addXp(6); }
  else if (pct >= 50) { cls = "mid"; msg = "İyi, ama biraz daha pratik yapabilirsin."; addXp(3); }
  area.innerHTML = `<div class="pron-score ${cls}">Telaffuz Skoru: %${pct}</div><div class="feedback">${msg}</div>`;
}

// ------------------------------------------------------------------
// FLASHCARDS (English Random Words API + Free Dictionary API)
// ------------------------------------------------------------------
async function openFlashcards() {
  if (!ensureLevel()) return;
  showScreen("screen-flashcards");
  await loadNextFlashcard();
}

async function loadNextFlashcard() {
  const container = document.getElementById("flashcardContent");
  container.innerHTML = `<div class="flashcard"><p>Kelime yükleniyor…</p></div>`;

  const word = await getRandomWord();
  if (!word) {
    container.innerHTML = `
      <div class="flashcard">
        <p>Kelime servisine şu anda ulaşılamıyor.</p>
        <button class="btn btn-primary" onclick="loadNextFlashcard()">Tekrar Dene</button>
      </div>`;
    return;
  }

  const entry = await lookupWord(word);
  const meaning = entry?.meanings?.[0];

  container.innerHTML = `
    <div class="flashcard">
      <div class="flashcard-word">${word} ${entry?.audio ? `<button class="dict-audio-btn" id="btnPlayCardAudio">🔊</button>` : ""}</div>
      <div class="flashcard-phonetic">${entry?.phonetic || ""}</div>
      ${
        meaning
          ? `<div class="meaning-block"><div class="meaning-pos">${meaning.partOfSpeech}</div><div>${meaning.definition}</div>${meaning.example ? `<div class="tip-text">"${meaning.example}"</div>` : ""}</div>`
          : `<p class="tip-text">Tanım bulunamadı.</p>`
      }
      <div style="margin-top:16px;">
        <button class="btn btn-secondary" onclick="loadNextFlashcard()">😕 Bilmiyordum</button>
        <button class="btn btn-primary" id="btnKnewIt">✅ Biliyordum</button>
      </div>
    </div>
  `;
  if (entry?.audio) {
    document.getElementById("btnPlayCardAudio").onclick = () => new Audio(entry.audio).play();
  }
  document.getElementById("btnKnewIt").onclick = () => {
    addXp(2);
    loadNextFlashcard();
  };
}

// ------------------------------------------------------------------
// SETTINGS (API keys)
// ------------------------------------------------------------------
function openSettings() {
  document.getElementById("rapidApiKeyInput").value = apiKeys.rapidApiKey || "";
  document.getElementById("googleNlKeyInput").value = apiKeys.googleNlKey || "";
  document.getElementById("settingsModal").classList.add("show");
}

function closeSettings() {
  document.getElementById("settingsModal").classList.remove("show");
}

function saveSettings() {
  apiKeys.rapidApiKey = document.getElementById("rapidApiKeyInput").value.trim();
  apiKeys.googleNlKey = document.getElementById("googleNlKeyInput").value.trim();
  saveApiKeys(apiKeys);
  toast("Ayarlar kaydedildi.");
  closeSettings();
}

// ------------------------------------------------------------------
// NAVIGATION WIRING
// ------------------------------------------------------------------
function openSkill(skill) {
  if (skill === "reading") openReading();
  else if (skill === "writing") openWriting();
  else if (skill === "listening") openListening();
  else if (skill === "speaking") openSpeaking();
  else if (skill === "flashcards") openFlashcards();
}

document.addEventListener("DOMContentLoaded", () => {
  renderStats();

  document.getElementById("btnStartPlacement").onclick = startPlacementTest;
  document.getElementById("btnGoDashboard").onclick = goDashboard;
  document.getElementById("btnRetakeTest").onclick = startPlacementTest;
  document.getElementById("levelSelect").onchange = (e) => {
    state.level = e.target.value;
    saveState();
    goDashboard();
    toast("Seviye değiştirildi: " + LEVEL_LABELS[state.level]);
  };

  document.querySelectorAll(".skill-card").forEach((card) => {
    card.addEventListener("click", () => openSkill(card.dataset.skill));
  });

  document.querySelectorAll(".btn-back").forEach((btn) => {
    btn.addEventListener("click", goDashboard);
  });

  document.getElementById("btnSettings").onclick = openSettings;
  document.getElementById("btnCloseSettings").onclick = closeSettings;
  document.getElementById("btnSaveSettings").onclick = saveSettings;

  if (state.level) {
    goDashboard();
  }
});
