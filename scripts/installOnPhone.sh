#!/usr/bin/env bash
# Install Coach Connect on YOUR iPhone — any Apple ID on the phone is fine.
# Skips TestFlight. Registers your device UDID, then builds an internal .ipa.
#
# Usage:
#   bash scripts/installOnPhone.sh
#   bash scripts/installOnPhone.sh --build-only   # skip device registration
#
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

TEAM_ID="PFTT3AW4H3"
BUILD_ONLY=false
if [[ "${1:-}" == "--build-only" ]]; then
  BUILD_ONLY=true
fi

echo ""
echo "══════════════════════════════════════════════════════════"
echo " Coach Connect — install on your iPhone (any Apple ID)"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "This does NOT use TestFlight."
echo "Your phone Apple ID can be different from your dev account."
echo ""

if [[ "$BUILD_ONLY" == false ]]; then
  echo "STEP 1 — Register your iPhone"
  echo "────────────────────────────"
  echo "A URL or QR code will appear. Open it ON YOUR IPHONE (Safari)."
  echo "Follow prompts to register this device with Apple (~30 seconds)."
  echo ""
  read -r -p "Press Enter to open device registration..."
  eas device:create --apple-team-id "$TEAM_ID"
  echo ""
  echo "✓ If registration succeeded, continue to Step 2."
  echo ""
fi

echo "STEP 2 — Sync Firebase/API env to EAS (required or app crashes on launch)"
echo "──────────────────────────────────────────────────────────────────────────"
bash "$ROOT_DIR/scripts/syncEasEnv.sh"
echo ""

echo "STEP 3 — Build internal install (preview profile, ~15–25 min on EAS)"
echo "────────────────────────────────────────────────────────────────────"
read -r -p "Start the build now? [y/N] " confirm
if [[ ! "$confirm" =~ ^[yY] ]]; then
  echo "Cancelled. Run again when ready:"
  echo "  bash scripts/installOnPhone.sh --build-only"
  exit 0
fi

eas build --profile preview --platform ios

echo ""
echo "STEP 4 — Install on phone"
echo "─────────────────────────"
echo "When the build finishes, open the link EAS prints (or go to):"
echo "  https://expo.dev/accounts/capchris20/projects/anatrox-app/builds"
echo ""
echo "Open that install link ON YOUR IPHONE in Safari → tap Install."
echo "Settings → General → VPN & Device Management → trust if prompted."
echo ""
