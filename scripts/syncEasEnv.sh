#!/usr/bin/env bash
# Push EXPO_PUBLIC_* vars from .env to EAS (preview, production, development).
# Required for cloud EAS builds — local .env is NOT uploaded automatically.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Missing $ENV_FILE — create it from your Firebase / API credentials first."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

ENVIRONMENTS=(preview production development)

# Required for any iOS/Android cloud build.
REQUIRED_VARS=(
  EXPO_PUBLIC_API_BASE_URL
  EXPO_PUBLIC_FIREBASE_API_KEY
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
  EXPO_PUBLIC_FIREBASE_PROJECT_ID
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  EXPO_PUBLIC_FIREBASE_APP_ID
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
)

# Optional — synced when present in .env.
OPTIONAL_VARS=(
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  EXPO_PUBLIC_FIRESTORE_FORCE_LONG_POLLING
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
  EXPO_PUBLIC_APP_SECRET
  EXPO_PUBLIC_SUPPORT_EMAIL
)

# Set per EAS profile in eas.json too; synced here for cloud builds.
PROFILE_VARS=(
  EXPO_APPLE_TEAM_ID
  EXPO_PUBLIC_TRAINER_IAP_ENABLED
)

missing=()
for name in "${REQUIRED_VARS[@]}"; do
  val="${!name:-}"
  if [ -z "$val" ]; then
    missing+=("$name")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "❌ Missing required values in .env:"
  printf '   - %s\n' "${missing[@]}"
  exit 1
fi

VARS=("${REQUIRED_VARS[@]}")
for name in "${OPTIONAL_VARS[@]}" "${PROFILE_VARS[@]}"; do
  val="${!name:-}"
  if [ -n "$val" ]; then
    VARS+=("$name")
  fi
done

# Defaults when not in .env (match eas.json production profile).
if [ -z "${EXPO_APPLE_TEAM_ID:-}" ]; then
  EXPO_APPLE_TEAM_ID="PFTT3AW4H3"
  VARS+=("EXPO_APPLE_TEAM_ID")
fi
if [ -z "${EXPO_PUBLIC_TRAINER_IAP_ENABLED:-}" ]; then
  EXPO_PUBLIC_TRAINER_IAP_ENABLED="true"
  VARS+=("EXPO_PUBLIC_TRAINER_IAP_ENABLED")
fi

echo "Syncing ${#VARS[@]} variables to EAS environments: ${ENVIRONMENTS[*]}"
echo "(Values are not printed.)"
echo ""

for name in "${VARS[@]}"; do
  val="${!name}"
  visibility="plaintext"
  case "$name" in
    *API_KEY*|*SECRET*|*CLIENT_ID*) visibility="sensitive" ;;
  esac

  env_flags=()
  for env in "${ENVIRONMENTS[@]}"; do
    env_flags+=(--environment "$env")
  done

  echo "→ $name"
  eas env:create \
    "${env_flags[@]}" \
    --name "$name" \
    --value "$val" \
    --visibility "$visibility" \
    --scope project \
    --force \
    --non-interactive
done

echo ""
echo "✅ EAS env synced. Rebuild preview or production before installing on your phone:"
echo "   eas build --profile preview --platform ios"
echo "   # or use TestFlight (production) — no Developer Mode required"
