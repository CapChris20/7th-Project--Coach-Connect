// Stand-in after the voice feature was removed. Call sites still expect this hook.
// Flow: return the same shape as the old speech hook, with every action doing nothing.
// Used by: coach screens that used to start listening or speaking. Safe to delete once those calls are gone.

// ===== NAMED CONSTANTS =====

const SILENT_SPEECH_STATE = {
  listening: false,
  speaking: false,
  partial: '',
};

// ===== HELPER FUNCTIONS =====

async function doNothing() {}

// ===== MAIN FUNCTION =====

/**
 * Voice hook that no longer records or speaks.
 * The keys match the old hook so existing screens keep working.
 * @returns {object}
 */
export function useCoachSpeech() {
  return {
    ...SILENT_SPEECH_STATE,
    startListening: doNothing,
    stopListening: doNothing,
    speak: doNothing,
    stopSpeaking: doNothing,
  };
}

export default useCoachSpeech;
