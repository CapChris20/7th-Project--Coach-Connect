import axios from 'axios';
import { getOpenAIKey } from './apiKeyService';
import { getApiBase } from '../../shared/services/baseUrl';

// Resolve backend URL
function getBaseUrl() {
  return getApiBase();
}

export async function askServer(messages, options = {}) {
  const base = getBaseUrl();
  
  if (!base) {
    throw new Error('API server not configured. For web, set EXPO_PUBLIC_API_BASE_URL in your .env file.');
  }
  
  const apiKey = getOpenAIKey?.() || undefined;
  try {
    const res = await axios.post(
      `${base}/api/ask`,
      {
        messages,
        enableWeb: options.enableWeb !== false,
        model: options.model,
        maxTokens: options.maxTokens || 4000,
      },
      {
        headers: apiKey ? { 'x-openai-key': apiKey } : undefined,
        timeout: 30000,
      }
    );
    return res.data; // { text, raw, usedWeb }
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
      throw new Error('Cannot connect to API server. Make sure the server is running and EXPO_PUBLIC_API_BASE_URL is set correctly.');
    }
    throw error;
  }
}


