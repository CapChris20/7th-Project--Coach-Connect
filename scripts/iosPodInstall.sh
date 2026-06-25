#!/usr/bin/env bash
# Reliable CocoaPods install after expo prebuild (fixes boost header race + UTF-8 locale).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

cd "$ROOT/ios"

max_attempts=3
for attempt in $(seq 1 "$max_attempts"); do
  echo "→ pod install (attempt ${attempt}/${max_attempts})"
  if pod install --repo-update; then
    echo "✓ CocoaPods installed"
    exit 0
  fi
  echo "⚠ pod install failed; clearing partial ReactNativeDependencies headers and retrying..."
  rm -rf Pods/ReactNativeDependencies/Headers 2>/dev/null || true
  sleep 3
done

echo "✗ pod install failed after ${max_attempts} attempts"
exit 1
