#!/usr/bin/env bash
# Runs Firestore security rules Jest suite (starts emulator automatically if needed).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${JAVA_HOME:-}" ] && [ -x "/opt/homebrew/opt/openjdk@17/bin/java" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

exec node ./scripts/runJestWithLog.js --runInBand server/__tests__/firestore.rules.test.js
