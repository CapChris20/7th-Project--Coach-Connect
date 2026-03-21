// API Key service - extracted to avoid require cycles
// Single in-memory key; set via configureOpenAI at runtime

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

let resolvedApiKey = undefined;

export function configureOpenAI({ apiKey }) {
  if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
    resolvedApiKey = apiKey.trim();
  }
}

export function getOpenAIKey() {
  return resolvedApiKey;
}

/**
 * Load API key from AsyncStorage and configure OpenAI
 * Also checks environment variables as fallback
 */
export async function loadApiKey() {
  try {
    // Try AsyncStorage first
    const storedKey = await AsyncStorage.getItem('OPENAI_API_KEY');
    if (storedKey && storedKey.trim()) {
      configureOpenAI({ apiKey: storedKey });
      const keyPreview = storedKey.substring(0, 10) + '...' + storedKey.substring(storedKey.length - 4);
      console.log('✅ OpenAI API key loaded:', keyPreview);
      return storedKey;
    }
    
    console.warn('⚠️ OpenAI API key not found in storage - client-side API keys removed for security');
    return null;
  } catch (error) {
    console.error('❌ Failed to load API key:', error);
    return null;
  }
}

/**
 * Save API key to AsyncStorage and configure OpenAI
 */
export async function saveApiKey(apiKey) {
  try {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('API key cannot be empty');
    }
    await AsyncStorage.setItem('OPENAI_API_KEY', apiKey.trim());
    configureOpenAI({ apiKey });
    return true;
  } catch (error) {
    console.error('❌ Failed to save API key:', error);
    return false;
  }
}

/**
 * Get current API key (if configured)
 */
export function getCurrentApiKey() {
  return getOpenAIKey();
}

/**
 * Check if API key is configured
 */
export function hasApiKey() {
  return !!getOpenAIKey();
}
