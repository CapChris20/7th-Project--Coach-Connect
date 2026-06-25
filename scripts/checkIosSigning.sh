#!/usr/bin/env bash
# Quick check before `expo run:ios --device`.
set -euo pipefail
export LANG=en_US.UTF-8

count="$(security find-identity -v -p codesigning 2>/dev/null | grep -c 'Apple Development' || true)"
if [[ "$count" -eq 0 ]]; then
  echo ""
  echo "No Apple Development certificate found in your login keychain."
  echo ""
  echo "Fix (one-time):"
  echo "  1. Open ios/CoachConnect.xcworkspace in Xcode"
  echo "  2. Select CoachConnect target → Signing & Capabilities"
  echo "  3. Check \"Automatically manage signing\""
  echo "  4. Team: your Apple Developer team (KFTT3AW4H3)"
  echo "  5. Let Xcode create/download the development certificate"
  echo "  6. Re-run: npm run ios"
  echo ""
  exit 1
fi

echo "✓ Found ${count} Apple Development signing identit(ies)"
