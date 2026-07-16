#!/bin/bash
# Push API keys from project .env to Cloud Run (run once after deploy).
set -euo pipefail

PROJECT_ID="anatrox-auth"
SERVICE_NAME="coachconnect-api"
REGION="us-central1"

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

if [ -z "${DEEPSEEK_API_KEY:-}" ]; then
  echo "❌ DEEPSEEK_API_KEY not set in .env — AI Coach will not work on Cloud Run."
  exit 1
fi

VARS="NODE_ENV=production"
[ -n "${DEEPSEEK_API_KEY:-}" ] && VARS+=",DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}"
[ -n "${OPENAI_API_KEY:-}" ] && VARS+=",OPENAI_API_KEY=${OPENAI_API_KEY}"
[ -n "${REPLICATE_API_TOKEN:-}" ] && VARS+=",REPLICATE_API_TOKEN=${REPLICATE_API_TOKEN}"
[ -n "${PERPLEXITY_API_KEY:-}" ] && VARS+=",PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY}"
[ -n "${SERPER_API_KEY:-}" ] && VARS+=",SERPER_API_KEY=${SERPER_API_KEY}"
[ -n "${USDA_API_KEY:-}" ] && VARS+=",USDA_API_KEY=${USDA_API_KEY}"
[ -n "${APP_SECRET:-}" ] && VARS+=",APP_SECRET=${APP_SECRET}"
# Server reads ANTHROPIC_API_KEY only (not EXPO_PUBLIC_*). Many .env files still use the Expo name.
ANTHROPIC_FOR_CLOUD="${ANTHROPIC_API_KEY:-${EXPO_PUBLIC_ANTHROPIC_API_KEY:-${EXPO_PUBLIC_CLAUDE_API_KEY:-}}}"
if [ -n "$ANTHROPIC_FOR_CLOUD" ]; then
  VARS+=",ANTHROPIC_API_KEY=${ANTHROPIC_FOR_CLOUD}"
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo "ℹ️  Using EXPO_PUBLIC_CLAUDE/ANTHROPIC key as ANTHROPIC_API_KEY on Cloud Run (workout plans)."
  fi
else
  echo "⚠️  No ANTHROPIC_API_KEY (or EXPO_PUBLIC_CLAUDE_API_KEY) in .env — workout plan generation will return 503 on Cloud Run."
fi

if [ -n "${OPENAI_API_KEY:-}" ]; then
  echo "ℹ️  OPENAI_API_KEY will sync — AI Coach photos use gpt-4o-mini vision."
elif [ -n "${REPLICATE_API_TOKEN:-}" ]; then
  echo "ℹ️  REPLICATE_API_TOKEN will sync — AI Coach photos use legacy DeepSeek-VL2 fallback."
else
  echo "⚠️  No OPENAI_API_KEY or REPLICATE_API_TOKEN in .env — AI Coach photo analysis will not work on Cloud Run."
fi

YOUTUBE_KEY="${YOUTUBE_API_KEY:-${REACT_NATIVE_YOUTUBE_API_KEY:-}}"
if [ -n "$YOUTUBE_KEY" ]; then
  VARS+=",YOUTUBE_API_KEY=${YOUTUBE_KEY}"
  VARS+=",REACT_NATIVE_YOUTUBE_API_KEY=${YOUTUBE_KEY}"
else
  echo "⚠️  No YOUTUBE_API_KEY or REACT_NATIVE_YOUTUBE_API_KEY in .env — exercise library videos will not load on Cloud Run."
fi

# Support + password-reset email (Contact Support, Report a Bug, forgot-password).
# Option A — Resend: RESEND_API_KEY=re_...  (+ verified SUPPORT_EMAIL_FROM domain for production)
# Option B — Gmail SMTP: SMTP_HOST=smtp.gmail.com SMTP_USER=coachconnect0@gmail.com SMTP_PASS=<app password>
SUPPORT_INBOX="${SUPPORT_INBOX_EMAIL:-coachconnect0@gmail.com}"
VARS+=",SUPPORT_INBOX_EMAIL=${SUPPORT_INBOX}"

if [ -n "${RESEND_API_KEY:-}" ]; then
  VARS+=",RESEND_API_KEY=${RESEND_API_KEY}"
  [ -n "${SUPPORT_EMAIL_FROM:-}" ] && VARS+=",SUPPORT_EMAIL_FROM=${SUPPORT_EMAIL_FROM}"
  [ -n "${PASSWORD_RESET_EMAIL_FROM:-}" ] && VARS+=",PASSWORD_RESET_EMAIL_FROM=${PASSWORD_RESET_EMAIL_FROM}"
  echo "ℹ️  RESEND_API_KEY will sync — in-app Contact Support / Report a Bug will email ${SUPPORT_INBOX}."
elif [ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASS:-}" ]; then
  VARS+=",SMTP_HOST=${SMTP_HOST},SMTP_USER=${SMTP_USER},SMTP_PASS=${SMTP_PASS}"
  [ -n "${SMTP_PORT:-}" ] && VARS+=",SMTP_PORT=${SMTP_PORT}"
  [ -n "${SMTP_SECURE:-}" ] && VARS+=",SMTP_SECURE=${SMTP_SECURE}"
  [ -n "${SMTP_FROM:-}" ] && VARS+=",SMTP_FROM=${SMTP_FROM}"
  echo "ℹ️  SMTP_* will sync — in-app Contact Support / Report a Bug will email ${SUPPORT_INBOX}."
else
  echo "⚠️  No RESEND_API_KEY or SMTP_* in .env — support tickets still save to Firestore; inbox email needs a provider."
  echo "    Add RESEND_API_KEY=re_... or Gmail SMTP (see server/supportEmail.js) then re-run this script."
fi

# Stripe (Connect + client payments). Secret key is server-only; publishable key optional on Cloud Run.
if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  VARS+=",STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}"
  echo "ℹ️  STRIPE_SECRET_KEY will sync — Stripe server API calls enabled on Cloud Run."
else
  echo "⚠️  No STRIPE_SECRET_KEY in .env — Stripe payment routes will not work on Cloud Run."
fi
[ -n "${STRIPE_PUBLISHABLE_KEY:-}" ] && VARS+=",STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}"

# IconScout (icons / illustrations API — server-side only)
if [ -n "${ICONSCOUT_CLIENT_ID:-}" ] && [ -n "${ICONSCOUT_CLIENT_SECRET:-}" ]; then
  VARS+=",ICONSCOUT_CLIENT_ID=${ICONSCOUT_CLIENT_ID},ICONSCOUT_CLIENT_SECRET=${ICONSCOUT_CLIENT_SECRET}"
  echo "ℹ️  ICONSCOUT_CLIENT_ID / ICONSCOUT_CLIENT_SECRET will sync."
elif [ -n "${ICONSCOUT_CLIENT_ID:-}" ] || [ -n "${ICONSCOUT_CLIENT_SECRET:-}" ]; then
  echo "⚠️  IconScout partial — set both ICONSCOUT_CLIENT_ID and ICONSCOUT_CLIENT_SECRET in .env."
fi

echo "Updating Cloud Run env vars (not including FIREBASE_SERVICE_ACCOUNT — set that in Console as JSON)..."
gcloud config set project "$PROJECT_ID" 2>/dev/null
gcloud run services update "$SERVICE_NAME" \
  --region "$REGION" \
  --update-env-vars "$VARS"

echo ""
echo "✅ Keys synced to Cloud Run."
sleep 3
"$ROOT_DIR/scripts/verifyProductionApi.sh"
