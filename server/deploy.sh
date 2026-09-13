#!/bin/bash
set -e

PROJECT_ID="anatrox-auth"
SERVICE_NAME="coachconnect-api"
REGION="us-central1"

# Dockerfile lives at repo root and copies server/, src/shared/, etc.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "========================================="
echo " CoachConnect API → Google Cloud Run"
echo "========================================="
echo ""
echo "📁 Build context: $ROOT_DIR"
echo ""

# Check gcloud is installed
if ! command -v gcloud &> /dev/null; then
  echo "❌ gcloud CLI not installed."
  echo "   Install it: https://cloud.google.com/sdk/docs/install"
  echo "   Then run: gcloud auth login"
  exit 1
fi

# Check logged in
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [ -z "$ACCOUNT" ] || [ "$ACCOUNT" = "(unset)" ]; then
  echo "❌ Not logged in. Run: gcloud auth login"
  exit 1
fi
echo "✅ Logged in as: $ACCOUNT"

# Set project
gcloud config set project "$PROJECT_ID" 2>/dev/null
echo "✅ Project: $PROJECT_ID"
echo "✅ Region: $REGION"
echo ""

if [ ! -f "$ROOT_DIR/Dockerfile" ]; then
  echo "❌ Missing $ROOT_DIR/Dockerfile — run this script from the Coach Connect repo."
  exit 1
fi

# Build & deploy in one step (Cloud Build + Cloud Run)
echo "🚀 Building and deploying..."
echo ""

# IMPORTANT: --set-env-vars REPLACES all vars and wipes API keys.
# Use --update-env-vars so DEEPSEEK_API_KEY etc. survive redeploys.
gcloud run deploy "$SERVICE_NAME" \
  --source "$ROOT_DIR" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 300 \
  --update-env-vars "NODE_ENV=production"

echo ""
echo "🔑 Syncing API keys from .env..."
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "❌ Missing $ROOT_DIR/.env — cannot sync API keys. Deploy aborted."
  exit 1
fi
"$ROOT_DIR/scripts/checkLocalEnv.sh"
"$ROOT_DIR/scripts/syncCloudRunEnv.sh"

echo ""
echo "🩺 Verifying production API (blocks broken deploys)..."
"$ROOT_DIR/scripts/verifyProductionApi.sh"

echo ""
echo "========================================="
echo "✅ DEPLOYED & VERIFIED"
echo "========================================="
echo ""
echo "Your API URL:"
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)'
echo ""
echo "Next steps:"
echo "  1. Set env vars in Google Cloud Console → Cloud Run → $SERVICE_NAME → Edit → Variables"
echo "     Required for AI Coach + food search (same service as npm run server):"
echo "       DEEPSEEK_API_KEY           (AI Coach chat)"
echo "       OPENAI_API_KEY             (AI Coach photo vision - gpt-4o-mini)"
echo "       PERPLEXITY_API_KEY         (AI Coach web search)"
echo "       SERPER_API_KEY             (food search + AI web fallback)"
echo "       USDA_API_KEY               (grocery food search)"
echo "       FIREBASE_SERVICE_ACCOUNT   (full service-account JSON — weekly context + tools)"
echo "     Recommended:"
echo "       APP_SECRET"
echo "       ANTHROPIC_API_KEY"
echo "     Also grant the Cloud Run service account Firebase Admin (IAM) if not using JSON env."
echo "     AI_COACH_ENFORCE_LIMITS=1 is set by syncCloudRunEnv.sh (daily AI caps ON in prod)."
echo "     Set AI_COACH_ENFORCE_LIMITS=0 only for an emergency unlimited override."
echo ""
echo "  2. Update your .env file:"
echo "     EXPO_PUBLIC_API_BASE_URL=<the URL printed above>"
echo ""
echo "  3. Sync API keys from your .env (required for AI Coach on Cloud Run):"
echo "     ./scripts/syncCloudRunEnv.sh"
echo ""
echo "  4. Verify: curl <service-url>/api/health  → aiCoachReady: true"
echo ""
echo "  5. Rebuild/reload your Expo app (EXPO_PUBLIC_API_BASE_URL must match service URL)"
echo ""
