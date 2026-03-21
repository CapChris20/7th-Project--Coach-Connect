#!/bin/bash

echo "🔍 Capturing ALL errors to ERRORS_NOW.txt..."
echo ""

# Capture Metro/Expo errors
npx expo start --no-dev 2>&1 | tee ERRORS_NOW.txt &
EXPO_PID=$!

# Wait a bit for errors to accumulate
sleep 10

# Kill the process
kill $EXPO_PID 2>/dev/null

echo ""
echo "✅ Errors captured to ERRORS_NOW.txt"
echo "📄 Open that file to see all errors!"



