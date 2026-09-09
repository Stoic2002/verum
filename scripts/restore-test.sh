#!/usr/bin/env bash
# Restores the most recent dump into a scratch database and checks it arrived
# intact, then drops the scratch database.
#
# PRD §15: a backup that has never been restored is not a backup. Run this once
# before launch and every quarter after.
set -euo pipefail

OUT_DIR="${1:-./backups}"
: "${DATABASE_URL:?DATABASE_URL is not set}"

DUMP=$(ls -t "$OUT_DIR"/verum-*.dump 2>/dev/null | head -1 || true)
[ -n "$DUMP" ] || { echo "No dump found in $OUT_DIR — run scripts/backup.sh first" >&2; exit 1; }

# Reuse the credentials and host from DATABASE_URL, swap the database name.
BASE="${DATABASE_URL%/*}"
SCRATCH="verum_restore_check"
SCRATCH_URL="$BASE/$SCRATCH"
ADMIN_URL="$BASE/postgres"

cleanup() { psql "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Restoring $DUMP into $SCRATCH"
cleanup
psql "$ADMIN_URL" -q -c "CREATE DATABASE $SCRATCH"
pg_restore --no-owner --no-privileges --dbname="$SCRATCH_URL" "$DUMP"

check() { psql "$SCRATCH_URL" -tAc "$1" | tr -d '[:space:]'; }

TABLES=$(check "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
TRIGGER=$(check "SELECT count(*) FROM pg_trigger WHERE tgname='article_locales_search_vector_tg'")
GIN=$(check "SELECT count(*) FROM pg_indexes WHERE indexname='article_locales_search_idx'")
ARTICLES=$(check "SELECT count(*) FROM articles")
VECTORS=$(check "SELECT count(*) FROM article_locales WHERE search_vector IS NOT NULL")

echo "  tables=$TABLES trigger=$TRIGGER gin_index=$GIN articles=$ARTICLES search_vectors=$VECTORS"

fail=0
[ "$TABLES" -ge 15 ] || { echo "FAIL: expected at least 15 tables, got $TABLES" >&2; fail=1; }
[ "$TRIGGER" = "1" ] || { echo "FAIL: search vector trigger missing" >&2; fail=1; }
[ "$GIN" = "1" ] || { echo "FAIL: GIN index missing" >&2; fail=1; }
[ "$VECTORS" -gt 0 ] || { echo "FAIL: no search vectors survived the restore" >&2; fail=1; }

# The trigger must still fire in the restored database, not just exist.
psql "$SCRATCH_URL" -q -c "
	INSERT INTO categories (slug) VALUES ('restore-check') ON CONFLICT DO NOTHING;
	INSERT INTO articles (category_id, status)
		SELECT id, 'draft' FROM categories WHERE slug='restore-check';
	INSERT INTO article_locales (article_id, locale, slug, title, excerpt, body_md, body_text)
		SELECT a.id, 'en', 'restore-check', 'Restore check', 'x', 'y', 'searchable restore probe'
		FROM articles a JOIN categories c ON c.id=a.category_id WHERE c.slug='restore-check';
" >/dev/null

PROBE=$(check "SELECT count(*) FROM article_locales WHERE slug='restore-check' AND search_vector @@ websearch_to_tsquery('english','probe')")
[ "$PROBE" = "1" ] || { echo "FAIL: trigger did not fire in the restored database" >&2; fail=1; }

[ "$fail" = "0" ] && echo "Restore verified." || exit 1
