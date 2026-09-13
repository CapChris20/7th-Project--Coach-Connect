#!/bin/bash
# Fail if Cloud Run is missing API keys or AI Coach is not ready.
# Usage: ./scripts/verifyProductionApi.sh [base-url]
# Optional: ALLOW_STRIPE_TEST_KEYS=1  → allow sk_test_/pk_test_ for TestFlight-only (still fails on webhook 404)
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
WORKOUT_STATUS="$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 -X POST "${BASE}/api/workout/generate" -H "Content-Type: application/json" -d '{}' || true)"
SUBSCRIPTION_VERIFY_STATUS="$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 -X POST "${BASE}/api/subscription/apple/verify" -H "Content-Type: application/json" -d '{}' || true)"
STRIPE_CREATE_STATUS="$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 -X POST "${BASE}/api/stripe/create-account" -H "Content-Type: application/json" -d '{}' || true)"
STRIPE_WEBHOOK_STATUS="$(curl -s -o /dev/null -w "%{http_code}" --max-time 25 -X POST "${BASE}/api/stripe/webhook" -H "Content-Type: application/json" -d '{}' || true)"

STRIPE_KEY_MODE="missing"
if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  case "$STRIPE_SECRET_KEY" in
    sk_live_*) STRIPE_KEY_MODE="live" ;;
    sk_test_*) STRIPE_KEY_MODE="test" ;;
    *) STRIPE_KEY_MODE="unknown" ;;
  esac
fi
PUB_KEY_MODE="missing"
if [ -n "${EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" ]; then
  case "$EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY" in
    pk_live_*) PUB_KEY_MODE="live" ;;
    pk_test_*) PUB_KEY_MODE="test" ;;
    *) PUB_KEY_MODE="unknown" ;;
  esac
fi

ALLOW_TEST="${ALLOW_STRIPE_TEST_KEYS:-0}"

node -e "
const raw = process.argv[1];
const youtubeRaw = process.argv[2];
const workoutStatus = String(process.argv[3] || '');
const subscriptionVerifyStatus = String(process.argv[4] || '');
const stripeCreateStatus = String(process.argv[5] || '');
const stripeWebhookStatus = String(process.argv[6] || '');
const stripeKeyMode = String(process.argv[7] || 'missing');
const pubKeyMode = String(process.argv[8] || 'missing');
const allowTest = String(process.argv[9] || '0') === '1';

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
if (workoutStatus === '404') {
  fail('POST /api/workout/generate returned 404 — stale Cloud Run revision is missing workout route');
}
if (subscriptionVerifyStatus === '404') {
  fail('POST /api/subscription/apple/verify returned 404 — stale Cloud Run revision is missing IAP subscription routes');
}
if (stripeCreateStatus === '404') {
  fail('POST /api/stripe/create-account returned 404 — stale Cloud Run revision is missing Stripe Connect routes');
}
if (stripeCreateStatus !== '401' && stripeCreateStatus !== '400') {
  fail('POST /api/stripe/create-account returned ' + stripeCreateStatus + ' — expected 401 (no auth) or 400 (bad body)');
}
if (subscriptionVerifyStatus !== '401' && subscriptionVerifyStatus !== '400') {
  fail('POST /api/subscription/apple/verify returned ' + subscriptionVerifyStatus + ' — expected 401 (no auth) or 400 (missing token)');
}
if (stripeWebhookStatus === '404') {
  fail('POST /api/stripe/webhook returned 404 — deploy server with stripeWebhookRoutes before claiming payments are production-ready');
}
if ((stripeKeyMode === 'test' || pubKeyMode === 'test') && !allowTest) {
  fail('Stripe keys are still TEST mode (sk_test_/pk_test_). For real users switch to live keys, or set ALLOW_STRIPE_TEST_KEYS=1 for intentional TestFlight-only builds.');
}
if ((stripeKeyMode === 'test' || pubKeyMode === 'test') && allowTest) {
  console.warn('⚠️  ALLOW_STRIPE_TEST_KEYS=1 — test Stripe keys allowed (TestFlight / sandbox only). Not safe for real money.');
}
if (stripeKeyMode === 'missing') {
  console.warn('⚠️  STRIPE_SECRET_KEY missing in local .env — confirm Cloud Run has the intended key.');
}
if (!h.supportEmailReady) {
  console.warn('⚠️  supportEmailReady is false — Contact/Bug opens mailto to ' + (h.supportInbox || 'coachconnect0@gmail.com') + '.');
  console.warn('    Optional: add RESEND_API_KEY or SMTP_* + syncCloudRunEnv for automatic delivery.');
}

console.log('✅ Production API OK');
console.log('   deepseek:', h.deepseek, '| perplexity:', h.perplexity, '| serper:', h.serper, '| youtube:', youtubeOk);
console.log('   aiCoachReady:', h.aiCoachReady, '| firebaseAdmin:', h.firebaseAdmin);
console.log('   workoutRouteStatus:', workoutStatus || 'unknown');
console.log('   subscriptionVerifyRouteStatus:', subscriptionVerifyStatus || 'unknown');
console.log('   stripeCreateRouteStatus:', stripeCreateStatus || 'unknown');
console.log('   stripeWebhookRouteStatus:', stripeWebhookStatus || 'unknown');
console.log('   stripeKeyMode:', stripeKeyMode, '| publishableKeyMode:', pubKeyMode);
console.log('   supportEmailReady:', h.supportEmailReady, '| supportInbox:', h.supportInbox || '(default coachconnect0@gmail.com)');
" "$RAW" "$YOUTUBE_RAW" "$WORKOUT_STATUS" "$SUBSCRIPTION_VERIFY_STATUS" "$STRIPE_CREATE_STATUS" "$STRIPE_WEBHOOK_STATUS" "$STRIPE_KEY_MODE" "$PUB_KEY_MODE" "$ALLOW_TEST"
