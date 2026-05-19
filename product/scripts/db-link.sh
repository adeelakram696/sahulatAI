#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=""
for candidate in .env.local .env.prod; do
  if [ -f "$candidate" ]; then ENV_FILE="$candidate"; break; fi
done
if [ -z "$ENV_FILE" ]; then
  echo "❌ No env file found (looked for .env.local then .env.prod)."
  echo "   Copy .env.example and fill in values first."
  exit 1
fi
echo "-> Loading env from $ENV_FILE"

# Load env (export every variable for the supabase CLI subprocess)
set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
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
