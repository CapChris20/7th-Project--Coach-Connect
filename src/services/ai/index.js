// Centralized export file for all AI services
export { generateResponse, configureOpenAI, getOpenAIKey } from './openaiClient';
export { sendChatMessage, generateWorkoutResponse, sanitizeInput } from './chatService';
export { searchWeb, getWebContext } from './webSearch';
export { loadApiKey, saveApiKey, getCurrentApiKey, hasApiKey } from './apiKeyService';
export { generateMealPlan, chatWithCoach } from './claude';
export { transcribeAudio, generateWorkoutSuggestions } from './openai';
export {
  getAllChats,
  getChatById,
  saveChat,
  createNewChat,
  deleteChat,
  updateChatMessages,
  getCurrentChatId,
  setCurrentChatId,
  clearAllChats,
} from './chatStorageService';
