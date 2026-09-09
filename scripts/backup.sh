#!/usr/bin/env bash
# Dumps the database to a compressed custom-format archive.
#
# Custom format (-Fc), not plain SQL: it restores in parallel, allows restoring
# a single table, and is what scripts/restore-test.sh expects.
#
#   ./scripts/backup.sh [outdir]     outdir defaults to ./backups
set -euo pipefail

OUT_DIR="${1:-./backups}"
: "${DATABASE_URL:?DATABASE_URL is not set}"

mkdir -p "$OUT_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="$OUT_DIR/verum-$STAMP.dump"

pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$DATABASE_URL"

echo "$FILE ($(du -h "$FILE" | cut -f1))"
