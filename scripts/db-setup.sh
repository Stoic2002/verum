#!/usr/bin/env bash
# Creates the local development role and databases. Idempotent.
# Assumes a PostgreSQL 16 server is already running on localhost:5432
# (Homebrew: brew install postgresql@16 && brew services start postgresql@16).
set -euo pipefail

PSQL="${PSQL:-psql}"

"$PSQL" -h localhost -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'verum') THEN
    CREATE ROLE verum WITH LOGIN PASSWORD 'verum' CREATEDB;
  END IF;
END
$$;
SQL

for db in verum verum_test; do
  if ! "$PSQL" -h localhost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1; then
    "$PSQL" -h localhost -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db OWNER verum"
  fi
done

echo "Local databases ready: verum, verum_test"
