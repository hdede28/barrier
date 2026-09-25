#!/bin/bash
# Double-click this file to set up and start the NLTK backend — no manual
# Terminal commands needed. Safe to double-click again later: it skips
# steps that are already done (existing venv, already-installed packages,
# already-downloaded NLTK data) and just starts the server.
set -e
cd "$(dirname "$0")/server"

echo "== LinguaPath NLTK sunucusu kurulum/başlatma =="

if [ ! -d "venv" ]; then
  echo "-> Sanal ortam oluşturuluyor (ilk kurulum, birkaç saniye sürebilir)..."
  python3 -m venv venv
fi

source venv/bin/activate

echo "-> Gerekli paketler kontrol ediliyor..."
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo "-> NLTK verileri kontrol ediliyor (eksikse indirilir)..."
python3 setup_nltk.py

echo ""
echo "== Sunucu başlıyor: http://127.0.0.1:5001 =="
echo "Bu pencereyi kapatmayın; uygulamadaki NLTK özellikleri bu pencere açıkken çalışır."
echo "Durdurmak için: Control + C"
echo ""
python3 app.py
