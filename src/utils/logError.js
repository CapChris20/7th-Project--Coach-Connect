// Check if we're in Node.js (for scripts) or React Native (for app)
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const { getApiBase } = require('../shared/api/baseUrl');

function getFs() {
  if (!isNode) return null;
  try {
    return require('fs');
  } catch (e) {
    return null;
  }
}

function getPath() {
  if (!isNode) return null;
  try {
    return require('path');
  } catch (e) {
    return null;
  }
}

function getErrorLogFile() {
  if (!isNode) return null;
  const path = getPath();
  if (!path) return null;
  try {
    return path.join(__dirname, '..', '..', 'ERRORS.md');
  } catch (e) {
    return null;
  }
}

let db = null;
let dbChecked = false;
function getDb() {
  if (dbChecked) return db;
  dbChecked = true;
  try {
    if (typeof require !== 'undefined') {
      const firebaseConfig = require('../app-start/config');
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
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
}

async function logError(error, context) {
  const now = new Date();
  const timestamp = now.toISOString();
  const readableTime = formatTimestamp(now);
  const errorData = {
    message: error?.message || 'Unknown error',
    code: error?.code || null,
    stack: error?.stack || null,
    context: context || 'Unknown',
    timestamp,
    readableTime,
  };

  const fs = getFs();
  const ERROR_LOG_FILE = getErrorLogFile();

  if (isNode && fs && ERROR_LOG_FILE) {
    try {
      let existingContent = '';
      if (fs.existsSync(ERROR_LOG_FILE)) {
        existingContent = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
      }

      if (existingContent.includes('No errors logged yet')) {
        existingContent = existingContent.split('No errors logged yet')[0];
      }

      const countMatch = existingContent.match(/Total Errors: (\d+)/);
      const currentCount = countMatch ? parseInt(countMatch[1], 10) : 0;
      const newCount = currentCount + 1;

      const errorEntry = `================================================================================
ERROR ${newCount}
================================================================================

Message: ${errorData.message}
Code: ${errorData.code || 'None'}
Context: ${errorData.context}
Time: ${errorData.readableTime}
Timestamp: ${errorData.timestamp}
Stack Trace:
${errorData.stack || 'No stack trace'}

`;

      const readableUpdateTime = formatTimestamp(now);
      let newContent = `🔥 ANATROX ERROR LOG
================================================================================

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${newCount}

Last updated: ${readableUpdateTime}

`;

      newContent += errorEntry;

      if (existingContent) {
        const errorsStart = existingContent.indexOf('================================================================================');
        if (errorsStart !== -1) {
          const existingErrors = existingContent.substring(errorsStart);
          newContent += existingErrors;
        }
      }

      fs.writeFileSync(ERROR_LOG_FILE, newContent, 'utf8');
      console.log(`✅ Error logged to ${ERROR_LOG_FILE}`);
    } catch (fileError) {
      console.error('Failed to write error to file:', fileError);
    }
  } else {
    try {
      const baseUrl = getApiBase();
      (async () => {
        try {
          const { getApiAuthHeaders } = require('../shared/api/getAuthHeaders');
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
        try {
          const errorSyncModule = require('./syncErrorsToServer');
          if (errorSyncModule && errorSyncModule.queueErrorForSync) {
            errorSyncModule.queueErrorForSync(errorData).catch(() => {});
          }
        } catch (e) {
          console.log('📝 Error:', errorData);
        }
      });
    } catch (e) {
      console.log('📝 Error:', errorData);
    }
  }

  const firestoreDb = getDb();
  if (firestoreDb) {
    try {
      const { addDoc, collection, serverTimestamp } = require('firebase/firestore');
      const docRef = await addDoc(collection(firestoreDb, 'app_errors'), {
        ...errorData,
        timestamp: serverTimestamp(),
      });
      console.log('✅ Error logged to Firestore:', docRef.id);
    } catch (firestoreError) {
      console.error('❌ Failed to log error to Firestore:', firestoreError.message);
    }
  }
}

module.exports = { logError };
