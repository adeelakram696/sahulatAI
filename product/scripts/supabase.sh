#!/usr/bin/env bash
# ============================================================================
# scripts/supabase.sh — wrap the Supabase CLI with .env.local-aware auth.
#
# Loads SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF from .env.local, ensures
# the project is linked on this machine, then forwards all arguments to the
# Supabase CLI.
#
# Usage:
#   bash scripts/supabase.sh db diff
#   bash scripts/supabase.sh db pull --dry-run
#   bash scripts/supabase.sh migration list
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=""
for candidate in .env.local .env.prod; do
  if [ -f "$candidate" ]; then ENV_FILE="$candidate"; break; fi
done
if [ -z "$ENV_FILE" ]; then
  echo "!! No env file found (looked for .env.local then .env.prod)."; exit 1
fi
set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "!! SUPABASE_ACCESS_TOKEN missing from .env.local"; exit 1
fi

if [ ! -f supabase/.temp/linked-project.json ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "-> Linking to project ${SUPABASE_PROJECT_REF} (one-time on this machine) ..."
  pnpm exec supabase link --project-ref "${SUPABASE_PROJECT_REF}" >/dev/null
fi

exec pnpm exec supabase "$@"
