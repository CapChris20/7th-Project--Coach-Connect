#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
FAKE_TOKEN="${FAKE_TOKEN:-fake.firebase.token}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
RESULT_DIR="load-tests/results"
mkdir -p "$RESULT_DIR"

run_test() {
  local file="$1"
  echo "Running $file"
  BASE_URL="$BASE_URL" FAKE_TOKEN="$FAKE_TOKEN" k6 run "load-tests/$file" \
    | tee "$RESULT_DIR/${STAMP}_${file%.js}.txt"
}

run_test "aiCoach.js"
run_test "foodSearch.js"
run_test "workoutGeneration.js"
run_test "authSpike.js"
run_test "maliciousUser.js"
run_test "botUsers.js"
run_test "barcodeSpike.js"

echo "Saved results under $RESULT_DIR"
