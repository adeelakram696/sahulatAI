#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Deploy SahuliatAI to Vercel.
#
# Usage:
#   bash scripts/deploy.sh           # preview deploy -> reads .env.preview, fallback .env.local
#   bash scripts/deploy.sh prod      # production  -> reads .env.prod,    fallback .env.local
#
# Env file precedence per target:
#   prod      -> .env.prod      (else .env.local)
#   preview   -> .env.preview   (else .env.local)
#
# Each env file is the FULL set of vars for that environment (Supabase keys,
# Gemini key, NEXT_PUBLIC_APP_URL, REMINDERS_FIRE_SECRET, VAPID, etc.).
# All env files are gitignored.
#
# What this script does, in order:
#   1. Picks + loads the right env file
#   2. Validates required vars are present
#   3. pnpm typecheck (fast-fail)
#   4. pnpm build (local sanity check)
#   5. supabase db push (apply any unapplied migrations)
#   6. vercel link if not already linked
#   7. Pushes every env var from the chosen file to Vercel for the target env
#   8. vercel deploy
#   9. Prints post-deploy reminders (pg_cron URL, Supabase Auth URLs)
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-preview}"
if [ "$TARGET" != "preview" ] && [ "$TARGET" != "prod" ] && [ "$TARGET" != "production" ]; then
  echo "Usage: bash scripts/deploy.sh [preview|prod]"
  exit 1
fi
[ "$TARGET" = "production" ] && TARGET=prod

# ---------- 1. Pick env file ----------
if [ "$TARGET" = "prod" ]; then
  ENV_FILE=".env.prod"
else
  ENV_FILE=".env.preview"
fi

if [ ! -f "$ENV_FILE" ]; then
  # Fallback order: prefer .env.local for owner workflow, then .env.prod so a
  # teammate who only has the shared production env file can still deploy.
  for candidate in .env.local .env.prod; do
    if [ -f "$candidate" ]; then
      echo "!! $ENV_FILE not found; falling back to $candidate"
      [ "$candidate" = ".env.prod" ] && [ "$TARGET" = "preview" ] && \
        echo "   ⚠ Using PROD keys for a PREVIEW deploy — URLs/secrets may not be sandboxed."
      ENV_FILE="$candidate"
      break
    fi
  done
  if [ ! -f "$ENV_FILE" ]; then
    echo "!! No env file found. Create one of: .env.${TARGET}, .env.local, .env.prod"
    exit 1
  fi
fi

echo "============================================"
echo " SahuliatAI deploy -> $TARGET"
echo " Using env file:    $ENV_FILE"
echo "============================================"

set -a; source "$ENV_FILE"; set +a

# ---------- 2. Validate required vars ----------
REQUIRED=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY GOOGLE_GEMINI_API_KEY REMINDERS_FIRE_SECRET VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY NEXT_PUBLIC_VAPID_PUBLIC_KEY NEXT_PUBLIC_APP_URL)
MISSING=()
for v in "${REQUIRED[@]}"; do
  if [ -z "${!v:-}" ]; then MISSING+=("$v"); fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "!! Missing required env vars in $ENV_FILE:"
  for v in "${MISSING[@]}"; do echo "   - $v"; done
  exit 1
fi
echo "OK env vars present"

# ---------- 3. Type check ----------
echo "-> Type-checking ..."
pnpm typecheck

# ---------- 4. Local build ----------
# Temporarily hide .env.local while building so Next.js only reads the values
# we already exported from $ENV_FILE. (Vars in process.env already take
# priority, but this makes the build log honest about which file was used.)
RESTORE_LOCAL=0
if [ "$ENV_FILE" != ".env.local" ] && [ -f .env.local ]; then
  mv .env.local .env.local.deploybak
  RESTORE_LOCAL=1
  trap 'if [ "$RESTORE_LOCAL" = "1" ] && [ -f .env.local.deploybak ]; then mv .env.local.deploybak .env.local; fi' EXIT
fi

echo "-> Local production build using $ENV_FILE (fail-fast sanity check) ..."
pnpm build

# Restore early (the trap also handles error paths)
if [ "$RESTORE_LOCAL" = "1" ] && [ -f .env.local.deploybak ]; then
  mv .env.local.deploybak .env.local
  RESTORE_LOCAL=0
fi

# ---------- 5. DB migrations ----------
# Two ways:
#   - Owner / DB-admin teammates: have Supabase CLI auth (login or SUPABASE_ACCESS_TOKEN).
#   - Other teammates: set SKIP_DB_PUSH=1 to deploy app changes only.
#     The owner is responsible for pushing migrations beforehand. The app will
#     surface schema-mismatch errors at runtime; run `pnpm db:verify` to catch
#     them before deploying.
if [ "${SKIP_DB_PUSH:-0}" = "1" ]; then
  echo "-> Skipping DB migrations (SKIP_DB_PUSH=1)."
  echo "   Make sure the owner has already pushed migrations to Supabase."
