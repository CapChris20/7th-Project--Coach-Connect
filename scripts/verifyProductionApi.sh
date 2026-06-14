#!/bin/bash
# Fail if Cloud Run is missing API keys or AI Coach is not ready.
# Usage: ./scripts/verifyProductionApi.sh [base-url]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
DEFAULT_URL="https://coachconnect-api-421005574501.us-central1.run.app"

if [ -n "${1:-}" ]; then
  BASE="$1"
elif [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  BASE="${EXPO_PUBLIC_API_BASE_URL:-$DEFAULT_URL}"
else
  BASE="$DEFAULT_URL"
fi

BASE="${BASE%/}"
HEALTH_URL="${BASE}/api/health"
YOUTUBE_HEALTH_URL="${BASE}/health"

echo "🔍 Production API health: $HEALTH_URL"

RAW="$(curl -sf --max-time 25 "$HEALTH_URL" 2>/dev/null)" || {
  echo "❌ Could not reach $HEALTH_URL"
  echo "   Check EXPO_PUBLIC_API_BASE_URL in .env and that Cloud Run is deployed."
  exit 1
}

YOUTUBE_RAW="$(curl -sf --max-time 25 "$YOUTUBE_HEALTH_URL" 2>/dev/null)" || YOUTUBE_RAW='{}'

node -e "
const raw = process.argv[1];
const youtubeRaw = process.argv[2];
let h;
let y = {};
try { h = JSON.parse(raw); } catch (e) {
  console.error('❌ Invalid JSON from /api/health');
  process.exit(1);
}
try { y = JSON.parse(youtubeRaw); } catch (_) {}
const fail = (msg) => { console.error('❌ ' + msg); process.exit(1); };
if (!h.firebaseAdmin) fail('firebaseAdmin is false — set FIREBASE_SERVICE_ACCOUNT on Cloud Run');
if (!h.deepseek) fail('deepseek is false — run ./scripts/syncCloudRunEnv.sh');
if (!h.serper) fail('serper is false — SERPER_API_KEY missing on Cloud Run');
if (h.aiCoachReady !== true && h.ok !== true) {
  fail('aiCoachReady is false — AI Coach will return 503. Run ./scripts/syncCloudRunEnv.sh');
}
const youtubeOk = h.youtube === true || y.youtube === true;
if (!youtubeOk) {
  fail('youtube is false — add YOUTUBE_API_KEY (or REACT_NATIVE_YOUTUBE_API_KEY) to .env and run ./scripts/syncCloudRunEnv.sh');
}
console.log('✅ Production API OK');
console.log('   deepseek:', h.deepseek, '| perplexity:', h.perplexity, '| serper:', h.serper, '| youtube:', youtubeOk);
console.log('   aiCoachReady:', h.aiCoachReady, '| firebaseAdmin:', h.firebaseAdmin);
" "$RAW" "$YOUTUBE_RAW"
