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
//   Using: {{gpt-5}} as requested
//
// Output format:
//   Returns an {{/ object}} with shape: { text: string, raw: any }
//
// Usage example:
//   import { generateResponse } from '../services/openaiClient';
//   const result = await generateResponse('{{Your user prompt here}}');
//   console.log(result.text);
//
import OpenAI from 'openai';
import { getWebContext } from './webSearch';

// Single in-memory key; set via configureOpenAI at runtime
let resolvedApiKey = undefined;

// Allow runtime override only (no env files)
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

  const openai = getClient();

  // Preferred models: try requested first, then a widely available fallback
  const preferredModels = [
    options.model || 'gpt-5',
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
      
      const webContext = await getWebContext(searchQuery);
      if (webContext) {
        if (hasMessages) {
          // For chat, append web context to the last user message
          enhancedMessages = [...options.messages];
          const lastUserIdx = enhancedMessages.map(m => m.role).lastIndexOf('user');
          if (lastUserIdx >= 0) {
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


