// Heavyweight error recorder that works in BOTH Node scripts and the React Native app.
// Flow: build one errorData object → in Node, prepend it to ERRORS.md; in the app, POST it to
//       /api/log-error (queueing offline) → then, either way, also write it to the `app_errors` Firestore collection.
// Called by reportCrashAutomatically/sendSavedErrors. CommonJS (`require`/`module.exports`) so plain Node scripts can use it too.

// Environment probe: every filesystem branch below hangs off this one flag.
// vocab: process.versions.node = only exists in Node — React Native has no such global,
//        which is how we tell "CLI script" apart from "running on a phone".
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const { getApiBase } = require('../for-both/online-connection/whereToConnect');

// `fs`/`path` are required lazily inside functions rather than at the top of the file.
// Why: a top-level `require('fs')` would make Metro try to bundle Node built-ins into the
// mobile app and blow up the build. Returning null lets callers silently skip file logging.
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

// Resolves the human-readable error log at the repo root.
// vocab: __dirname = folder of THIS file; '..','..' climbs out of src/utils to the project root
// Manipulate here: rename 'ERRORS.md' to move where Node-side errors get appended
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

// Memoized Firestore handle. `dbChecked` guarantees we only attempt the require ONCE —
// otherwise every logged error would retry a failing import and spam the console.
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
        // Expected in bare Node scripts that never initialized Firebase — degrade, don't crash.
        console.warn('⚠️ Firestore db is null - errors won\'t be logged to Firestore');
      }
    }
  } catch (e) {
    console.warn('⚠️ Could not load Firestore cloudConnection:', e.message);
  }
  return db;
}

// "Sep 13, 2026 at 2:48 AM" — the human-skimmable stamp in ERRORS.md.
// The machine-sortable ISO string is stored separately; this one is for eyeballs only.
// Manipulate here: tweak these options to change how ERRORS.md entries read
function cellFormattingTimestamp(date) {
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

// The single entry point. Fans the same error out to up to three sinks
// (file OR server, plus Firestore) so nothing gets lost regardless of where we're running.
async function recordError(error, context) {
  const now = new Date();
  const timestamp = now.toISOString();
  const readableTime = cellFormattingTimestamp(now);
  // Normalize once, up front. Every sink below consumes this exact shape, so the
  // ERRORS.md entry, the API payload, and the Firestore doc all stay in sync.
  // `|| 'Unknown error'` / `|| null` keep the object's keys stable even for weird throws.
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

  // ── Sink 1a: Node scripts write straight to ERRORS.md ──
  // The app can't reach here (no fs), so it takes the `else` branch instead.
  if (isNode && fs && ERROR_LOG_FILE) {
    try {
      let existingContent = '';
      if (fs.existsSync(ERROR_LOG_FILE)) {
        existingContent = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
      }

      // First real error replaces the placeholder text from the empty-state file.
      if (existingContent.includes('No errors logged yet')) {
        existingContent = existingContent.split('No errors logged yet')[0];
      }

      // The running total lives in the file itself (there's no database here), so we
      // parse it back out of the old header and bump it. Missing/corrupt header → restart at 1.
      // vocab: /Total Errors: (\d+)/ = regex; (\d+) captures the digits after the label
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

      const readableUpdateTime = cellFormattingTimestamp(now);
      let newContent = `🔥 ANATROX ERROR LOG
================================================================================

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${newCount}

Last updated: ${readableUpdateTime}

`;

      // Newest error goes directly under the fresh header, then the old entries follow —
      // so ERRORS.md always reads newest-first without rewriting each entry.
      newContent += errorEntry;

      // Re-attach the previous entries by slicing from the first `====` divider, which
      // skips the stale header (with its now-wrong count/timestamp) that we just rebuilt.
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
    // ── Sink 1b: the mobile/web app POSTs to our own API instead ──
    try {
      const whereToConnect = getApiBase();
      // Fired inside a self-calling async function and deliberately NOT awaited: logging
      // an error must never make the caller wait on the network.
      // vocab: (async () => { ... })() = IIFE — define an async function and immediately run it
      (async () => {
        try {
          const { getApiAuthHeaders } = require('../for-both/online-connection/attachLoginProof');
          const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
          // No auth token → the server would reject it anyway, so bail and let the
          // outer .catch() hand it to the offline queue.
          if (!headers.Authorization) return;
          await fetch(`${whereToConnect}/api/log-error`, {
            method: 'POST',
            headers,
            body: JSON.stringify(errorData),
          });
        } catch (_) {
          /* queue below */
        }
      })().catch(() => {
        // Network/auth failed → stash the error on-device so sendSavedErrors
        // can retry it next time the app is online.
        try {
          const errorSyncModule = require('./sendSavedErrors');
          if (errorSyncModule && errorSyncModule.queueErrorForSync) {
            errorSyncModule.queueErrorForSync(errorData).catch(() => {});
          }
        } catch (e) {
          // Last resort: at least print it so it isn't silently swallowed.
          console.log('📝 Error:', errorData);
        }
      });
    } catch (e) {
      console.log('📝 Error:', errorData);
    }
  }

  // ── Sink 2: Firestore, in ADDITION to whichever branch ran above ──
  // Note this is `if`, not `else` — the file/API write and the Firestore write both happen.
  const firestoreDb = getDb();
  if (firestoreDb) {
    try {
      // vocab: addDoc/collection = Firebase SDK — append a new doc with an auto-generated id
      const { addDoc, collection, serverTimestamp } = require('firebase/firestore');
      // Manipulate here: 'app_errors' is the Firestore collection these land in
      const docRef = await addDoc(collection(firestoreDb, 'app_errors'), {
        // vocab/symbol: ...errorData = spread — copy every field in, then override below
        ...errorData,
        // Overwrite our device clock with the server's. Phone clocks are often wrong or
        // in the wrong timezone, which would make error ordering in the console useless.
        // vocab: serverTimestamp() = placeholder Firebase fills in with its own time on write
        timestamp: serverTimestamp(),
      });
      console.log('✅ Error logged to Firestore:', docRef.id);
    } catch (firestoreError) {
      console.error('❌ Failed to log error to Firestore:', firestoreError.message);
    }
  }
}

module.exports = { recordError };
