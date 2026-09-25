# LinguaPath NLP backend (NLTK)

A tiny local Flask server that gives the LinguaPath app real NLP features
using [NLTK](https://www.nltk.org/) — completely free, no API key, runs on
your own machine. It replaces the paid/key-gated Words API and Google
Cloud Natural Language calls whenever it's running.

## What it adds

| Endpoint | Feature |
|---|---|
| `GET /api/synonyms/<word>` | WordNet synonyms — powers "Eş Anlamlı Öner" in Writing |
| `POST /api/pos` | Part-of-speech tagging — powers "Cümle Analizi" in Writing |
| `GET /api/definition/<word>` | WordNet definitions (extra dictionary source) |
| `GET /api/pronunciation/<word>` | CMU Pronouncing Dictionary + a Turkish-speaker phonetic cheat sheet — powers the pronunciation helper in Speaking |
| `POST /api/readability` | Flesch reading-ease score → estimated CEFR-ish level for any text — powers "Zorluk Seviyesini Ölç" in Reading |
| `POST /api/generate-cloze` | Auto-generates a fill-in-the-blank grammar exercise from any passage (POS-based blanking + real-word distractors) — powers "Bu Metinden Alıştırma Üret" in Reading |

## Setup (macOS / Linux)

```bash
cd language-app/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 setup_nltk.py    # downloads NLTK's data files (one-time)
python3 app.py           # starts the server on http://127.0.0.1:5001
```

Leave this running in its own terminal tab. Then open `language-app/index.html`
(served over `http://localhost:...`, see the main README) in your browser as
usual — the app auto-detects the backend and lights up the NLTK-powered
buttons. If the server isn't running, those buttons just show a message
telling you to start it; nothing else in the app breaks.

## Windows

```powershell
cd language-app\server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python setup_nltk.py
python app.py
```

## Notes

- The server binds to `127.0.0.1` only — it isn't reachable from other
  machines on your network.
- `flask-cors` is enabled so the app (served on a different port) can call
  it from the browser.
- This is a development server (`app.run(debug=False)`), fine for local,
  single-user use; it isn't meant to be deployed publicly.
