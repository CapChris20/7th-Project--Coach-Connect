/**
 * ai Coach Service
 *
 * Purpose: Data/service layer: ai Coach Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: (see file)
 *
 * @file-header
 */
/**
 * AI Coach public API — context + chat.
 * DeepSeek runs on the server (/api/ai-coach), not in the mobile bundle.
 */
export {
  loadCoachContext,
  loadCoachContextEnhanced,
  calculateDataQuality,
  aggregateUserContext,
  fetchWeeklyContextFromServer,
  normalizeCoachContext,
  buildContextSystemBlock,
} from './context/CoachContextProvider';

export { recalibrateMacros, shouldRecalibrateMacros, recalibrateIfEligible } from './macro-recalibration/recalculateMacrosFromCoach';

export { sendCoachMessage, sendCoachMessageWithRetry, sendToAI, sendToDeeepSeek } from './chat-api/aiCoachServerService';

export { shouldRouteToPerplexity } from './perplexityService';
export { shouldInvokeWebSearch, shouldUseWebAuto } from './chat-api/detectWebSearchRequest';

export {
  executeCoachTool,
  executeToolAction,
  normalizeToolCall,
  TOOL_DISPLAY_NAMES,
} from './tools/executeCoachTool';
