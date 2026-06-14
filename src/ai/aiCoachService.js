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
} from './contextAggregation';

export { recalibrateMacros, shouldRecalibrateMacros, recalibrateIfEligible } from './macroRecalibration';

export { sendCoachMessage, sendCoachMessageWithRetry, sendToAI, sendToDeeepSeek } from './deepseekService';

export { shouldRouteToPerplexity } from './perplexityService';
export { shouldInvokeWebSearch, shouldUseWebAuto } from './webSearchRouting';

export {
  executeCoachTool,
  executeToolAction,
  normalizeToolCall,
  TOOL_DISPLAY_NAMES,
} from './toolExecutor';
