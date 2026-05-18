#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "!! .env.local not found"; exit 1
fi
set -a; source .env.local; set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "!! DATABASE_URL not set in .env.local"
  echo ""
  echo "   Find it: Supabase Dashboard -> Project Settings -> Database"
  echo "   -> Connection string -> URI (pick 'Transaction pooler')"
  echo "   -> replace [YOUR-PASSWORD] with your DB password"
  echo ""
  echo "   Format: postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "!! psql not installed."
  echo "   macOS: brew install libpq && brew link --force libpq"
  echo "   Or paste supabase/seed.sql into the Supabase SQL editor manually."
  exit 1
fi

echo "-> Applying supabase/seed.sql via psql..."
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f supabase/seed.sql
echo "OK Seed complete."
