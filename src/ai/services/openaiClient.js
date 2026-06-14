// This module handles AI responses by routing through the authenticated server.
// Direct OpenAI SDK calls are not allowed on the client for security.
// All AI requests must go through the server endpoint: POST /api/ask

import { askServer } from './askServer';
import { getApiBase } from '../../shared/services/baseUrl';

/**
 * generateResponse
 * Sends a user prompt through the authenticated server endpoint.
 * The server handles all LLM API calls securely.
 *
 * @param {string} userPrompt - The user's input text
 * @param {{ systemPrompt?: string, enableWeb?: boolean, model?: string, maxTokens?: number, messages?: Array }=} options - Optional parameters
 * @returns {Promise<{ text: string, raw: any, usedWeb?: boolean }>}
 */
export async function generateResponse(userPrompt, options = {}) {
  const hasMessages = Array.isArray(options.messages) && options.messages.length > 0;
  if (!hasMessages) {
    if (typeof userPrompt !== 'string' || !userPrompt.trim()) {
      throw new Error('generateResponse: userPrompt must be a non-empty string when no messages array is provided.');
    }
  }

  const baseUrl = getApiBase();
  if (!baseUrl) {
    throw new Error('API base URL is not configured. Check your environment variables.');
  }

  // Build message array
  const messages = hasMessages ? options.messages : (() => {
    const arr = [];
    if (options.systemPrompt) {
      arr.push({ role: 'system', content: options.systemPrompt });
    }
    arr.push({ role: 'user', content: userPrompt });
    return arr;
  })();

  try {
    const serverResult = await askServer(messages, {
      enableWeb: options.enableWeb !== false,
      model: options.model,
      maxTokens: options.maxTokens || 4000,
    });
    
    if (serverResult && serverResult.text) {
      return { text: serverResult.text, raw: serverResult.raw, usedWeb: serverResult.usedWeb };
    } else {
      throw new Error('Server returned empty response');
    }
  } catch (error) {
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}
}

// Usage: This is called from AIChatScreen.jsx and other AI features



