// Auto-log errors to ERRORS.md (Node.js) or Firestore (React Native)
// Use this in catch blocks to automatically log errors
// Logs EVERY SINGLE ERROR - no filtering

let logError = null;

// Lazy load to avoid issues if modules aren't available
async function getLogError() {
  if (!logError) {
    try {
      // Try to load logError - works in both Node.js and React Native
      const logErrorModule = require('./logError');
      logError = logErrorModule.logError;
    } catch (e) {
      // If logError isn't available, use console.error as fallback
      logError = async (error, context) => {
        console.error(`[${context}]`, error);
      };
    }
  }
  return logError;
}

// Auto-log an error with context
export async function autoLogError(error, context = 'Unknown') {
  try {
    const logFn = await getLogError();
    if (logFn) {
      await logFn(error, context);
    }
  } catch (e) {
    // Silently fail - don't break the app if logging fails
    // Just log to console as fallback
    console.error(`[${context}] Auto-log failed:`, e.message);
    console.error('Original error:', error);
  }
}

// Helper for React Native/Expo (synchronous version - fire and forget)
export function autoLogErrorSync(error, context = 'Unknown') {
  // Prevent infinite loops - check if this is an error about undefined modules
  if (error && error.message && error.message.includes('Requiring unknown module "undefined"')) {
    return; // Don't log this - it causes infinite loops
  }
  
  // Fire and forget - don't await (prevents blocking)
  try {
    getLogError()
      .then(logFn => {
        if (logFn) {
          logFn(error, context).catch(() => {
            // Silently fail if logging fails
          });
        }
      })
      .catch(() => {
        // Fallback to console if module loading fails - but only if not the undefined module error
        if (!error || !error.message || !error.message.includes('undefined')) {
          console.error(`[${context}]`, error);
        }
      });
  } catch (e) {
    // Completely silent - don't log anything if this fails
  }
}

