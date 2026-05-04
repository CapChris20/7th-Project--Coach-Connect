// OpenAI SDK setup for React Native (JavaScript)
// - Uses the official 'openai' SDK
// - Reads API key from environment variables
// - Exposes a single function: generateResponse(prompt) -> { text, raw }
//
// TODO: {{Install the SDK in your project root}}
//   npm:  npm install openai
//   yarn: yarn add openai
//
// TODO: {{Provide your API key via env}}
//   Create a .env file at the project root with:
//     OPENAI_API_KEY={{your_openai_api_key_here}}
//   For React Native, we recommend using 'react-native-config' or Expo env:
//     - react-native-config: https://github.com/luggit/react-native-config
//     - Expo (app.json/app.config.*): add to 'extra' and read from Constants.expoConfig.extra
//
// Model:
//   Using: gpt-4o-mini as requested
//
// Output format:
//   Returns an {{/ object}} with shape: { text: string, raw: any }
//
// Usage example:
//   import { generateResponse } from './openaiClient';
//   const result = await generateResponse('{{Your user prompt here}}');
//   console.log(result.text);
//
import OpenAI from 'openai';
import { getWebContext } from './webSearch';
import { askServer } from './askServer';
import { configureOpenAI as configureApiKey, getOpenAIKey } from './apiKeyService';
import { getApiBase } from '../../shared/services/baseUrl';

// Re-export getOpenAIKey for backward compatibility
export { getOpenAIKey } from './apiKeyService';

// Lazy client initialization to avoid throwing if no key during import time
let client = null;
function getClient() {
  if (client) return client;
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error(
      'OpenAI API key is missing. Set OPENAI_API_KEY in your environment (e.g., .env) and ensure it is available in React Native using react-native-config or Expo config.'
    );
  }
  client = new OpenAI({
    apiKey: apiKey,
    // Required for non-Node runtimes like React Native/web
    dangerouslyAllowBrowser: true,
  });
  return client;
}

// Override configureOpenAI to also reset client when key changes
const originalConfigure = configureApiKey;
export function configureOpenAI({ apiKey }) {
  originalConfigure({ apiKey });
  client = null; // Reset client so it re-initializes with new key
}

/**
 * generateResponse
 * Sends a user prompt to the GPT model and returns { text, raw }.
 *
 * @param {string} userPrompt - The user's input text
 * @param {{ systemPrompt?: string }=} options - Optional system prompt or future extensions
 * @returns {Promise<{ text: string, raw: any }>}
 */
export async function generateResponse(userPrompt, options = {}) {
  const hasMessages = Array.isArray(options.messages) && options.messages.length > 0;
  if (!hasMessages) {
    if (typeof userPrompt !== 'string' || !userPrompt.trim()) {
      throw new Error('generateResponse: userPrompt must be a non-empty string when no messages array is provided.');
    }
  }

  // Try to use server endpoint first (has Serper built in) if web search is enabled
  if (options.enableWeb !== false) {
    console.log('🔍 [WEB SEARCH] Web search is ENABLED - attempting to use Serper API via server endpoint');
    try {
      const baseUrl = getBaseUrl?.() || (() => {
        return getApiBase();
      })();
      
      if (baseUrl) {
        console.log(`🌐 [WEB SEARCH] Server endpoint found: ${baseUrl} - attempting Serper web search`);
        const messages = hasMessages ? options.messages : (() => {
          const arr = [];
          if (options.systemPrompt) {
            arr.push({ role: 'system', content: options.systemPrompt });
          }
          arr.push({ role: 'user', content: userPrompt });
          return arr;
        })();
        
        const serverResult = await askServer(messages, {
          enableWeb: true,
          model: options.model,
          maxTokens: options.maxTokens || 4000,
        });
        
        if (serverResult && serverResult.text) {
          if (serverResult.usedWeb) {
            console.log('✅ [WEB SEARCH] SERPER WEB SEARCH USED - Response includes web context');
          } else {
            console.log('⚠️ [WEB SEARCH] Server responded but web search was not used (usedWeb=false)');
          }
          return { text: serverResult.text, raw: serverResult.raw, usedWeb: serverResult.usedWeb };
        } else {
          console.log('⚠️ [WEB SEARCH] Server responded but no text in result, falling back to direct OpenAI');
        }
      } else {
        console.log('⚠️ [WEB SEARCH] No server endpoint configured, falling back to direct OpenAI with web context');
      }
    } catch (serverError) {
      // Server not available or error - fallback to direct OpenAI with web context
      console.log('⚠️ [WEB SEARCH] Server endpoint unavailable, using direct OpenAI with web context:', serverError.message);
    }
  } else {
    console.log('🚫 [WEB SEARCH] Web search is DISABLED for this request');
  }

  // Direct OpenAI SDK fallback removed for security - all AI calls must go through server
  throw new Error('Direct OpenAI SDK calls removed. Use server /api/ask route instead.');

  // Preferred models: try requested first, then a widely available fallback
  const preferredModels = [
    options.model || 'gpt-4o-mini',  // Fixed: use existing model
    'gpt-4o-mini',
  ];

  // Add web search context if enabled (default: true)
  let enhancedPrompt = userPrompt;
  let enhancedMessages = null;
  
  if (options.enableWeb !== false) {
    try {
      // For chat, search based on the last user message
      const searchQuery = hasMessages 
        ? (options.messages.filter(m => m.role === 'user').pop()?.content || userPrompt)
        : userPrompt;
      
      console.log(`🔍 [WEB SEARCH] Fallback: Attempting web search for query: "${searchQuery.substring(0, 50)}..."`);
      const webContext = await getWebContext(searchQuery);
      if (webContext) {
        console.log(`✅ [WEB SEARCH] Web context retrieved (${webContext.length} chars) - appending to prompt`);
        if (hasMessages) {
          // For chat, append web context to the last user message
          enhancedMessages = [...options.messages];
          const safeEnhanced = Array.isArray(enhancedMessages) ? enhancedMessages : [];
          const lastUserIdx = safeEnhanced.map(m => m.role).lastIndexOf('user');
          if (lastUserIdx >= 0) {
            enhancedMessages[lastUserIdx] = {
              ...enhancedMessages[lastUserIdx],
              content: `${enhancedMessages[lastUserIdx].content}\n\n${webContext}`
            };
          }
        } else {
          enhancedPrompt = `${userPrompt}\n\n${webContext}`;
        }
      } else {
        console.log('⚠️ [WEB SEARCH] No web context retrieved - proceeding without web search');
      }
    } catch (e) {
      // If web search fails, continue without it
      console.warn('❌ [WEB SEARCH] Web search failed, continuing without web context:', e);
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
        max_tokens: options.maxTokens || 4000, // Allow longer, detailed responses
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

// TODO: {{Wire this into your UI}}
// - Example (inside a React component):
//   const [answer, setAnswer] = useState('');
//   const onAsk = async () => {
//     try {
//       const res = await generateResponse('How can I optimize my workout?');
//       setAnswer(res.text);
//     } catch (e) {
//       console.error(e);
//       // Show a user-friendly error toast
//     }
//   };



