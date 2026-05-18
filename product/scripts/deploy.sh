#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Deploy SahuliatAI to Vercel.
#
# Usage:
#   bash scripts/deploy.sh           # preview deploy
#   bash scripts/deploy.sh prod      # production deploy
#
# What this script does, in order:
#   1. Loads .env.local + checks required vars
#   2. pnpm typecheck (fast-fail)
#   3. pnpm build (local sanity check)
#   4. supabase db push (apply any unapplied migrations to your remote project)
#   5. vercel link / vercel pull (if not already linked)
#   6. Pushes Vercel env vars from .env.local for the target environment
#   7. vercel deploy
#   8. Prints post-deploy reminders (pg_cron URL update + Supabase Auth URLs)
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-preview}"
if [ "$TARGET" != "preview" ] && [ "$TARGET" != "prod" ] && [ "$TARGET" != "production" ]; then
  echo "Usage: bash scripts/deploy.sh [preview|prod]"
  exit 1
fi
[ "$TARGET" = "production" ] && TARGET=prod

echo "============================================"
echo " SahuliatAI deploy -> $TARGET"
echo "============================================"

# ---------- 1. Load env ----------
if [ ! -f .env.local ]; then
  echo "!! .env.local missing. Copy .env.example, fill in values, then re-run."
  exit 1
fi
set -a; source .env.local; set +a

REQUIRED=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY GOOGLE_GEMINI_API_KEY REMINDERS_FIRE_SECRET VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY NEXT_PUBLIC_VAPID_PUBLIC_KEY)
MISSING=()
for v in "${REQUIRED[@]}"; do
  if [ -z "${!v:-}" ]; then MISSING+=("$v"); fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "!! Missing required env vars in .env.local:"
  for v in "${MISSING[@]}"; do echo "   - $v"; done
  exit 1
fi
echo "OK env vars present"

# ---------- 2. Type check ----------
echo "-> Type-checking ..."
pnpm typecheck

# ---------- 3. Local build ----------
echo "-> Local production build (fail-fast sanity check) ..."
pnpm build

# ---------- 4. DB migrations ----------
echo "-> Pushing DB migrations to Supabase ..."
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && [ ! -f "$HOME/.supabase/access-token" ]; then
  echo "   Supabase CLI is not authenticated."
  echo "   Run: pnpm exec supabase login   (or set SUPABASE_ACCESS_TOKEN)"
  exit 1
fi
pnpm exec supabase db push

# ---------- 5. Vercel CLI auth ----------
if ! pnpm exec vercel whoami >/dev/null 2>&1; then
  echo "-> Logging into Vercel ..."
  pnpm exec vercel login
fi

# ---------- 6. Link + push env ----------
if [ ! -d .vercel ]; then
  echo "-> Linking this directory to a Vercel project ..."
  pnpm exec vercel link
fi

VENV="preview"
[ "$TARGET" = "prod" ] && VENV="production"

echo "-> Syncing env vars to Vercel ($VENV) ..."
push_env() {
  local key="$1"
  local val="${!key:-}"
  if [ -z "$val" ]; then return; fi
  # remove existing (best-effort) then add fresh
  pnpm exec vercel env rm "$key" "$VENV" -y >/dev/null 2>&1 || true
  printf '%s' "$val" | pnpm exec vercel env add "$key" "$VENV" >/dev/null
  echo "   . $key"
}

# Required
for v in "${REQUIRED[@]}"; do push_env "$v"; done
# Optional
for v in \
  GOOGLE_MAPS_SERVER_KEY NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY \
  NEXT_PUBLIC_USE_GOOGLE_APIS NEXT_PUBLIC_APP_URL \
  GEMINI_MODEL \
  WHATSAPP_PHONE_NUMBER_ID WHATSAPP_ACCESS_TOKEN \
  TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM_NUMBER \
  ; do
  push_env "$v"
done

# ---------- 7. Deploy ----------
if [ "$TARGET" = "prod" ]; then
  echo "-> Deploying to PRODUCTION ..."
  DEPLOY_URL=$(pnpm exec vercel --prod --yes 2>&1 | tee /dev/tty | tail -n 1 | tr -d '[:space:]')
else
  echo "-> Deploying preview ..."
  DEPLOY_URL=$(pnpm exec vercel --yes 2>&1 | tee /dev/tty | tail -n 1 | tr -d '[:space:]')
fi

echo ""
echo "============================================"
echo " DEPLOYED: $DEPLOY_URL"
echo "============================================"

# ---------- 8. Post-deploy reminders ----------
cat <<EOF

  POST-DEPLOY CHECKLIST
  ----------------------------------------------
  1. Update pg_cron app_config so reminders POST to the deployed URL.
     In Supabase SQL Editor, run:
        update public.app_config
        set value = '$DEPLOY_URL/api/reminders/fire', updated_at = now()
        where key = 'reminders_fire_url';

  2. Update Supabase Auth URLs (Dashboard -> Authentication -> URL Configuration):
        Site URL:        $DEPLOY_URL
        Redirect URLs:   $DEPLOY_URL/**

  3. If you set NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY with HTTP referer restriction,
     add '$DEPLOY_URL/*' to the allowed referers in Google Cloud Console.

  4. NEXT_PUBLIC_APP_URL in Vercel env -> should be '$DEPLOY_URL' for prod deploys.
     (Re-deploy after updating so the bundle picks it up.)

  5. Smoke test:
        - Sign in as ayesha@example.com / Demo!1234 on the new URL
        - Run the canonical Roman Urdu query
        - Open a second window as ali@example.com -> /provider/dashboard
EOF
