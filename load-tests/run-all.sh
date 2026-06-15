#!/bin/bash

BASE_URL=${1:-"http://localhost:8080"}
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
RESULTS_FILE="load-tests/results/run_${TIMESTAMP}.txt"

mkdir -p load-tests/results

echo "CoachConnect Load Test Results" > $RESULTS_FILE
echo "==============================" >> $RESULTS_FILE
echo "Timestamp: $(date)" >> $RESULTS_FILE
echo "Target: $BASE_URL" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE
echo "All results saved to: $RESULTS_FILE"
echo ""

run_test() {
  local TEST_NAME=$1
  local TEST_FILE=$2

  echo "Running: $TEST_NAME..."
  echo "=== $TEST_NAME ===" >> $RESULTS_FILE
  echo "Started: $(date)" >> $RESULTS_FILE
  echo "" >> $RESULTS_FILE

  k6 run --env BASE_URL=$BASE_URL $TEST_FILE 2>&1 | tee -a $RESULTS_FILE

  local EXIT_CODE=${PIPESTATUS[0]}

  echo "" >> $RESULTS_FILE
  echo "Finished: $(date)" >> $RESULTS_FILE

  if [ $EXIT_CODE -eq 0 ]; then
    echo "Result: PASSED" >> $RESULTS_FILE
    echo "✅ $TEST_NAME PASSED"
  else
    echo "Result: FAILED" >> $RESULTS_FILE
    echo "❌ $TEST_NAME FAILED"
  fi

  echo "==============================" >> $RESULTS_FILE
  echo "" >> $RESULTS_FILE
}

run_test "1 - AI Coach Load Test" load-tests/aiCoach.js

run_test "2 - Food Search Load Test" load-tests/foodSearch.js

run_test "3 - Workout Generation (MOCKED)" load-tests/workoutGeneration.js

run_test "4 - Auth Spike Test" load-tests/authSpike.js

run_test "5 - Malicious User Test" load-tests/maliciousUser.js

run_test "6 - Bot Users Test" load-tests/botUsers.js

run_test "7 - Barcode Spike Test" load-tests/barcodeSpike.js

run_test "8 - Trainer Dashboard Test" load-tests/trainerDashboard.js

run_test "9 - Midnight Rollover Test" load-tests/midnightRollover.js

run_test "10 - Long Coach Session Test" load-tests/longCoachSession.js

echo "" >> $RESULTS_FILE
echo "==============================" >> $RESULTS_FILE
echo "SUMMARY" >> $RESULTS_FILE
echo "==============================" >> $RESULTS_FILE
echo "All tests complete: $(date)" >> $RESULTS_FILE
echo "Results file: $RESULTS_FILE" >> $RESULTS_FILE
echo "" >> $RESULTS_FILE
echo "NOTE: Cold start test run manually:" >> $RESULTS_FILE
echo "Scale Cloud Run to 0 instances first" >> $RESULTS_FILE
echo "Then run:" >> $RESULTS_FILE
echo "k6 run --env BASE_URL=$BASE_URL load-tests/coldStartRecovery.js" >> $RESULTS_FILE

echo ""
echo "=============================="
echo "All tests complete"
echo "Results saved to: $RESULTS_FILE"
echo ""
echo "NOTE: Run cold start test manually:"
echo "Scale Cloud Run to 0 instances first"
echo "k6 run --env BASE_URL=$BASE_URL load-tests/coldStartRecovery.js"
