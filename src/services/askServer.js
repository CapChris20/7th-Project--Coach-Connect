import axios from 'axios';
import Constants from 'expo-constants';
import { getOpenAIKey } from './openaiClient';

// Resolve backend URL
function getBaseUrl() {
  const extra =
    Constants?.expoConfig?.extra ||
    Constants?.manifest2?.extra ||
    Constants?.manifest?.extra;
  return extra?.API_BASE_URL || 'http://localhost:4000';
}

export async function askServer(messages, options = {}) {
  const base = getBaseUrl();
  const apiKey = getOpenAIKey?.() || undefined;
  const res = await axios.post(
    `${base}/api/ask`,
    {
      messages,
      enableWeb: options.enableWeb !== false,
      model: options.model,
    },
    {
      headers: apiKey ? { 'x-openai-key': apiKey } : undefined,
    }
  );
  return res.data; // { text, raw, usedWeb }
}


