// Offline error buffer + drain loop.
// Flow: a failed error report gets pushed onto an AsyncStorage queue → later, in a Node-capable
//       environment, the queue is flushed into ERRORS.txt newest-first and then emptied.
// queueErrorForSync is called from logError's failure path; initializeErrorSync runs at app startup.

// Same environment probe as logError.js — the file-writing half only works under Node.
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Module cache slots. Three-state on purpose:
//   null  = not looked up yet, false = looked up and unavailable, object = the real module.
// The `false` state is what stops us from retrying a doomed require on every single error.
let AsyncStorage = null;
let FileSystem = null;

// Every dependency is required lazily inside a function so this module can be imported
// anywhere (phone, browser, bare Node script) without the bundler choking on a missing peer.
function getAsyncStorage() {
  if (AsyncStorage !== null) return AsyncStorage;
  try {
    // Check if module exists before requiring
    if (typeof require === 'undefined') {
      AsyncStorage = false;
      return null;
    }
    const storageModule = require('@react-native-async-storage/async-storage');
    if (!storageModule) {
      AsyncStorage = false;
      return null;
    }
    // The package ships as an ES default export but interop can hand back the namespace
    // object instead, so accept either shape.
    const storage = storageModule.default || storageModule;
    // Duck-typing guard: in Expo Go / web the module can resolve to a stub that has no
    // real methods. Checking for getItem/setItem avoids a crash deep inside the queue logic.
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
      AsyncStorage = storage;
      return AsyncStorage;
    }
    // Mark as unavailable so we don't try again
    AsyncStorage = false;
    return null;
  } catch (e) {
    // Mark as unavailable so we don't try again
    AsyncStorage = false;
    return null;
  }
}

function getFileSystem() {
  if (FileSystem) return FileSystem;
  try {
    // Check if module exists before requiring
    if (typeof require === 'undefined') {
      return null;
    }
    const fsModule = require('expo-file-system');
    if (!fsModule) {
      return null;
    }
    FileSystem = fsModule;
    return FileSystem;
  } catch (e) {
    return null;
  }
}

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

// The AsyncStorage key holding the pending-error array.
// Manipulate here: renaming this orphans any errors already queued on existing devices
const ERROR_QUEUE_KEY = 'ANATROX_ERROR_QUEUE';
// Computed once at import time. The IIFE exists just so we can run a few statements
// inside a `const` initializer; on non-Node targets it short-circuits to null.
// vocab: process.cwd() = the directory the Node script was launched from
// Manipulate here: 'ERRORS.txt' is the drain target (distinct from logError.js's ERRORS.md)
const ERROR_LOG_FILE = isNode ? (() => {
  const path = getPath();
  return path ? path.join(process.cwd(), 'ERRORS.txt') : null;
})() : null;

// Human-readable stamp for the log file — same format logError.js uses, kept local
// so this module has no import-time dependency on it.
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
 * Queue an error in AsyncStorage (React Native)
 * This is called automatically by autoLogErrorSync
 */
