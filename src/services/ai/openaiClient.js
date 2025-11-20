// OpenAI SDK setup for React Native - Consolidated AI service
// - Uses the official 'openai' SDK
// - Runtime API key configuration (stored in AsyncStorage)
// - Web search integration for current information
// - Model fallback: gpt-5 -> gpt-4o-mini
import OpenAI from 'openai';
import { getWebContext } from './webSearch';

// Single in-memory key; set via configureOpenAI at runtime
let resolvedApiKey = undefined;

// Allow runtime override (key stored in AsyncStorage, loaded on app start)
export function configureOpenAI({ apiKey }) {
  if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
    resolvedApiKey = apiKey.trim();
    client = null; // reset so we re-init with new key
  }
}

export function getOpenAIKey() {
  return resolvedApiKey;
}

// Lazy client initialization to avoid throwing if no key during import time
let client = null;
function getClient() {
  if (client) return client;
  if (!resolvedApiKey) {
    throw new Error(
      'OpenAI API key is missing. Set OPENAI_API_KEY in your environment (e.g., .env) and ensure it is available in React Native using react-native-config or Expo config.'
    );
  }
  client = new OpenAI({
    apiKey: resolvedApiKey,
    // Required for non-Node runtimes like React Native/web
    dangerouslyAllowBrowser: true,
  });
  return client;
}

/**
 * generateResponse - Main OpenAI chat function with web search support
 * Sends a user prompt to the GPT model and returns { text, raw }.
 *
 * @param {string} userPrompt - The user's input text
 * @param {object} options - Optional configuration
 * @param {string} options.systemPrompt - System prompt for GPT
 * @param {Array} options.messages - Multi-turn chat messages array
 * @param {boolean} options.enableWeb - Enable web search (default: true)
 * @param {string} options.model - Model to use (default: 'gpt-5', fallback: 'gpt-4o-mini')
 * @returns {Promise<{ text: string, raw: any }>}
 */
export async function generateResponse(userPrompt, options = {}) {
  const hasMessages = Array.isArray(options.messages) && options.messages.length > 0;
  if (!hasMessages) {
    if (typeof userPrompt !== 'string' || !userPrompt.trim()) {
      throw new Error('generateResponse: userPrompt must be a non-empty string when no messages array is provided.');
    }
  }

  const openai = getClient();

  // Check if we need vision model (has image content)
  const needsVision = hasMessages && options.messages.some(m => 
    m.role === 'user' && Array.isArray(m.content) && m.content.some(c => c.type === 'image_url')
  );
  
  // Preferred models: use vision-capable models if images are present
  const preferredModels = needsVision
    ? ['gpt-4o-mini', 'gpt-4o'] // Vision models
    : [options.model || 'gpt-5', 'gpt-4o-mini'];

  // Add web search context if enabled (default: true)
  let enhancedPrompt = userPrompt;
  let enhancedMessages = null;
  
  // Check if last message has image content (array format for vision API)
  const lastUserMessage = hasMessages ? options.messages.filter(m => m.role === 'user').pop() : null;
  const hasImage = lastUserMessage && Array.isArray(lastUserMessage.content);
  
  if (options.enableWeb !== false && !hasImage) {
    try {
      // For chat, search based on the last user message (only for text, not images)
      const searchQuery = hasMessages 
        ? (typeof lastUserMessage?.content === 'string' 
            ? lastUserMessage.content 
            : lastUserMessage?.content?.find(c => c.type === 'text')?.text || userPrompt)
        : userPrompt;
      
      const webContext = await getWebContext(searchQuery);
      if (webContext) {
        if (hasMessages) {
          // For chat, append web context to the last user message (text only)
          enhancedMessages = [...options.messages];
          const lastUserIdx = enhancedMessages.map(m => m.role).lastIndexOf('user');
          if (lastUserIdx >= 0 && typeof enhancedMessages[lastUserIdx].content === 'string') {
            enhancedMessages[lastUserIdx] = {
              ...enhancedMessages[lastUserIdx],
              content: `${enhancedMessages[lastUserIdx].content}\n\n${webContext}`
            };
          }
        } else {
          enhancedPrompt = `${userPrompt}\n\n${webContext}`;
        }
      }
    } catch (e) {
      // If web search fails, continue without it
      console.warn('Web search failed, continuing without web context:', e);
    }
  }

  // Support both single-prompt and multi-turn chat
  const messages = enhancedMessages || (hasMessages
    ? options.messages
    : (() => {
        const arr = [];
        if (options.systemPrompt) {
          arr.push({ role: 'system', content: options.systemPrompt });
        }
        arr.push({ role: 'user', content: enhancedPrompt });
        return arr;
      })());

  let lastError = null;
  for (let i = 0; i < preferredModels.length; i += 1) {
    const model = preferredModels[i];
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
      });
      const text =
        completion?.choices?.[0]?.message?.content?.trim?.() ??
        '';
      return { text, raw: completion };
    } catch (error) {
      // If it's the first attempt and we hit 429/rate/quota or model access errors, try fallback
      const status = error?.status || error?.response?.status;
      const errMsg =
        error?.response?.data?.error?.message ||
        error?.message ||
        '';
      const isRecoverable =
        status === 429 ||
        /quota|rate|limit|insufficient|model|access/i.test(errMsg);
      lastError = error;
      if (i < preferredModels.length - 1 && isRecoverable) {
        // brief backoff
        await new Promise(r => setTimeout(r, 250));
        continue;
      }
      break;
    }
  }
  const friendly =
    'OpenAI request failed. Check billing/credits, model access, or try again later.';
  const detail =
    lastError?.response?.data?.error?.message ||
    lastError?.message ||
    'Unknown error';
  throw new Error(`${friendly} (${detail})`);
}