else
  echo "-> Pushing DB migrations to Supabase ..."
  if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && [ ! -f "$HOME/.supabase/access-token" ]; then
    echo "   Supabase CLI is not authenticated."
    echo "   Options:"
    echo "     a) Run: pnpm exec supabase login"
    echo "     b) Set SUPABASE_ACCESS_TOKEN in $ENV_FILE (https://supabase.com/dashboard/account/tokens)"
    echo "     c) Set SKIP_DB_PUSH=1 and let the project owner push migrations."
    exit 1
  fi
  pnpm exec supabase db push
fi

# ---------- 6. Vercel CLI auth + link ----------
# Two ways to authenticate:
#   1. Interactive: pnpm exec vercel login (browser flow)
#   2. Headless: export VERCEL_TOKEN=... (or put it in $ENV_FILE).
#      Teammates can use a scoped token from https://vercel.com/account/tokens
#      without ever logging in. The CLI auto-detects it.
VERCEL_ARGS=()
if [ -n "${VERCEL_TOKEN:-}" ]; then
  VERCEL_ARGS+=(--token "$VERCEL_TOKEN")
fi
if [ -n "${VERCEL_ORG_ID:-}" ] && [ -n "${VERCEL_PROJECT_ID:-}" ]; then
  # CI-style: skips interactive linking if both IDs are present
  VERCEL_ARGS+=(--scope "${VERCEL_ORG_ID}")
fi

if ! pnpm exec vercel "${VERCEL_ARGS[@]}" whoami >/dev/null 2>&1; then
  if [ -n "${VERCEL_TOKEN:-}" ]; then
    echo "!! VERCEL_TOKEN provided but rejected. Check the token at vercel.com/account/tokens."
    exit 1
  fi
  echo "-> Logging into Vercel ..."
  pnpm exec vercel login
fi

if [ ! -d .vercel ]; then
  echo "-> Linking this directory to a Vercel project ..."
  pnpm exec vercel "${VERCEL_ARGS[@]}" link --yes
fi

VENV="preview"
[ "$TARGET" = "prod" ] && VENV="production"

# ---------- 7. Sync env vars to Vercel ----------
echo "-> Syncing env vars to Vercel ($VENV) ..."
push_env() {
  local key="$1"
  local val="${!key:-}"
  if [ -z "$val" ]; then return; fi
  pnpm exec vercel "${VERCEL_ARGS[@]}" env rm "$key" "$VENV" -y >/dev/null 2>&1 || true
  printf '%s' "$val" | pnpm exec vercel "${VERCEL_ARGS[@]}" env add "$key" "$VENV" >/dev/null
  echo "   . $key"
}

# Required
for v in "${REQUIRED[@]}"; do push_env "$v"; done
# Optional
for v in \
  GOOGLE_MAPS_SERVER_KEY NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY \
  NEXT_PUBLIC_USE_GOOGLE_APIS \
  GEMINI_MODEL \
  WHATSAPP_PHONE_NUMBER_ID WHATSAPP_ACCESS_TOKEN \
  TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM_NUMBER \
  TWA_SHA256_FINGERPRINTS NEXT_PUBLIC_TWA_PACKAGE_NAME \
  ; do
  push_env "$v"
done

# ---------- 8. Deploy ----------
if [ "$TARGET" = "prod" ]; then
  echo "-> Deploying to PRODUCTION ..."
  pnpm exec vercel "${VERCEL_ARGS[@]}" --prod --yes
else
  echo "-> Deploying preview ..."
  pnpm exec vercel "${VERCEL_ARGS[@]}" --yes
fi

# ---------- 9. Post-deploy reminders ----------
DEPLOY_URL="$NEXT_PUBLIC_APP_URL"
cat <<EOF

============================================
 DEPLOY COMPLETE
============================================
 Target env file used: $ENV_FILE
 NEXT_PUBLIC_APP_URL:  $DEPLOY_URL

POST-DEPLOY CHECKLIST
----------------------------------------------
 1. Update pg_cron so reminders POST to the deployed URL.
    In Supabase SQL Editor:
       update public.app_config
       set value = '${DEPLOY_URL}/api/reminders/fire', updated_at = now()
       where key = 'reminders_fire_url';

 2. Supabase Auth -> URL Configuration:
       Site URL:        ${DEPLOY_URL}
       Redirect URLs:   ${DEPLOY_URL}/**
                        http://localhost:3010/**     (keep for local dev)

 3. If you use Google Maps browser key with HTTP-referer restriction,
    add '${DEPLOY_URL}/*' to the allowed referers.

 4. Smoke test:
       - Sign in as ayesha@example.com / Demo!1234 on ${DEPLOY_URL}
       - Run the canonical Roman Urdu query
       - Open ${DEPLOY_URL}/provider/dashboard as ali@example.com in another window
EOF
