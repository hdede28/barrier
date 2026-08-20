#!/usr/bin/env bash
# Full local backup: dumps the Postgres database and archives the file store.
# Usage: ./scripts/backup.sh [output-dir]
# Requires: docker compose stack running (for the DB dump), run from the pdf-toolkit/ directory.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

OUT_DIR="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${OUT_DIR}/pdf-toolkit-backup-${STAMP}"
mkdir -p "$DEST"

echo "Dumping database..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-pdftoolkit}" "${POSTGRES_DB:-pdftoolkit}" > "${DEST}/database.sql"

echo "Archiving file store..."
tar -czf "${DEST}/data.tar.gz" -C ./data .

echo "Backup written to ${DEST}"
echo "  - database.sql : full Postgres dump (documents/versions/events/signatures metadata)"
echo "  - data.tar.gz  : every original file and every versioned output"
echo
echo "To restore: create a fresh stack, then:"
echo "  cat ${DEST}/database.sql | docker compose exec -T postgres psql -U \$POSTGRES_USER \$POSTGRES_DB"
echo "  tar -xzf ${DEST}/data.tar.gz -C ./data"
