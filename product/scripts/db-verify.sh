#!/usr/bin/env bash
# ============================================================================
# db:verify  — read-only check of the linked Supabase DB.
#
# Tells you:
#   1. Are the required tables present? (providers, bookings, disputes, etc.)
#   2. Are the recent columns present? (complexity, price_breakdown, en_route_at, …)
#   3. Are the recent RPCs present? (search_providers_rpc, providers_in_bbox, …)
#   4. Are there ANY pending migrations? (supabase CLI dry-run)
#
# Does NOT mutate anything. Safe on shared / production DBs.
# Re-runnable as often as you like.
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
echo "-> Loading env from $ENV_FILE"
set -a; source "$ENV_FILE"; set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "!! DATABASE_URL not set in .env.local"; exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "!! psql not installed. macOS: brew install libpq && brew link --force libpq"; exit 1
fi

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$*"; }
miss() { printf "  ${RED}✗${NC} %s\n" "$*"; }
warn() { printf "  ${YELLOW}!${NC} %s\n" "$*"; }

# Issue count → exit code at the end.
issues=0

# Single SQL roundtrip — easier to debug if something is wrong.
psql_q() { psql "${DATABASE_URL}" -At -v ON_ERROR_STOP=1 -c "$1"; }

echo "== Connectivity =="
if psql_q "select 1" >/dev/null 2>&1; then
  ok "DATABASE_URL reachable"
else
  miss "Cannot connect with DATABASE_URL — check creds + pooler region"; exit 1
fi
echo

# ---- Tables ----------------------------------------------------------------
echo "== Tables =="
required_tables=(
  service_categories
  providers
  user_locations
  users_profile
  bookings
  ratings
  reminders
  push_subscriptions
  places_contacts
  mock_messages
  disputes
  agent_traces
)
for t in "${required_tables[@]}"; do
  if [ "$(psql_q "select to_regclass('public.${t}') is not null")" = "t" ]; then
    ok "public.${t}"
  else
    miss "public.${t} missing"
    issues=$((issues+1))
  fi
done
echo

# ---- Columns added by recent migrations -----------------------------------
echo "== Recent columns =="
check_col() {
  # $1 table  $2 column
  local exists
  exists="$(psql_q "select exists (select 1 from information_schema.columns where table_schema='public' and table_name='${1}' and column_name='${2}')")"
  if [ "$exists" = "t" ]; then
    ok "${1}.${2}"
  else
    miss "${1}.${2} missing  →  push migrations to apply 20260519000012 / 13 / 14"
    issues=$((issues+1))
  fi
}
check_col bookings  complexity
check_col bookings  price_breakdown
check_col bookings  service_checklist
check_col bookings  service_photos
check_col bookings  en_route_at
check_col bookings  arrived_at
check_col bookings  completed_at
check_col providers on_time_score
check_col providers cancellation_rate
check_col providers risk_score
check_col providers specializations
check_col providers capacity
check_col providers base_visit_fee
check_col providers base_hourly_rate
check_col providers last_review_at
echo

# ---- bookings.status enum values ------------------------------------------
echo "== bookings.status enum =="
status_check="$(psql_q "select pg_get_constraintdef(c.oid) from pg_constraint c join pg_class t on t.oid = c.conrelid where t.relname='bookings' and c.conname='bookings_status_check'")"
for s in invitation_sent query_sent confirmed en_route arrived reminded in_progress completed cancelled rejected; do
  if printf "%s" "$status_check" | grep -q "'$s'"; then
    ok "status='$s' allowed"
  else
    miss "status='$s' NOT in the bookings_status_check constraint"
    issues=$((issues+1))
  fi
done
echo

# ---- RPCs -----------------------------------------------------------------
echo "== RPCs =="
required_rpcs=(
  search_providers_rpc
  providers_in_bbox
  st_distance_to_provider
  count_recent_bookings_in_area
  get_user_location_geo
  check_availability_rpc
  upsert_places_provider
)
for r in "${required_rpcs[@]}"; do
  exists="$(psql_q "select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='${r}')")"
  if [ "$exists" = "t" ]; then
    ok "${r}()"
  else
    miss "${r}() missing"
    issues=$((issues+1))
  fi
done
echo

# ---- Seed counts ----------------------------------------------------------
echo "== Seed counts =="
cat_count="$(psql_q "select count(*) from public.service_categories")"
prov_count="$(psql_q "select count(*) from public.providers where source='self_onboarded'")"
echo "  service_categories: ${cat_count}"
echo "  self-onboarded providers: ${prov_count}"
[ "${cat_count}" -ge 16 ] || { warn "Fewer than 16 categories — re-run seed if this is the demo DB"; }
[ "${prov_count}" -ge 25 ] || { warn "Fewer than 25 seed providers — re-run seed if this is the demo DB"; }
echo

# ---- Pending migrations (supabase CLI) ------------------------------------
echo "== Pending migrations =="
if command -v supabase >/dev/null 2>&1; then
  if supabase db diff --linked --schema public >/tmp/sb-diff.out 2>&1; then
    if [ ! -s /tmp/sb-diff.out ]; then
      ok "No diff between local migrations and remote schema"
    else
      bytes="$(wc -c </tmp/sb-diff.out | tr -d ' ')"
      if [ "$bytes" -lt 4 ]; then
        ok "No diff between local migrations and remote schema"
      else
        warn "Schema diff detected — review /tmp/sb-diff.out"
      fi
    fi
  else
    warn "supabase db diff failed (project may not be linked yet)"
    head -n 3 /tmp/sb-diff.out 2>/dev/null || true
  fi
else
  warn "supabase CLI missing — install to use db diff"
fi
echo

# ---- Summary --------------------------------------------------------------
if [ "$issues" -eq 0 ]; then
  printf "${GREEN}DB verification passed.${NC}  Schema looks healthy.\n"
  exit 0
else
  printf "${RED}DB verification found %d issue(s).${NC}\n" "$issues"
  echo "If you own this DB, you can apply pending migrations with:"
  echo "    pnpm db:push           # migrations only, no seed"
  echo "    pnpm db:seed           # idempotent seed (safe to re-run)"
  echo "If this is a shared / production DB, hand the report above to whoever owns it."
  exit 1
fi
