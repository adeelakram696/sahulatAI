#!/usr/bin/env bash
# ============================================================================
# SahuliatAI — one-shot local setup.
#
# Run from the product/ dir:
#   bash scripts/setup.sh
#
# What it does:
#   1. Checks prerequisites (node, pnpm, optional supabase CLI + psql)
#   2. Creates .env.local from .env.example if missing
#   3. Installs node deps via pnpm
#   4. Generates VAPID keys (web-push) if missing
#   5. (optional) Links the Supabase project and pushes migrations + seed
#   6. (optional) Seeds demo auth users (Ayesha / Ali / Tutor)
#   7. Prints how to start the dev server
#
# Designed to be safe to re-run: every step skips if already done.
# ============================================================================

set -euo pipefail

# Move to the product/ dir regardless of where the script is invoked from.
cd "$(dirname "$0")/.."

# ---- helpers ---------------------------------------------------------------
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
info() { printf "${CYAN}→${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}!${NC} %s\n" "$*"; }
err()  { printf "${RED}✗${NC} %s\n" "$*" >&2; }

prompt_yes_no() {
  # $1 = question, $2 = default (Y/N)
  local q="$1"; local def="${2:-Y}"
  local yn
  if [ "$def" = "Y" ]; then
    read -r -p "$q [Y/n] " yn
    yn="${yn:-Y}"
  else
    read -r -p "$q [y/N] " yn
    yn="${yn:-N}"
  fi
  case "$yn" in
    y|Y|yes|YES|Yes) return 0 ;;
    *) return 1 ;;
  esac
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "$1 is required but not installed."
    [ -n "${2:-}" ] && echo "  -> Install: $2"
    return 1
  fi
}

env_has() {
  # $1 = key — returns 0 if .env.local has a non-empty value for it.
  [ -f .env.local ] || return 1
  local val
  val="$(grep -E "^${1}=" .env.local | tail -n 1 | cut -d= -f2- || true)"
  [ -n "$val" ]
}

# ---- 1. prerequisites ------------------------------------------------------
info "Step 1/6 — Checking prerequisites"

failures=0
require_cmd node "https://nodejs.org (need v20+)" || failures=$((failures+1))
if command -v node >/dev/null 2>&1; then
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt 20 ]; then
    err "Node $(node -v) is too old. Need v20 or newer."
    failures=$((failures+1))
  else
    ok "node $(node -v)"
  fi
fi

if ! require_cmd pnpm "npm install -g pnpm"; then
  failures=$((failures+1))
else
  ok "pnpm $(pnpm -v)"
fi

if command -v supabase >/dev/null 2>&1; then
  ok "supabase CLI $(supabase --version 2>/dev/null | head -n1)"
else
  warn "supabase CLI not found (you'll be unable to push migrations until you install it)"
  echo "    -> brew install supabase/tap/supabase  OR  https://supabase.com/docs/guides/cli/getting-started"
fi

if command -v psql >/dev/null 2>&1; then
  ok "psql (used by seed)"
else
  warn "psql not found (db:seed will fail until installed: brew install libpq && brew link --force libpq)"
fi

if [ "$failures" -gt 0 ]; then
  err "$failures prerequisite(s) missing. Install them and re-run."
  exit 1
fi
echo

# ---- 2. env file -----------------------------------------------------------
info "Step 2/6 — Configuring .env.local"

# If a teammate dropped the shared .env.prod in but doesn't have .env.local
# yet, mirror it so Next.js dev server (which only reads .env.local /
# .env.development / .env / etc.) picks up the keys.
if [ ! -f .env.local ] && [ -f .env.prod ]; then
  if prompt_yes_no ".env.prod found but no .env.local. Copy .env.prod to .env.local so 'pnpm dev' works?" "Y"; then
    cp .env.prod .env.local
    ok ".env.prod → .env.local (Next.js dev server reads .env.local)"
  fi
fi

