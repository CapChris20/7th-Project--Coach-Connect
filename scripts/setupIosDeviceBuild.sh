#!/usr/bin/env bash
# One-shot iOS device build setup: pods, signing check, open Xcode if certs missing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

echo "════════════════════════════════════════════════════════════"
echo " Coach Connect — iOS device build setup"
echo "════════════════════════════════════════════════════════════"

echo ""
echo "→ Installing CocoaPods..."
bash "$ROOT/scripts/iosPodInstall.sh"

WORKSPACE="$ROOT/ios/CoachConnect.xcworkspace"
if [[ ! -d "$WORKSPACE" ]]; then
  echo "✗ Missing $WORKSPACE — run: npm run prebuild:ios"
  exit 1
fi

CERT_COUNT="$(security find-identity -v -p codesigning 2>/dev/null | grep -c 'Apple Development' || true)"

if [[ "$CERT_COUNT" -gt 0 ]]; then
  echo ""
  echo "✓ Apple Development certificate found ($CERT_COUNT)"
  echo "→ Building and installing on device..."
  exec npx expo run:ios --device "Coach Connect iPhone"
fi

echo ""
echo "No development certificate on this Mac yet."
echo "Opening Xcode — complete these steps once:"
echo ""
echo "  1. Xcode → Settings → Accounts → + → sign in with your Apple Developer Apple ID"
echo "  2. Select project CoachConnect → target CoachConnect → Signing & Capabilities"
echo "  3. ✓ Automatically manage signing"
echo "  4. Team: your paid team (KFTT3AW4H3)"
echo "  5. Confirm capabilities: In-App Purchase, Push, Sign in with Apple"
echo "  6. Wait for green checkmark, then close Xcode and run:"
echo "       npm run ios"
echo ""

open "$WORKSPACE"

# Open Xcode Settings → Accounts (best-effort; may require manual navigation on some Xcode versions)
osascript <<'APPLESCRIPT' 2>/dev/null || true
tell application "Xcode"
  activate
end tell
delay 1
tell application "System Events"
  tell process "Xcode"
    try
      click menu item "Settings…" of menu "Xcode" of menu bar 1
    on error
      try
        click menu item "Preferences…" of menu "Xcode" of menu bar 1
      end try
    end try
  end tell
end tell
APPLESCRIPT

echo "Xcode opened. After signing in and fixing signing, run:  npm run ios"
