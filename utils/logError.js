// Check if we're in Node.js (for scripts) or React Native (for app)
// React Native doesn't have process.versions.node
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const { getApiBase } = require('../src/shared/services/baseUrl');

// Lazy load fs and path only when needed (in Node.js)
function getFs() {
  if (!isNode) return null;
  try {
    return require("fs");
  } catch (e) {
    return null;
  }
}

function getPath() {
  if (!isNode) return null;
  try {
    return require("path");
  } catch (e) {
    return null;
  }
}

function getErrorLogFile() {
  if (!isNode) return null;
  const path = getPath();
  if (!path) return null;
  try {
    return path.join(__dirname, "..", "ERRORS.md");
  } catch (e) {
    return null;
  }
}

// Also try to log to Firestore if available (optional)
let db = null;
let dbChecked = false;
function getDb() {
  if (dbChecked) return db;
  dbChecked = true;
  try {
    // Use dynamic require to avoid Metro bundler issues
    if (typeof require !== 'undefined') {
      // Try multiple possible paths
      let firebaseConfig = null;
      try {
        firebaseConfig = require("../src/app/config");
      } catch (e1) {
        try {
          firebaseConfig = require("../src/app/config");
        } catch (e2) {
          try {
            firebaseConfig = require("@/app/config");
          } catch (e3) {
            // All paths failed, give up
            console.warn('⚠️ Could not load Firestore config from any path');
            return null;
          }
        }
      }
      
      if (firebaseConfig && firebaseConfig.db) {
        db = firebaseConfig.db;
        console.log('✅ Firestore db loaded for error logging');
      } else {
        console.warn('⚠️ Firestore db is null - errors won\'t be logged to Firestore');
      }
    }
  } catch (e) {
    console.warn('⚠️ Could not load Firestore config:', e.message);
  }
  return db;
}

function formatTimestamp(date) {
  const now = date || new Date();
  const dateStr = now.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  return `${dateStr} at ${timeStr}`;
}

/**
 * Logs EVERY SINGLE ERROR to ERRORS.md
 * This function does NOT filter or skip any errors - all errors are logged
 * @param {Error|Object} error - The error object to log
 * @param {string} context - Context where the error occurred (e.g., "API", "NutritionScreen")
 */
async function logError(error, context) {
  const now = new Date();
  const timestamp = now.toISOString();
  const readableTime = formatTimestamp(now);
  const errorData = {
    message: error?.message || "Unknown error",
    code: error?.code || null,
    stack: error?.stack || null,
    context: context || "Unknown",
    timestamp,
    readableTime,
  };

  // Write to file only in Node.js environment (scripts)
  const fs = getFs();
  const ERROR_LOG_FILE = getErrorLogFile();
  
  if (isNode && fs && ERROR_LOG_FILE) {
    try {
      let existingContent = "";
      if (fs.existsSync(ERROR_LOG_FILE)) {
        existingContent = fs.readFileSync(ERROR_LOG_FILE, "utf8");
      }

      // Remove the "No errors logged yet" message if it exists
      if (existingContent.includes("No errors logged yet")) {
        existingContent = existingContent.split("No errors logged yet")[0];
      }
      
      // Log EVERY error - no filtering, no skipping

      // Extract current error count
      const countMatch = existingContent.match(/Total Errors: (\d+)/);
      const currentCount = countMatch ? parseInt(countMatch[1]) : 0;
      const newCount = currentCount + 1;

      // Format new error entry (plain text format)
      const errorEntry = `================================================================================
ERROR ${newCount}
================================================================================

Message: ${errorData.message}
Code: ${errorData.code || "None"}
Context: ${errorData.context}
Time: ${errorData.readableTime}
Timestamp: ${errorData.timestamp}
Stack Trace:
${errorData.stack || "No stack trace"}

`;

      // Rebuild the file - new errors go at the top
      const readableUpdateTime = formatTimestamp(now);
      let newContent = `🔥 ANATROX ERROR LOG
================================================================================

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${newCount}

Last updated: ${readableUpdateTime}

`;
      
      // Add new error first
      newContent += errorEntry;

      // Append existing errors (skip the header and count line)
      if (existingContent) {
        const errorsStart = existingContent.indexOf("================================================================================");
        if (errorsStart !== -1) {
          const existingErrors = existingContent.substring(errorsStart);
          newContent += existingErrors;
        }
      }

      fs.writeFileSync(ERROR_LOG_FILE, newContent, "utf8");
      console.log(`✅ Error logged to ${ERROR_LOG_FILE}`);
    } catch (fileError) {
      console.error("Failed to write error to file:", fileError);
    }
  } else {
    // In React Native, send error to server which writes to ERRORS.md
    // Also queue in AsyncStorage as backup
    try {
      // Try to send to server endpoint (if server is running)
      const getBaseUrl = () => {
        return getApiBase();
      };

      const baseUrl = getBaseUrl();
      (async () => {
        try {
          const { getApiAuthHeaders } = require('../src/shared/api/getAuthHeaders');
          const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
          if (!headers.Authorization) return;
          await fetch(`${baseUrl}/api/log-error`, {
            method: 'POST',
            headers,
            body: JSON.stringify(errorData),
          });
        } catch (_) {
          /* queue below */
        }
      })().catch(() => {
        // Server not available, queue for later sync
        try {
          const errorSyncModule = require('./syncErrorsToServer');
          if (errorSyncModule && errorSyncModule.queueErrorForSync) {
            errorSyncModule.queueErrorForSync(errorData).catch(() => {});
          }
        } catch (e) {
          // Queueing also failed, just log to console
          console.log("📝 Error:", errorData);
        }
      });
    } catch (e) {
      // Fetch not available or other error, just log to console
      console.log("📝 Error:", errorData);
    }
  }

  // Optionally also log to Firestore if available
  const firestoreDb = getDb();
  if (firestoreDb) {
    try {
      const { addDoc, collection, serverTimestamp } = require("firebase/firestore");
      const docRef = await addDoc(collection(firestoreDb, "app_errors"), {
        ...errorData,
        timestamp: serverTimestamp(),
      });
      console.log('✅ Error logged to Firestore:', docRef.id);
    } catch (firestoreError) {
      // Firestore logging failed - log the failure reason
      console.error("❌ Failed to log error to Firestore:", firestoreError.message);
      console.error("   Error code:", firestoreError.code);
      if (firestoreError.code === 'permission-denied') {
        console.error("   💡 Fix: Update Firestore rules to allow creating in app_errors collection");
        console.error("   📋 Go to: Firebase Console → Firestore → Rules");
        console.error("   📋 Copy rules from: docs/FIRESTORE_RULES_WITH_NUTRITION.md");
      } else if (firestoreError.code === 'unavailable') {
        console.error("   💡 Fix: Check your internet connection");
      } else {
        console.error("   Full error:", firestoreError);
      }
    }
  } else {
    console.warn("⚠️ Firestore db not available - error not logged to Firestore");
    console.warn("   This is normal if Firebase isn't initialized yet");
  }
}

module.exports = { logError };

