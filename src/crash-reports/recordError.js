// Writes one error to a file (Node scripts) or to the API (the app), and also to Firestore.
// Flow: build one errorData object → Node prepends it to ERRORS.md, the app POSTs
//       /api/log-error without waiting → either way, also add an app_errors document.
// Called from the app's crash path. CommonJS so plain Node scripts can require() it.

// ===== NAMED CONSTANTS =====

const LOG_ERROR_PATH = '/api/log-error';
const APP_ERRORS_COLLECTION = 'app_errors';
const ERRORS_FILE_NAME = 'ERRORS.md';
const ERROR_DIVIDER = '================================================================================';
const EMPTY_LOG_MARKER = 'No errors logged yet';
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const UNKNOWN_CONTEXT = 'Unknown';
const NO_CODE_LABEL = 'None';
const NO_STACK_LABEL = 'No stack trace';
// Manipulate here: how much of a stack we print in the console error-details object elsewhere.
// This file stores the full stack. The 200-char cut lives on the home screen, not here.

// Environment probe: every filesystem branch below hangs off this one flag.
// vocab: process.versions.node = only exists in Node. React Native has no such global,
//        which is how we tell a CLI script apart from the phone.
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const { getApiBase } = require('../for-both/online-connection/whereToConnect');

// ===== HELPER FUNCTIONS =====

// fs and path are required inside the function, not at the top.
// A top-level require('fs') makes Metro try to bundle a Node built-in into the phone app.
function getFs() {
  if (!isNode) return null;
  try {
    return require('fs');
  } catch (ignoredError) {
    return null;
  }
}

function getPath() {
  if (!isNode) return null;
  try {
    return require('path');
  } catch (ignoredError) {
    return null;
  }
}

// vocab: __dirname = folder of this file. Two ".." steps land on the repo root.
// Manipulate here: ERRORS.md is the Node-side log. Renaming the constant moves the file.
function getErrorLogFile() {
  if (!isNode) return null;
  const pathModule = getPath();
  if (!pathModule) return null;
  try {
    return pathModule.join(__dirname, '..', '..', ERRORS_FILE_NAME);
  } catch (ignoredError) {
    return null;
  }
}

