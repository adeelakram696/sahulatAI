#!/usr/bin/env bash
# Reset = push migrations + reseed. Migrations are pushed via supabase CLI;
# seeding goes through psql since the new CLI no longer has `db execute`.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=""
for candidate in .env.local .env.prod; do
  if [ -f "$candidate" ]; then ENV_FILE="$candidate"; break; fi
done
if [ -z "$ENV_FILE" ]; then
  echo "!! No env file found (looked for .env.local then .env.prod)."; exit 1
fi
echo "-> Loading env from $ENV_FILE"
set -a; source "$ENV_FILE"; set +a

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
