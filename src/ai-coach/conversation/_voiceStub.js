// Temporary no-op after voice feature removal. Safe to delete once call sites drop speech.
export function useCoachSpeech() {
  return {
    listening: false,
    speaking: false,
    partial: '',
    startListening: async () => {},
    stopListening: async () => {},
    speak: async () => {},
    stopSpeaking: async () => {},
  };
}
export default useCoachSpeech;
