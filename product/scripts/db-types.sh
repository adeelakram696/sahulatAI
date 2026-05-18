#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.local; set +a

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "❌ SUPABASE_PROJECT_REF not set"; exit 1
fi

echo "→ Generating Supabase TypeScript types…"
pnpm exec supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" > lib/supabase/database.types.ts
echo "✅ Wrote lib/supabase/database.types.ts"
