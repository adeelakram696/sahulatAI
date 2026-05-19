#!/usr/bin/env bash
# Quick pre-APK sanity checks.
# Usage: bash scripts/pwa-check.sh <your-prod-url>
set -euo pipefail

URL="${1:-${NEXT_PUBLIC_APP_URL:-}}"
if [ -z "$URL" ]; then
  echo "Usage: bash scripts/pwa-check.sh https://your-app.vercel.app"
  echo "       (or set NEXT_PUBLIC_APP_URL in your env)"
  exit 1
fi
URL="${URL%/}"

echo "============================================"
echo " PWA readiness check for: $URL"
echo "============================================"

check() {
  local label="$1"
  local path="$2"
  local expect_content_type="$3"
  printf "→ %-30s " "$label"
  local out
  out=$(curl -fsSI "$URL$path" 2>/dev/null | head -10 || true)
  if [ -z "$out" ]; then
    echo "❌ no response"
    return 1
  fi
  if [ -n "$expect_content_type" ] && ! echo "$out" | grep -qi "content-type:.*$expect_content_type"; then
    echo "⚠  reached, but content-type is not $expect_content_type"
    echo "$out" | grep -i 'content-type'
    return 1
  fi
  echo "✓ OK"
}

check "Landing page"               "/"                              "text/html"
check "Manifest"                   "/manifest.webmanifest"          "application/manifest+json"
check "Service worker"             "/sw.js"                         "javascript"
check "Icon 192"                   "/icons/icon-192.png"            "image/png"
check "Icon 512"                   "/icons/icon-512.png"            "image/png"
check "assetlinks (TWA)"           "/.well-known/assetlinks.json"   "application/json"

echo ""
echo "If anything is ❌, fix it before packaging the APK."
echo ""
echo "Next: go to https://www.pwabuilder.com and paste $URL"
