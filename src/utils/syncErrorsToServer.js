// Error Sync Service
// Automatically syncs errors from AsyncStorage to ERRORS.txt file on app startup
// This runs automatically - no manual commands needed!

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

let AsyncStorage = null;
let FileSystem = null;

// Lazy load modules
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
    // Handle both default export and named export
    const storage = storageModule.default || storageModule;
    // Verify it has the methods we need
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

const ERROR_QUEUE_KEY = 'ANATROX_ERROR_QUEUE';
const ERROR_LOG_FILE = isNode ? (() => {
  const path = getPath();
  return path ? path.join(process.cwd(), 'ERRORS.txt') : null;
})() : null;

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

    // Get existing queue
    const queueJson = await AsyncStorage.getItem(ERROR_QUEUE_KEY);
    const queue = queueJson ? JSON.parse(queueJson) : [];
    
    // Add new error
    queue.push({
      ...errorData,
      queuedAt: new Date().toISOString(),
    });
    
    // Save back to AsyncStorage
    await AsyncStorage.setItem(ERROR_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    // Silently fail - don't break the app if error queuing fails
    // This can happen in Expo Go or if AsyncStorage is unavailable
    console.warn('Failed to queue error for sync (this is okay in some environments):', error.message);
  }
}

/**
 * Sync all queued errors from AsyncStorage to ERRORS.txt file
 * This runs automatically on app startup
 */
export async function syncErrorsToFile() {
  const AsyncStorage = getAsyncStorage();
  const fs = getFs();
  
  if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function' || !fs || !ERROR_LOG_FILE) {
    // Not in a sync-capable environment
    return;
  }

  try {
    // Get queued errors
    const queueJson = await AsyncStorage.getItem(ERROR_QUEUE_KEY);
    if (!queueJson) {
      return; // No errors to sync
    }

    const queuedErrors = JSON.parse(queueJson);
    if (queuedErrors.length === 0) {
      return; // No errors to sync
    }

    // Read existing error log file
    let existingContent = '';
    if (fs.existsSync(ERROR_LOG_FILE)) {
      existingContent = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
    }

    // Remove "No errors logged yet" if present
    if (existingContent.includes("No errors logged yet")) {
      existingContent = existingContent.split("No errors logged yet")[0];
    }

    // Extract current error count
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

    // Add all queued errors
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

    // Append existing errors (skip header)
    if (existingContent) {
      const errorsStart = existingContent.indexOf("================================================================================");
      if (errorsStart !== -1) {
        const existingErrors = existingContent.substring(errorsStart);
        newContent += existingErrors;
      }
    }

    // Write to file
    fs.writeFileSync(ERROR_LOG_FILE, newContent, 'utf8');
    
    // Clear the queue
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
export async function initializeErrorSync() {
  // Sync errors on startup
  await syncErrorsToFile();
  
  // Set up periodic sync (every 5 minutes)
  if (typeof setInterval !== 'undefined') {
    setInterval(async () => {
      await syncErrorsToFile();
    }, 5 * 60 * 1000); // 5 minutes
  }
}









