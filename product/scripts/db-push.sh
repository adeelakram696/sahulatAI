#!/usr/bin/env bash
# ============================================================================
# db:push  — apply pending Supabase migrations using the credentials in
# .env.local. Self-contained: handles auth + linking so teammates can run this
# from a fresh clone without any prior `supabase login` or `supabase link`.
#
# Requires .env.local to contain:
#   SUPABASE_ACCESS_TOKEN   (personal access token, shared by the owner or per-user)
#   SUPABASE_PROJECT_REF    (project reference id)
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

# Prefer .env.local for owner workflow; fall back to .env.prod for teammates
# who only have the shared production env file.
ENV_FILE=""
for candidate in .env.local .env.prod; do
  if [ -f "$candidate" ]; then ENV_FILE="$candidate"; break; fi
done
if [ -z "$ENV_FILE" ]; then
  echo "!! No env file found (looked for .env.local then .env.prod)."
  echo "   Copy .env.example and fill it, or get the team-shared file."
  exit 1
fi
echo "-> Loading env from $ENV_FILE"

# Export every var so the supabase CLI subprocess sees them.
set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "!! SUPABASE_ACCESS_TOKEN missing from .env.local"
  echo "   Get one at https://supabase.com/dashboard/account/tokens"
  exit 1
fi

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "!! SUPABASE_PROJECT_REF missing from .env.local"
  exit 1
fi

# Auto-link the project on this machine if it's not linked yet.
# The CLI writes supabase/.temp/linked-project.json on first link; subsequent
# runs are instant.
if [ ! -f supabase/.temp/linked-project.json ]; then
  echo "-> First run on this machine — linking to project ${SUPABASE_PROJECT_REF} ..."
  pnpm exec supabase link --project-ref "${SUPABASE_PROJECT_REF}"
fi

echo "-> Pushing migrations to ${SUPABASE_PROJECT_REF} ..."
pnpm exec supabase db push
echo "OK Migrations applied."
