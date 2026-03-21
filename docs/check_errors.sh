#!/bin/bash
echo "=== FIREBASE ERROR CHECK ==="
echo ""
echo "1. Checking for Firestore permission errors..."
grep -r "permission-denied\|Missing or insufficient" src/ --include="*.js" | head -20
echo ""
echo "2. Checking for Firebase initialization issues..."
grep -r "!db\|db == null\|db === null" src/ --include="*.js" | head -20
echo ""
echo "3. Checking for unhandled Firebase errors..."
grep -r "FirebaseError\|catch.*error" src/ --include="*.js" | grep -v "console\." | head -30
echo ""
echo "4. Recent git changes that might have introduced errors..."
git log --oneline -5
echo ""
echo "=== DONE ==="
