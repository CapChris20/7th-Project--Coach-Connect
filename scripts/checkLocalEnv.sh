#!/bin/bash
# Validate .env before deploy or EAS production build (does not print secrets).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Missing $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

missing=()
[ -z "${DEEPSEEK_API_KEY:-}" ] && missing+=("DEEPSEEK_API_KEY")
[ -z "${EXPO_PUBLIC_API_BASE_URL:-}" ] && missing+=("EXPO_PUBLIC_API_BASE_URL")
[ -z "${EXPO_PUBLIC_FIREBASE_PROJECT_ID:-}" ] && missing+=("EXPO_PUBLIC_FIREBASE_PROJECT_ID")

warn=()
[ -z "${YOUTUBE_API_KEY:-}" ] && [ -z "${REACT_NATIVE_YOUTUBE_API_KEY:-}" ] && warn+=("YOUTUBE_API_KEY or REACT_NATIVE_YOUTUBE_API_KEY (exercise library)")
[ -z "${SERPER_API_KEY:-}" ] && warn+=("SERPER_API_KEY (food search)")
[ -z "${USDA_API_KEY:-}" ] && warn+=("USDA_API_KEY (grocery search)")
[ -z "${PERPLEXITY_API_KEY:-}" ] && warn+=("PERPLEXITY_API_KEY (AI web search)")
[ -z "${STRIPE_WEBHOOK_SECRET:-}" ] && warn+=("STRIPE_WEBHOOK_SECRET (payments webhooks will not verify)")

hard_fail=0
if [ -n "${STRIPE_SECRET_KEY:-}" ] && [[ "$STRIPE_SECRET_KEY" == sk_test_* ]]; then
  if [ "${ALLOW_STRIPE_TEST_KEYS:-0}" = "1" ]; then
    warn+=("STRIPE_SECRET_KEY is sk_test_* (ALLOW_STRIPE_TEST_KEYS=1 — TestFlight only)")
  else
    echo "❌ STRIPE_SECRET_KEY is still sk_test_* — real charges need sk_live_*, or set ALLOW_STRIPE_TEST_KEYS=1 for sandbox-only"
    hard_fail=1
  fi
fi
if [ -n "${EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" ] && [[ "$EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY" == pk_test_* ]]; then
  if [ "${ALLOW_STRIPE_TEST_KEYS:-0}" != "1" ]; then
    echo "❌ EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is still pk_test_* — real charges need pk_live_*, or set ALLOW_STRIPE_TEST_KEYS=1"
    hard_fail=1
  fi
fi

if [ "${#missing[@]}" -gt 0 ]; then
  echo "❌ Required in .env:"
  printf '   - %s\n' "${missing[@]}"
  exit 1
fi

if [ "$hard_fail" -eq 1 ]; then
  exit 1
fi

if [[ ! "$EXPO_PUBLIC_API_BASE_URL" =~ run\.app ]]; then
  echo "⚠️  EXPO_PUBLIC_API_BASE_URL does not look like Cloud Run (*.run.app):"
  echo "   $EXPO_PUBLIC_API_BASE_URL"
  echo "   Production APKs should point at Cloud Run, not localhost."
fi

if [ "${#warn[@]}" -gt 0 ]; then
  echo "⚠️  Recommended / shipping notes:"
  printf '   - %s\n' "${warn[@]}"
fi

echo "✅ Local .env has required keys for production deploy"
