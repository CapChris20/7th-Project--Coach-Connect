#!/bin/bash

echo "🚀 Anatrox Trainer-Client Onboarding Test Setup"
echo "=============================================="

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Firebase Admin SDK for seeding
echo "📦 Installing Firebase Admin SDK..."
npm install firebase-admin

# Start Firebase emulators in background
echo "🔥 Starting Firebase emulators..."
firebase emulators:start --only firestore &
EMULATOR_PID=$!

# Wait for emulators to start
echo "⏳ Waiting for emulators to start..."
sleep 10

# Seed test data
echo "🌱 Seeding test data..."
node scripts/seedTestData.js

# Run iOS Simulator
echo "📱 Launching iOS Simulator..."
npx react-native run-ios --simulator="iPhone 15"

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    kill $EMULATOR_PID 2>/dev/null
    exit 0
}

# Trap to cleanup on script exit
trap cleanup EXIT

echo "✅ Setup complete!"
echo ""
echo "📋 Test Cases:"
echo "1. Client sends first message → Trainer sees modal"
echo "2. Trainer adds client → Collections initialize"
echo "3. Real-time updates (workouts/messages)"
echo "4. Trainer rejects client → Client sees rejection"
echo ""
echo "🔧 Debugging Tools:"
echo "- Flipper: Monitor Firestore queries"
echo "- Safari Web Inspector: Debug UI components"
echo "- Xcode Console: Check native errors"
echo ""
echo "🌐 Firebase Emulator UI: http://localhost:4000"
echo ""
echo "Press Ctrl+C to stop emulators"

# Keep script running
wait
