#!/bin/bash
# Dubstep Studio'yu yerel bir sunucu ile başlatır ve tarayıcıda otomatik açar.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PORT=8420
URL="http://localhost:$PORT"

PYCMD=""
if command -v python3 >/dev/null 2>&1; then
  PYCMD=python3
elif command -v python >/dev/null 2>&1; then
  PYCMD=python
else
  echo "Python bulunamadı. Lütfen önce Python yükleyin: https://www.python.org/downloads/"
  read -p "Kapatmak için Enter'a basın..." _
  exit 1
fi

port_in_use() {
  (echo >"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# Port doluysa boş bir port bul.
while port_in_use "$PORT"; do
  PORT=$((PORT + 1))
  URL="http://localhost:$PORT"
done

echo "Dubstep Studio başlatılıyor: $URL"
echo "(Bu pencereyi kapatmak uygulamayı da durdurur.)"

"$PYCMD" -m http.server "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT

sleep 1

if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
else
  echo "Tarayıcınızda şu adresi açın: $URL"
fi

wait $SERVER_PID
