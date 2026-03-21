// Script to create the app_errors collection by logging a test error
// This makes the collection visible in Firebase Console
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

async function createTestError() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("❌ Firebase configuration is missing. Please check your .env file.");
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // Create a test error to make the collection visible
    const testError = {
      message: "Test error - Collection created",
      code: "TEST",
      context: "createAppErrorsCollection script",
      stack: "This is a test error to create the app_errors collection in Firestore",
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

    await addDoc(collection(db, "app_errors"), testError);
    console.log("✅ Test error logged successfully!");
    console.log("📋 The 'app_errors' collection should now be visible in Firebase Console");
    console.log("\n💡 To view it:");
    console.log("   1. Go to: https://console.firebase.google.com/");
    console.log("   2. Select your project");
    console.log("   3. Go to: Firestore Database");
    console.log("   4. You should now see 'app_errors' collection");
    console.log("\n🗑️  You can delete this test error from the console if you want");
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.error("❌ Permission denied! Firestore rules need to be updated.");
      console.error("\n📋 TO FIX:");
      console.error("   1. Go to Firebase Console → Firestore → Rules");
      console.error("   2. Make sure you have this rule:");
      console.error("      match /app_errors/{errorId} {");
      console.error("        allow read: if true;");
      console.error("        allow create: if request.auth != null;");
      console.error("      }");
      console.error("   3. Copy rules from: docs/FIRESTORE_RULES_WITH_NUTRITION.md");
    } else {
      console.error("❌ Error:", error.message);
    }
    process.exit(1);
  }
}

createTestError();