export async function queueErrorForSync(errorData) {
  try {
    const AsyncStorage = getAsyncStorage();
    if (!AsyncStorage) {
      // AsyncStorage module not available (e.g., in Expo Go or Node.js)
      return;
    }
    
    // Verify AsyncStorage has the required methods
    if (typeof AsyncStorage.getItem !== 'function' || typeof AsyncStorage.setItem !== 'function') {
      // AsyncStorage is not properly initialized
      return;
    }

    // Read-modify-write: AsyncStorage only stores strings, so the whole queue is one
    // JSON blob that has to be parsed, appended to, and re-stringified every time.
    const queueJson = await AsyncStorage.getItem(ERROR_QUEUE_KEY);
    const queue = queueJson ? JSON.parse(queueJson) : [];
    
    // `queuedAt` is added alongside the original timestamp so you can later see the gap
    // between when the error happened and when the device managed to store it.
    queue.push({
      ...errorData,
      queuedAt: new Date().toISOString(),
    });
    
    // Note: the queue is unbounded. A device stuck offline through a crash loop will keep
    // growing this blob. Manipulate here: slice the array (e.g. queue.slice(-200)) to cap it
    await AsyncStorage.setItem(ERROR_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    // Warn, never throw. This function is called from inside other error handlers, so
    // throwing here would mask the original bug with a storage complaint.
    console.warn('Failed to queue error for sync (this is okay in some environments):', error.message);
  }
}

/**
 * Sync all queued errors from AsyncStorage to ERRORS.txt file
 * This runs automatically on app startup
 */
// Drains the whole queue into ERRORS.txt in one write, then clears it.
// Needs BOTH AsyncStorage (to read the queue) and fs (to write the file), which in practice
// means a dev/Node context — on a real phone this is a no-op and the queue just keeps waiting.
export async function syncErrorsToFile() {
  const AsyncStorage = getAsyncStorage();
  const fs = getFs();
  
  // Bail before touching anything if any piece of the pipeline is missing.
  // Returning early (rather than throwing) is what makes this safe to call on startup everywhere.
  if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function' || !fs || !ERROR_LOG_FILE) {
    return;
  }

  try {
    const queueJson = await AsyncStorage.getItem(ERROR_QUEUE_KEY);
    if (!queueJson) {
      return; // Key never written — nothing to drain.
    }

    const queuedErrors = JSON.parse(queueJson);
    if (queuedErrors.length === 0) {
      return; // Empty array — skip the file rewrite entirely.
    }

    let existingContent = '';
    if (fs.existsSync(ERROR_LOG_FILE)) {
      existingContent = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
    }

    // First real batch replaces the empty-state placeholder text.
    if (existingContent.includes("No errors logged yet")) {
      existingContent = existingContent.split("No errors logged yet")[0];
    }

    // The file is its own database: parse the old running total back out of the header,
    // then add the size of this batch. `currentCount` also seeds the per-entry numbering below.
    const countMatch = existingContent.match(/Total Errors: (\d+)/);
    const currentCount = countMatch ? parseInt(countMatch[1]) : 0;
    const newCount = currentCount + queuedErrors.length;

    // Build new content with queued errors
    const now = new Date();
    const readableUpdateTime = formatTimestamp(now);
    
    let newContent = `🔥 ANATROX ERROR LOG
================================================================================

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${newCount}

Last updated: ${readableUpdateTime}

`;

    // Render one block per queued error, numbered continuing from the file's old total.
    // Each field has a fallback chain (readableTime → queuedAt → derived) because older
    // queued entries were stored with fewer fields than we write today.
    queuedErrors.forEach((errorData, index) => {
      const errorNum = currentCount + index + 1;
      newContent += `================================================================================
ERROR ${errorNum}
================================================================================

Message: ${errorData.message || "Unknown error"}
Code: ${errorData.code || "None"}
Context: ${errorData.context || "Unknown"}
Time: ${errorData.readableTime || errorData.queuedAt || formatTimestamp(new Date(errorData.timestamp))}
Timestamp: ${errorData.timestamp || errorData.queuedAt || new Date().toISOString()}
Stack Trace:
${errorData.stack || "No stack trace"}

`;
    });

    // Re-attach the older entries by slicing from the first `====` divider, dropping the
    // stale header we just regenerated with the new count.
    if (existingContent) {
      const errorsStart = existingContent.indexOf("================================================================================");
      if (errorsStart !== -1) {
        const existingErrors = existingContent.substring(errorsStart);
        newContent += existingErrors;
      }
    }

    fs.writeFileSync(ERROR_LOG_FILE, newContent, 'utf8');
    
    // Only clear the queue AFTER the write succeeds. If writeFileSync throws we jump to
    // the catch with the queue intact, so the next run retries instead of losing the errors.
    await AsyncStorage.removeItem(ERROR_QUEUE_KEY);
    
    console.log(`✅ Synced ${queuedErrors.length} errors to ${ERROR_LOG_FILE}`);
  } catch (error) {
    console.error('Failed to sync errors to file:', error);
  }
}

/**
 * Initialize automatic error syncing
 * Call this on app startup
 */
// Startup hook: drain once immediately, then keep draining on a timer.
// The immediate pass catches errors queued during the *previous* session (including ones
// from a crash), which would otherwise sit unseen until the first interval fired.
export async function initializeErrorSync() {
  await syncErrorsToFile();
  
  // The typeof guard covers exotic runtimes with no timers. Note the interval is never
  // cleared — intentional, since this is meant to live as long as the process does.
  if (typeof setInterval !== 'undefined') {
    setInterval(async () => {
      await syncErrorsToFile();
    // Manipulate here: shorter interval = fresher ERRORS.txt but more file writes
    }, 5 * 60 * 1000); // 5 minutes
  }
}









