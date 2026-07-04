require('dotenv').config();
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, orderBy } = require("firebase/firestore");
const fs = require("fs");
const path = require("path");

// Get Firebase config from environment variables (same as config.js)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

async function run() {
  // Validate config
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("❌ Firebase configuration is missing. Please check your .env file.");
    console.error("Required: EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_PROJECT_ID");
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const q = query(collection(db, "app_errors"), orderBy("timestamp", "desc"));
  const snapshot = await getDocs(q);

  const entries = snapshot.docs.map(doc => doc.data());

  const readableUpdateTime = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  let text = `🔥 ANATROX ERROR LOG
================================================================================

Automatically generated list of ALL Firebase & app errors.
This file logs EVERY SINGLE ERROR that occurs.

Total Errors: ${entries.length}

Last updated: ${readableUpdateTime}

`;

  if (entries.length === 0) {
    text += `No errors logged yet.\n`;
  } else {
    entries.forEach((err, i) => {
      const timestamp = err.timestamp?.seconds ? new Date(err.timestamp.seconds * 1000) : null;
      const readableTime = timestamp ? timestamp.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }) : "None";
      
      text += `================================================================================
ERROR ${i + 1}
================================================================================

Message: ${err.message || "Unknown"}
Code: ${err.code ?? "None"}
Context: ${err.context ?? "Unknown"}
Time: ${readableTime}
Timestamp: ${timestamp ? timestamp.toISOString() : "None"}
Stack Trace:
${err.stack ?? "No stack trace"}

`;
    });
  }

  const outputPath = path.join(__dirname, "..", "ERRORS.md");
  fs.writeFileSync(outputPath, text);
  console.log(`✅ ERRORS.txt updated successfully at ${outputPath}`);
  console.log(`   Found ${entries.length} error(s)`);
}

run().catch((error) => {
  if (error.code === 'permission-denied') {
    console.error("❌ Permission denied! You need to update Firestore rules.");
    console.error("\n📋 TO FIX THIS:");
    console.error("1. Go to: https://console.firebase.google.com/");
    console.error("2. Select your project: coachconnect-auth");
    console.error("3. Go to: Firestore Database → Rules");
    console.error("4. Copy the rules from: docs/FIRESTORE_RULES_WITH_NUTRITION.md");
    console.error("5. Make sure the app_errors collection has: allow read: if true;");
    console.error("6. Click 'Publish' and wait 30 seconds");
    console.error("\nThe app_errors rule should look like this:");
    console.error("  match /app_errors/{errorId} {");
    console.error("    allow read: if true;");
    console.error("    allow create: if request.auth != null;");
    console.error("  }");
  } else {
    console.error("❌ Failed to generate error list:", error);
  }
  process.exit(1);
});

