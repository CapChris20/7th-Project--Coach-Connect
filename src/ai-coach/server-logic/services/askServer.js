/**
 * ask Server
 *
 * Purpose: Data/service layer: ask Server. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: askServer
 *
 * @file-header
 */
import axios from 'axios';
import { getApiBase } from '../../../shared/api/baseUrl';
import { getApiAuthHeaders } from '../../../shared/api/getAuthHeaders';

function getBaseUrl() {
  return getApiBase();
}

export async function askServer(messages, options = {}) {
  const base = getBaseUrl();

  if (!base) {
    throw new Error('API server not configured. For web, set EXPO_PUBLIC_API_BASE_URL in your .env file.');
  }

  const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers.Authorization) {
    throw new Error('Sign in to use the AI coach API.');
  }

  try {
    const res = await axios.post(
      `${base}/api/ask`,
      {
        messages,
        enableWeb: options.enableWeb !== false,
        model: options.model,
        maxTokens: options.maxTokens || 4000,
        userContext: options.userContext,
      },
      {
        headers,
        timeout: 30000,
      }
    );
    return res.data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
      throw new Error(
        'Cannot connect to API server. Make sure the server is running and EXPO_PUBLIC_API_BASE_URL is set correctly.'
      );
    }
    throw error;
  }
}
