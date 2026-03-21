#!/bin/bash
echo "=== FIREBASE ERROR TRACKER ==="
echo ""
echo "This script helps you track Firebase errors from your terminal output."
echo ""
echo "HOW TO USE:"
echo "1. Run your app and let it run for a bit"
echo "2. Copy your terminal output"
echo "3. Save it to a file (e.g., terminal_log.txt)"
echo "4. Run: ./track_firebase_errors.sh terminal_log.txt"
echo ""
echo "Or pipe directly:"
echo "  npx expo start 2>&1 | tee app_log.txt"
echo "  ./track_firebase_errors.sh app_log.txt"
echo ""

if [ -z "$1" ]; then
  echo "=== SCANNING CODE FOR FIREBASE ERROR PATTERNS ==="
  echo ""
  echo "1. Firebase permission errors in code..."
  grep -r "permission-denied\|Missing or insufficient" src/ --include="*.js" | head -20
  echo ""
  echo "2. Firebase initialization checks..."
  grep -r "!db\|db == null\|db === null" src/ --include="*.js" | head -20
  echo ""
  echo "3. Firebase error handling..."
  grep -r "FirebaseError\|catch.*error" src/ --include="*.js" | grep -v "console\." | head -30
  echo ""
  echo "=== DONE ==="
  echo ""
  echo "To track runtime errors, provide a log file:"
  echo "  ./track_firebase_errors.sh your_log_file.txt"
else
  echo "=== ANALYZING LOG FILE: $1 ==="
  echo ""
  
  if [ ! -f "$1" ]; then
    echo "Error: File $1 not found"
    exit 1
  fi
  
  echo "Firebase Errors Found:"
  grep -i "firebaseerror\|permission-denied\|missing or insufficient" "$1" | head -50
  echo ""
  echo "Failed Operations:"
  grep -i "failed to load\|failed to save\|failed to" "$1" | head -30
  echo ""
  echo "Warnings:"
  grep -i "warn.*firebase\|warn.*permission" "$1" | head -20
  echo ""
  echo "=== SUMMARY ==="
  firebase_errors=$(grep -ic "firebaseerror\|permission" "$1" || echo "0")
  failed_ops=$(grep -ic "failed to" "$1" || echo "0")
  echo "Total Firebase errors: $firebase_errors"
  echo "Total failed operations: $failed_ops"
fi
