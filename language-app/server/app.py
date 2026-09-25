"""LinguaPath NLP backend — powers grammar/vocab features with NLTK.

Runs entirely locally: no external API keys, no cloud services.
Replaces the paid/key-gated Words API + Google Cloud NL calls in the
front end with free WordNet, POS-tagging and CMU pronunciation data.
"""
import random

import nltk
from flask import Flask, jsonify, request
from flask_cors import CORS
from nltk import pos_tag, word_tokenize
from nltk.corpus import cmudict, wordnet

app = Flask(__name__)
CORS(app)

_CMU = None


def get_cmu():
    global _CMU
    if _CMU is None:
        _CMU = cmudict.dict()
    return _CMU


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "engine": "nltk"})


@app.post("/api/pos")
def analyze_pos():
    """Tokenize + part-of-speech tag a sentence (replaces Google Cloud NL)."""
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "missing-text"}), 400
    tokens = word_tokenize(text)
    tagged = pos_tag(tokens)
    return jsonify({"tokens": [{"word": w, "partOfSpeech": t} for w, t in tagged]})


@app.get("/api/synonyms/<word>")
def synonyms(word):
    """WordNet-based synonyms (replaces the RapidAPI Words API)."""
    word = word.lower().strip()
    lemmas = set()
    for syn in wordnet.synsets(word):
        for lemma in syn.lemmas():
            name = lemma.name().replace("_", " ")
            if name.lower() != word:
                lemmas.add(name)
    return jsonify({"word": word, "synonyms": sorted(lemmas)[:12]})


@app.get("/api/definition/<word>")
def definition(word):
    """WordNet definitions, as an extra free dictionary source."""
    word = word.lower().strip()
    meanings = []
    for syn in wordnet.synsets(word)[:5]:
        meanings.append(
            {
                "partOfSpeech": syn.pos(),
                "definition": syn.definition(),
                "examples": syn.examples()[:1],
            }
        )
    return jsonify({"word": word, "meanings": meanings})


_ARPABET_TO_TR = {
    # Rough ARPAbet -> Turkish-friendly phonetic hints for pronunciation coaching.
    "AA": "a", "AE": "a (ince)", "AH": "ı/a", "AO": "o", "AW": "au",
    "AY": "ay", "EH": "e", "ER": "ır", "EY": "ey", "IH": "i (kısa)",
    "IY": "i", "OW": "o", "OY": "oy", "UH": "u (kısa)", "UW": "u",
    "B": "b", "CH": "ç", "D": "d", "DH": "d (yumuşak th)", "F": "f",
    "G": "g", "HH": "h", "JH": "c", "K": "k", "L": "l", "M": "m",
    "N": "n", "NG": "ng", "P": "p", "R": "r", "S": "s", "SH": "ş",
    "T": "t", "TH": "s (sert th)", "V": "v", "W": "w", "Y": "y", "Z": "z",
    "ZH": "j",
}


@app.get("/api/pronunciation/<word>")
def pronunciation(word):
    """CMU Pronouncing Dictionary phonemes + a Turkish-speaker cheat sheet."""
    word = word.lower().strip()
    entries = get_cmu().get(word)
    if not entries:
        return jsonify({"word": word, "found": False})
    phones = entries[0]
    stripped = [p.rstrip("012") for p in phones]
    hints = [_ARPABET_TO_TR.get(p, p.lower()) for p in stripped]
    return jsonify(
        {
            "word": word,
            "found": True,
            "arpabet": phones,
            "turkishHints": hints,
        }
    )


def _syllable_count(word):
    word = word.lower()
    vowels = "aeiouy"
    count = 0
    prev_was_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_was_vowel:
            count += 1
        prev_was_vowel = is_vowel
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


@app.post("/api/readability")
def readability():
    """Flesch Reading Ease + Flesch-Kincaid grade, mapped to a CEFR-ish level.

    Useful for auto-estimating the difficulty of any text a user pastes in,
    instead of relying only on the fixed placement-test result.
    """
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "missing-text"}), 400

    sentences = [s for s in nltk.sent_tokenize(text) if s.strip()]
    words = [w for w in word_tokenize(text) if any(c.isalpha() for c in w)]
    if not sentences or not words:
        return jsonify({"error": "not-enough-text"}), 400

    syllables = sum(_syllable_count(w) for w in words)
    n_sentences, n_words = len(sentences), len(words)

    flesch = 206.835 - 1.015 * (n_words / n_sentences) - 84.6 * (syllables / n_words)
    grade = 0.39 * (n_words / n_sentences) + 11.8 * (syllables / n_words) - 15.59

    if flesch >= 80:
        level = "beginner"
    elif flesch >= 50:
        level = "intermediate"
    else:
        level = "advanced"

    return jsonify(
        {
            "fleschReadingEase": round(flesch, 1),
            "fleschKincaidGrade": round(grade, 1),
            "estimatedLevel": level,
            "sentences": n_sentences,
            "words": n_words,
        }
    )


_FILLER_WORDS = {
    "VB": ["run", "make", "take", "give", "see"],
    "VBD": ["walked", "jumped", "arrived", "opened", "finished"],
    "VBG": ["running", "making", "taking", "giving", "seeing"],
    "VBN": ["taken", "given", "seen", "done", "made"],
    "VBP": ["run", "make", "take", "give", "see"],
    "VBZ": ["runs", "makes", "takes", "gives", "sees"],
    "NN": ["table", "moment", "reason", "result", "effort"],
    "NNS": ["tables", "moments", "reasons", "results", "efforts"],
    "JJ": ["quick", "calm", "distant", "careful", "simple"],
}


@app.post("/api/generate-cloze")
def generate_cloze():
    """Turn any passage into a fill-in-the-blank grammar exercise.

    Picks a content word (verb/noun/adjective) via POS tagging, blanks it
    out, and builds distractors from other same-POS words already in the
    text so every option at least looks grammatically plausible.
    """
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "missing-text"}), 400

    tokens = word_tokenize(text)
    tagged = pos_tag(tokens)
    target_tags = {"VB", "VBD", "VBG", "VBN", "VBP", "VBZ", "NN", "NNS", "JJ"}
    candidates = [
        (i, w, t) for i, (w, t) in enumerate(tagged) if t in target_tags and w.isalpha() and len(w) > 3
    ]
    if not candidates:
        return jsonify({"error": "no-candidates"}), 400

    idx, word, tag = random.choice(candidates)
    same_tag_pool = sorted({w for i, w, t in candidates if t == tag and w.lower() != word.lower()})
    distractors = random.sample(same_tag_pool, k=min(3, len(same_tag_pool)))

    filler_pool = [w for w in _FILLER_WORDS.get(tag, []) if w.lower() != word.lower() and w not in distractors]
    random.shuffle(filler_pool)
    while len(distractors) < 3 and filler_pool:
        distractors.append(filler_pool.pop())

    blanked = tokens.copy()
    blanked[idx] = "____"
    sentence = " ".join(blanked).replace(" .", ".").replace(" ,", ",")

    options = distractors + [word]
    random.shuffle(options)

    return jsonify({"sentence": sentence, "answer": word, "options": options, "partOfSpeech": tag})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)