// Memoized Firestore handle. dbChecked means we only try the require once.
// Otherwise every logged error would retry a failing import and spam the console.
let db = null;
let dbChecked = false;
function getDb() {
  if (dbChecked) return db;
  dbChecked = true;
  try {
    if (typeof require !== 'undefined') {
      const firebaseConfig = require('../app-start/cloudConnection');
      if (firebaseConfig && firebaseConfig.db) {
        db = firebaseConfig.db;
        console.log('✅ Firestore db loaded for error logging');
      } else {
        console.warn('⚠️ Firestore db is null - errors won\'t be logged to Firestore');
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not load Firestore config:', error.message);
  }
  return db;
}

// "Sep 13, 2026 at 2:48 AM" — the human line in ERRORS.md.
// The ISO string is stored separately. This one is for reading.
// Manipulate here: these options are the date and time shape in the file.
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

/**
 * One shape for the file, the API, and Firestore so the three copies cannot drift.
 * @param {Error|object} error
 * @param {string} context
 * @returns {object}
 */
function buildErrorData(error, recordedAt, context) {
  return {
    message: error?.message || UNKNOWN_ERROR_MESSAGE,
    code: error?.code || null,
    stack: error?.stack || null,
    context: context || UNKNOWN_CONTEXT,
    timestamp: recordedAt.toISOString(),
    readableTime: formatTimestamp(recordedAt),
  };
}

/**
 * The running total lives in the file header. A missing header starts the count at 0.
 * vocab: (\d+) captures the digits after "Total Errors:".
 * @param {string} existingContent
 * @returns {number}
 */
function errorCountFromFile(existingContent) {
  const countMatch = existingContent.match(/Total Errors: (\d+)/);
  return countMatch ? parseInt(countMatch[1], 10) : 0;
}

/**
 * Newest error directly under a fresh header, then the old entries.
 * The old header is skipped by slicing from the first divider, so the count is not doubled.
 * @param {object} fileSystem
 * @param {string} errorLogFile
 * @param {object} errorData
 */
function writeErrorToMarkdownFile(fileSystem, errorLogFile, errorData, recordedAt) {
  try {
    let existingContent = '';
    if (fileSystem.existsSync(errorLogFile)) {
      existingContent = fileSystem.readFileSync(errorLogFile, 'utf8');
    }

    if (existingContent.includes(EMPTY_LOG_MARKER)) {
      existingContent = existingContent.split(EMPTY_LOG_MARKER)[0];
    }

    const newCount = errorCountFromFile(existingContent) + 1;
    const errorEntry = `${ERROR_DIVIDER}
ERROR ${newCount}
${ERROR_DIVIDER}

Message: ${errorData.message}
Code: ${errorData.code || NO_CODE_LABEL}
Context: ${errorData.context}
Time: ${errorData.readableTime}
Timestamp: ${errorData.timestamp}
Stack Trace:
${errorData.stack || NO_STACK_LABEL}

`;

    const readableUpdateTime = formatTimestamp(recordedAt);
    let newContent = `🔥 ANATROX ERROR LOG
${ERROR_DIVIDER}

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${newCount}

Last updated: ${readableUpdateTime}

`;

    newContent += errorEntry;

    if (existingContent) {
      const errorsStart = existingContent.indexOf(ERROR_DIVIDER);
      if (errorsStart !== -1) {
        newContent += existingContent.substring(errorsStart);
      }
    }

    fileSystem.writeFileSync(errorLogFile, newContent, 'utf8');
    console.log(`✅ Error logged to ${errorLogFile}`);
  } catch (fileError) {
    console.error('Failed to write error to file:', fileError);
  }
}

/**
 * POST the error and do not make the caller wait.
 * Failures inside the request are swallowed here. The .catch queue only runs if this
 * function rejects outside that inner try, which the inner catch prevents for fetch errors.
 * @param {string} baseUrl
 * @param {object} errorData
 */
function sendErrorToApiWithoutWaiting(baseUrl, errorData) {
  // vocab: (async () => {})() = start an async function immediately and do not await it.
  (async () => {
    try {
      const { getApiAuthHeaders } = require('../for-both/online-connection/attachLoginProof');
      const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
      if (!headers.Authorization) return;
      await fetch(`${baseUrl}${LOG_ERROR_PATH}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(errorData),
      });
    } catch (ignoredError) {
      /* queue below */
    }
  })().catch(() => {
    try {
      const errorSyncModule = require('./sendSavedErrors');
      if (errorSyncModule && errorSyncModule.queueErrorForSync) {
        errorSyncModule.queueErrorForSync(errorData).catch(() => {});
      }
    } catch (ignoredError) {
      console.log('📝 Error:', errorData);
    }
  });
}

/**
 * Firestore copy, in addition to the file or the API. Server time replaces the phone clock
 * so a wrong device clock cannot scramble the order in the console.
 * vocab: addDoc = append a document with an auto-generated id.
 * vocab: serverTimestamp() = a placeholder Firebase fills with its own time on write.
 * @param {object} errorData
 */
async function writeErrorToFirestore(errorData) {
  const firestoreDb = getDb();
  if (!firestoreDb) return;
  try {
    const { addDoc, collection, serverTimestamp } = require('firebase/firestore');
    // vocab/symbol: ...errorData = copy every field, then replace timestamp with the server clock.
    const docRef = await addDoc(collection(firestoreDb, APP_ERRORS_COLLECTION), {
      ...errorData,
      timestamp: serverTimestamp(),
    });
    console.log('✅ Error logged to Firestore:', docRef.id);
  } catch (firestoreError) {
    console.error('❌ Failed to log error to Firestore:', firestoreError.message);
  }
}

// ===== MAIN FUNCTION =====

/**
 * Record one error to the file or the API, then to Firestore.
 * The API call is not awaited. Logging must not make the crashing screen wait on the network.
 * @param {Error|object} error
 * @param {string} context Where it happened, shown in the log
 * @returns {Promise<void>}
 */
async function recordError(error, context) {
  const recordedAt = new Date();
  const errorData = buildErrorData(error, recordedAt, context);
  const fileSystem = getFs();
  const errorLogFile = getErrorLogFile();

  if (isNode && fileSystem && errorLogFile) {
    writeErrorToMarkdownFile(fileSystem, errorLogFile, errorData, recordedAt);
  } else {
    try {
      const baseUrl = getApiBase();
      sendErrorToApiWithoutWaiting(baseUrl, errorData);
    } catch (ignoredError) {
      console.log('📝 Error:', errorData);
    }
  }

  await writeErrorToFirestore(errorData);
}

module.exports = { recordError };
