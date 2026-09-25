"""Fetch NLTK's data files — safe to run every time (skips what's already there).

Also works around the classic macOS Python issue where stdlib SSL has no
root certificates configured, which makes any HTTPS download fail with
CERTIFICATE_VERIFY_FAILED: it points Python at the certifi bundle first.
"""
import os

try:
    import certifi

    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
except ImportError:
    pass  # certifi is in requirements.txt; if missing, the download below will just retry with the system store.

import nltk

RESOURCES = {
    "tokenizers/punkt_tab": "punkt_tab",
    "taggers/averaged_perceptron_tagger_eng": "averaged_perceptron_tagger_eng",
    "corpora/wordnet": "wordnet",
    "corpora/omw-1.4": "omw-1.4",
    "corpora/cmudict": "cmudict",
}

for resource_path, package in RESOURCES.items():
    try:
        nltk.data.find(resource_path)
        print(f"{package}: already installed, skipping.")
    except LookupError:
        print(f"{package}: downloading...")
        nltk.download(package)

print("NLTK data ready.")
