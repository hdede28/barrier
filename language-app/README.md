# LinguaPath — English Learning App

A self-contained, client-side English learning web app: a placement test,
four skill modules (reading, writing, listening, speaking), and a
pronunciation checker built on the browser's Web Speech API.

## Run it

No build step or server required.

**Easiest way:** double-click `LinguaPath Başlat.command` (macOS) — it opens
`index.html` straight in Chrome. Everything works this way, including
microphone-based pronunciation checking: Chrome treats `file://` pages as a
secure context, so `SpeechRecognition` isn't blocked the way it is over
plain `http://`.

You can also just double-click `index.html` itself, or serve it if you
prefer:

```bash
cd language-app
python3 -m http.server 8000
# then open http://localhost:8000
```

## Features

- **Placement test** — 10 mixed-difficulty grammar questions assign a
  Beginner / Intermediate / Advanced level.
- **Reading** — level-appropriate passages with comprehension questions,
  click-to-define words, one-click Turkish translation, an NLTK-powered
  readability score, and auto-generated cloze exercises.
- **Writing** — fill-in-the-blank grammar exercises with instant feedback,
  plus synonym suggestions and sentence syntax analysis.
- **Listening** — sentences spoken via `speechSynthesis`, followed by a
  comprehension question.
- **Speaking** — a target sentence is shown/spoken, the user records
  themselves via `SpeechRecognition`, a word-level similarity score
  (Levenshtein distance) gives pronunciation feedback, and an NLTK-backed
  pronunciation guide breaks down the hardest word phonetically.
- **Flashcards** — endless vocabulary practice from a random-word API.
- **Progress** — XP and a daily streak, persisted in `localStorage`.

## External APIs

Wired in from the [public-apis](https://github.com/public-apis/public-apis)
list — see `api.js`:

- **No key needed**: Free Dictionary, Wiktionary (fallback), LibreTranslate,
  English Random Words.
- **Your own free key, entered in the ⚙️ Settings panel**: Words API
  (RapidAPI) and Google Cloud Natural Language — used only as a fallback
  when the local NLTK server (below) isn't running.

## Optional: local NLTK server (recommended)

Run `server/` (see `server/README.md`) for real WordNet synonyms, POS/syntax
analysis, pronunciation help, readability scoring, and auto-generated
exercises — all free, local, and without needing any API key at all. The
app auto-detects it; everything else keeps working if it's not running.

## Notes

- Speech recognition (`webkitSpeechRecognition`/`SpeechRecognition`) is
  currently best supported in Chrome-based browsers; other browsers will
  hide the microphone button and show a fallback message.
- All content lives in `data.js` — add more passages, exercises, or
  levels there without touching the app logic in `app.js`.
