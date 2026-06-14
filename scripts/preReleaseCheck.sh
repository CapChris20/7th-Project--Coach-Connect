#!/bin/bash
# Run before EAS production build or after deploy — blocks broken releases.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "========================================="
echo " Coach Connect — pre-release checks"
echo "========================================="
echo ""

"$ROOT_DIR/scripts/checkLocalEnv.sh"
echo ""
npm run test:quality
echo ""
"$ROOT_DIR/scripts/verifyProductionApi.sh"

echo ""
echo "========================================="
echo "✅ Safe to ship (API + .env look good)"
echo "========================================="
echo ""
echo "For APK/AAB: use  npm run build:production"
echo "That runs these checks, then  eas build --profile production"