if [ ! -f .env.local ]; then
  if [ -f .env.example ]; then
    cp .env.example .env.local
    ok "Created .env.local from .env.example"
    warn "Open .env.local and fill the values BEFORE continuing:"
    cat <<'EOF'
      Required keys:
        NEXT_PUBLIC_SUPABASE_URL
        NEXT_PUBLIC_SUPABASE_ANON_KEY
        SUPABASE_SERVICE_ROLE_KEY
        SUPABASE_PROJECT_REF
        DATABASE_URL
        GOOGLE_GEMINI_API_KEY
        GOOGLE_MAPS_SERVER_KEY
        NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
        NEXT_PUBLIC_APP_URL   (use http://localhost:3010 for dev)
EOF
    if ! prompt_yes_no "Have you filled .env.local now and want to continue?" "N"; then
      info "Stopped. Re-run scripts/setup.sh once you've filled .env.local."
      exit 0
    fi
  else
    err ".env.example missing — can't bootstrap .env.local"
    exit 1
  fi
else
  ok ".env.local already exists (keeping yours)"
fi

# Sanity check the required keys are non-empty.
missing_env=()
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_PROJECT_REF DATABASE_URL GOOGLE_GEMINI_API_KEY NEXT_PUBLIC_APP_URL; do
  env_has "$k" || missing_env+=("$k")
done
if [ "${#missing_env[@]}" -gt 0 ]; then
  warn "These required keys are blank in .env.local:"
  for k in "${missing_env[@]}"; do echo "    - $k"; done
  if ! prompt_yes_no "Continue anyway?" "N"; then
    exit 1
  fi
fi
echo

# ---- 3. install deps -------------------------------------------------------
info "Step 3/6 — Installing dependencies (pnpm install)"
pnpm install
ok "Dependencies installed"
echo

# ---- 4. VAPID keys ---------------------------------------------------------
info "Step 4/6 — VAPID keys (web push)"
if env_has VAPID_PUBLIC_KEY && env_has VAPID_PRIVATE_KEY; then
  ok "VAPID keys already present"
else
  if prompt_yes_no "Generate VAPID keys and append them to .env.local?" "Y"; then
    keys="$(pnpm -s vapid:generate)"
    echo "$keys" >> .env.local
    ok "VAPID keys appended to .env.local"
  else
    warn "Skipping — web push will be a noop until VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are set"
  fi
fi
echo

# ---- 5. Supabase: VERIFY (default) — opt-in migrate/seed/types --------------
info "Step 5/6 — Supabase database"
cat <<'EOF'

  This project ships with a hosted Supabase DB that the team shares.
  By default, setup will only VERIFY your local repo matches the remote
  schema (read-only, safe). Migrations and seed are OPT-IN and only
  needed if you own the DB or are on a fresh isolated project.

EOF

if prompt_yes_no "Run db:verify (read-only schema + seed check against the linked DB)?" "Y"; then
  if [ -x scripts/db-verify.sh ]; then
    if bash scripts/db-verify.sh; then
      ok "DB verification passed"
    else
      warn "DB verification reported issues — see the output above."
      echo "    If you OWN this DB and the issues are missing columns / RPCs / seeds,"
      echo "    you can apply the pending migrations with:  pnpm db:push"
      echo "    (Or do a full reset+reseed with:            pnpm db:reset)"
    fi
  else
    warn "scripts/db-verify.sh missing — skipping"
  fi
else
  warn "Skipping verification. Run 'pnpm db:verify' anytime."
fi
echo

if prompt_yes_no "Are you working with your OWN Supabase project (NOT the shared one)?" "N"; then
  echo
  warn "About to mutate the linked Supabase project: ${SUPABASE_PROJECT_REF:-(none)}"
  if prompt_yes_no "    -> Push migrations now (pnpm db:push)?" "N"; then
    if command -v supabase >/dev/null 2>&1; then
      bash scripts/db-link.sh || warn "db-link failed (may already be linked; continuing)"
      pnpm db:push
      ok "Migrations pushed"
    else
      warn "supabase CLI not installed; skipping"
    fi
  fi
  if prompt_yes_no "    -> Run idempotent seed (pnpm db:seed)?" "N"; then
    pnpm db:seed
    ok "Seed applied"
  fi
  if prompt_yes_no "    -> Seed demo auth users (Ayesha / Ali / Tutor)?" "N"; then
    pnpm db:seed:auth
    ok "Auth users seeded"
  fi
fi

if prompt_yes_no "Regenerate TypeScript types from the DB? (read-only, safe)" "Y"; then
  if command -v supabase >/dev/null 2>&1; then
    pnpm db:types || warn "db:types failed (project linked?)"
  else
    warn "supabase CLI missing — skipping"
  fi
fi
echo

# ---- 6. done ---------------------------------------------------------------
info "Step 6/6 — All set"
cat <<EOF

  $(printf "${GREEN}Setup complete.${NC}")

  Start the dev server:
    $(printf "${CYAN}pnpm dev${NC}")  →  http://localhost:3010

  Useful commands:
    pnpm dev              # local server (port 3010)
    pnpm db:reset         # re-push migrations + reseed
    pnpm db:seed:auth     # recreate the demo users
    pnpm db:types         # regenerate Supabase TS types
    pnpm build && pnpm start    # production-like local run
    pnpm deploy:preview   # ship a Vercel preview

  Demo accounts (after db:seed:auth):
    customer:  ayesha@sahuliat.local        / hackathon123
    customer:  ali@sahuliat.local           / hackathon123
    provider:  tutor@sahuliat.local         / hackathon123

EOF
