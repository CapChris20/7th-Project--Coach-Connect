#!/bin/bash
# Runs all June thread gap-fix verification scripts (NOT web-search routing).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "========================================="
echo " Thread gap-fix verification suite"
echo "========================================="
echo ""
echo "Static + unit checks (no web-search routing tests)."
echo ""

node scripts/verifyThreadGapFixes.js
echo ""
node scripts/testWorkoutGenerationServerTs.js
echo ""
node scripts/testWorkoutPlanGenerationSession.js
echo ""
node scripts/testCoachVisionGapFixes.js

echo ""
echo "========================================="
echo "✅ Thread gap-fix suite passed (static)"
echo "========================================="
echo ""
echo "Optional live checks (need .env + running/deployed API):"
echo "  node scripts/testCoachVisionGapFixes.js --live"
echo "  node scripts/testCoachVisionReplicate.js"
echo ""
echo "Manual QA checklist:"
echo "  docs/THREAD_GAP_FIX_MANUAL_QA.md"
echo ""
echo "After code changes, deploy:"
echo "  firebase deploy --only firestore:rules"
echo "  ./server/deploy.sh"
