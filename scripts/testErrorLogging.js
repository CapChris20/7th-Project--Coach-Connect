// Test script to verify error logging to Firestore works
require('dotenv').config();
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, serverTimestamp } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

async function testErrorLogging() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("❌ Firebase configuration is missing. Please check your .env file.");
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    console.log("🧪 Testing error logging to Firestore...");
    
    const testError = {
      message: "Test error from testErrorLogging script",
      code: "TEST_ERROR",
      context: "testErrorLogging script",
      stack: "This is a test to verify error logging works",
      timestamp: serverTimestamp(),
      readableTime: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
    };

    const docRef = await addDoc(collection(db, "app_errors"), testError);
    console.log("✅ Test error logged successfully!");
    console.log("📋 Document ID:", docRef.id);
    console.log("\n💡 Check Firebase Console:");
    console.log("   1. Go to: https://console.firebase.google.com/");
    console.log("   2. Select: coachconnect-auth project");
    console.log("   3. Go to: Firestore Database");
    console.log("   4. Click: app_errors collection");
    console.log("   5. You should see this test error");
    
    process.exit(0);
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.error("❌ Permission denied! Firestore rules need to be updated.");
      console.error("\n📋 TO FIX:");
      console.error("   1. Go to Firebase Console → Firestore → Rules");
      console.error("   2. Make sure you have this rule:");
      console.error("      match /app_errors/{errorId} {");
      console.error("        allow read: if true;");
      console.error("        allow create: if true;");
      console.error("      }");
      console.error("   3. Copy rules from: docs/FIRESTORE_RULES_WITH_NUTRITION.md");
      console.error("   4. Publish and wait 30 seconds");
    } else {
      console.error("❌ Error:", error.message);
      console.error("   Code:", error.code);
      console.error("   Full error:", error);
    }
    process.exit(1);
  }
}

testErrorLogging();

