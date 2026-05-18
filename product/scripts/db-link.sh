#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "❌ .env.local not found. Copy .env.example and fill in values first."
  exit 1
fi

# Load env (export every variable for the supabase CLI subprocess)
set -a
# shellcheck disable=SC1091
source .env.local
set +a

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "❌ SUPABASE_PROJECT_REF not set in .env.local"
  echo "   Find it in Supabase Dashboard → Project Settings → General → Reference ID"
  exit 1
fi

echo "-> Linking Supabase CLI to project ${SUPABASE_PROJECT_REF} ..."

# CLI needs an access token. If not present in env or token file, prompt to login.
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && [ ! -f "$HOME/.supabase/access-token" ]; then
  echo ""
  echo "!! Supabase CLI is not authenticated."
  echo "   Either run: pnpm exec supabase login"
  echo "   Or set SUPABASE_ACCESS_TOKEN in .env.local"
  echo "      (generate one at https://supabase.com/dashboard/account/tokens)"
  exit 1
fi

pnpm exec supabase link --project-ref "${SUPABASE_PROJECT_REF}"
echo "OK Linked."
