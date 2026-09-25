#!/bin/bash
# Double-click this file in Finder to open LinguaPath directly — no Terminal
# commands needed. Prefers Chrome (best Web Speech API support); falls back
# to your default browser if Chrome isn't installed.
cd "$(dirname "$0")"

if open -Ra "Google Chrome" 2>/dev/null; then
  open -a "Google Chrome" "index.html"
else
  open "index.html"
fi
