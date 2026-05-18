#!/usr/bin/env bash
# Reset = push migrations + reseed. Migrations are pushed via supabase CLI;
# seeding goes through psql since the new CLI no longer has `db execute`.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "!! .env.local not found"; exit 1
fi
set -a; source .env.local; set +a

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "!! SUPABASE_PROJECT_REF not set in .env.local"; exit 1
fi

echo "-> Pushing migrations to project ${SUPABASE_PROJECT_REF} ..."
pnpm exec supabase db push

echo "-> Seeding..."
bash scripts/db-seed.sh

echo "OK DB reset complete."
echo ""
echo "Next steps:"
echo "  1. pnpm db:seed:auth   # create demo users (Ayesha, Ali, Tutor)"
echo "  2. pnpm db:types       # regenerate TypeScript types"
