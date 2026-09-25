"""Run once after `pip install -r requirements.txt` to fetch NLTK's data files."""
import nltk

for pkg in ["punkt_tab", "averaged_perceptron_tagger_eng", "wordnet", "omw-1.4", "cmudict"]:
    nltk.download(pkg)

print("NLTK data ready.")
