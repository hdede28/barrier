// LinguaPath — external API integrations (from the public-apis list).
//
// No-auth APIs (Free Dictionary, Wiktionary, LibreTranslate, English Random
// Words) are called directly and work out of the box.
//
// Key-based APIs (Words API / RapidAPI, Google Cloud Natural Language) need
// the viewer's OWN free-tier key, entered in Settings and stored only in
// localStorage on their machine — this app has no backend to keep a shared
// key safe, so no key ships with the code.

const API_KEYS_STORAGE = "linguapath_api_keys_v1";

function loadApiKeys() {
  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { rapidApiKey: "", googleNlKey: "" };
}

function saveApiKeys(keys) {
  try {
    localStorage.setItem(API_KEYS_STORAGE, JSON.stringify(keys));
  } catch (e) {}
}

const apiKeys = loadApiKeys();

// ------------------------------------------------------------------
// Local NLTK backend (server/app.py) — free, no API key, runs on your
// own machine. All NLTK-backed functions below try this first and fall
// back to the cloud/key-based APIs (or a friendly error) if it's not
// running.
// ------------------------------------------------------------------
const NLTK_BASE_URL = "http://127.0.0.1:5001";
let nltkAvailable = null; // null = unknown, true/false once checked

async function checkNltkBackend() {
  try {
    const res = await fetch(`${NLTK_BASE_URL}/api/health`, { signal: AbortSignal.timeout(1200) });
    nltkAvailable = res.ok;
  } catch (e) {
    nltkAvailable = false;
  }
  return nltkAvailable;
}

// ------------------------------------------------------------------
// Free Dictionary API (no key) — https://dictionaryapi.dev/
// Falls back to Wiktionary's REST API if the word isn't found.
// ------------------------------------------------------------------
async function lookupWord(word) {
  const clean = word.toLowerCase().replace(/[^a-z'-]/g, "");
  if (!clean) return null;

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`
    );
    if (res.ok) {
      const data = await res.json();
      const entry = data[0];
      const phonetic =
        entry.phonetic || (entry.phonetics.find((p) => p.text) || {}).text || "";
      const audio = (entry.phonetics.find((p) => p.audio) || {}).audio || "";
      const meanings = entry.meanings.slice(0, 3).map((m) => ({
        partOfSpeech: m.partOfSpeech,
        definition: m.definitions[0]?.definition || "",
        example: m.definitions[0]?.example || "",
        synonyms: (m.definitions[0]?.synonyms || m.synonyms || []).slice(0, 5),
      }));
      return { word: clean, phonetic, audio, meanings, source: "Free Dictionary" };
    }
  } catch (e) {}

  // Fallback: Wiktionary
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(clean)}`
    );
    if (res.ok) {
      const data = await res.json();
      const enEntries = data.en || Object.values(data)[0] || [];
      const meanings = enEntries.slice(0, 3).map((m) => ({
        partOfSpeech: m.partOfSpeech,
        definition: (m.definitions[0]?.definition || "").replace(/<[^>]+>/g, ""),
        example: "",
        synonyms: [],
      }));
      return { word: clean, phonetic: "", audio: "", meanings, source: "Wiktionary" };
    }
  } catch (e) {}

  return null;
}

// ------------------------------------------------------------------
// LibreTranslate (no key) — https://libretranslate.com/docs
// Public community mirror; if it's down, translation fails gracefully.
// ------------------------------------------------------------------
async function translateText(text, targetLang = "tr") {
  const endpoints = ["https://libretranslate.de/translate", "https://translate.argosopentech.com/translate"];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: "en", target: targetLang, format: "text" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translatedText) return data.translatedText;
      }
    } catch (e) {}
  }
  return null;
}

// ------------------------------------------------------------------
// English Random Words (no key) — random-words-api.vercel.app
// Used to feed the flashcard module with fresh vocabulary.
// ------------------------------------------------------------------
async function getRandomWord() {
  try {
    const res = await fetch("https://random-words-api.vercel.app/word");
    if (res.ok) {
      const data = await res.json();
      const item = Array.isArray(data) ? data[0] : data;
      return item?.word || null;
    }
  } catch (e) {}
  return null;
}

// ------------------------------------------------------------------
// Words API via RapidAPI (needs the viewer's own key) — wordsapi.com
// ------------------------------------------------------------------
async function getSynonyms(word) {
  if (nltkAvailable !== false) {
    try {
      const res = await fetch(`${NLTK_BASE_URL}/api/synonyms/${encodeURIComponent(word)}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        nltkAvailable = true;
        const data = await res.json();
        return { synonyms: data.synonyms || [], source: "NLTK WordNet (yerel)" };
      }
    } catch (e) {
      nltkAvailable = false;
    }
  }

  if (!apiKeys.rapidApiKey) return { error: "no-key" };
  try {
    const res = await fetch(
      `https://wordsapiv1.p.rapidapi.com/words/${encodeURIComponent(word)}/synonyms`,
      {
        headers: {
          "X-RapidAPI-Key": apiKeys.rapidApiKey,
          "X-RapidAPI-Host": "wordsapiv1.p.rapidapi.com",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      return { synonyms: data.synonyms || [], source: "Words API" };
    }
    return { error: "request-failed", status: res.status };
  } catch (e) {
    return { error: "network" };
  }
}

// ------------------------------------------------------------------
// Google Cloud Natural Language API (needs the viewer's own key)
// https://cloud.google.com/natural-language/docs/
// ------------------------------------------------------------------
async function analyzeSentence(text) {
  if (nltkAvailable !== false) {
    try {
      const res = await fetch(`${NLTK_BASE_URL}/api/pos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        nltkAvailable = true;
        const data = await res.json();
        return { tokens: data.tokens, source: "NLTK (yerel)" };
      }
    } catch (e) {
      nltkAvailable = false;
    }
  }

  if (!apiKeys.googleNlKey) return { error: "no-key" };
  try {
    const res = await fetch(
      `https://language.googleapis.com/v1/documents:analyzeSyntax?key=${encodeURIComponent(apiKeys.googleNlKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: { type: "PLAIN_TEXT", content: text },
          encodingType: "UTF8",
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const tokens = (data.tokens || []).map((t) => ({
        word: t.text.content,
        partOfSpeech: t.partOfSpeech.tag,
      }));
      return { tokens, source: "Google Cloud NL" };
    }
    const err = await res.json().catch(() => ({}));
    return { error: "request-failed", message: err?.error?.message || res.status };
  } catch (e) {
    return { error: "network" };
  }
}

// ------------------------------------------------------------------
// NLTK-only extras: pronunciation coaching, readability scoring, and
// auto-generated cloze (fill-in-the-blank) exercises from any text.
// These have no cloud equivalent wired in — they simply do nothing
// useful if the local backend isn't running.
// ------------------------------------------------------------------
async function getPronunciationHelp(word) {
  try {
    const res = await fetch(`${NLTK_BASE_URL}/api/pronunciation/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      nltkAvailable = true;
      return await res.json();
    }
  } catch (e) {
    nltkAvailable = false;
  }
  return null;
}

async function getReadability(text) {
  try {
    const res = await fetch(`${NLTK_BASE_URL}/api/readability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      nltkAvailable = true;
      return await res.json();
    }
  } catch (e) {
    nltkAvailable = false;
  }
  return null;
}

async function generateCloze(text) {
  try {
    const res = await fetch(`${NLTK_BASE_URL}/api/generate-cloze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      nltkAvailable = true;
      return await res.json();
    }
    return { error: (await res.json().catch(() => ({}))).error || "request-failed" };
  } catch (e) {
    nltkAvailable = false;
    return { error: "network" };
  }
}
