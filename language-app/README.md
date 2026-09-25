# LinguaPath — English Learning App

A self-contained, client-side English learning web app: a placement test,
four skill modules (reading, writing, listening, speaking), and a
pronunciation checker built on the browser's Web Speech API.

## Run it

No build step or server required — just open `index.html` in a modern
browser (Chrome/Edge recommended for speech recognition support):

```bash
cd language-app
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly (`file://`) also works for everything except
speech recognition, which most browsers restrict to `http(s)://` or
`localhost` origins.

## Features

- **Placement test** — 10 mixed-difficulty grammar questions assign a
  Beginner / Intermediate / Advanced level.
- **Reading** — level-appropriate passages with comprehension questions.
- **Writing** — fill-in-the-blank grammar exercises with instant feedback.
- **Listening** — sentences spoken via `speechSynthesis`, followed by a
  comprehension question.
- **Speaking** — a target sentence is shown/spoken, the user records
  themselves via `SpeechRecognition`, and a word-level similarity score
  (Levenshtein distance) gives pronunciation feedback.
- **Progress** — XP and a daily streak, persisted in `localStorage`.

## Notes

- Speech recognition (`webkitSpeechRecognition`/`SpeechRecognition`) is
  currently best supported in Chrome-based browsers; other browsers will
  hide the microphone button and show a fallback message.
- All content lives in `data.js` — add more passages, exercises, or
  levels there without touching the app logic in `app.js`.
