// API Key Management Service
// Handles storing and retrieving OpenAI API key from AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureOpenAI, getOpenAIKey } from './openaiClient';

const STORAGE_KEY = 'OPENAI_API_KEY';
const DEFAULT_KEY = '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';

/**
 * Load API key from storage and configure OpenAI
 * @returns {Promise<string|null>} The loaded API key or null
 */
export async function loadApiKey() {
  try {
    let savedKey = await AsyncStorage.getItem(STORAGE_KEY);
    
    // One-time initialization: if no key exists, save the default dev key
    if (!savedKey) {
      await AsyncStorage.setItem(STORAGE_KEY, DEFAULT_KEY);
      savedKey = DEFAULT_KEY;
    }
    
    if (savedKey) {
      configureOpenAI({ apiKey: savedKey });
      return savedKey;
    }
    return null;
  } catch (error) {
    console.error('Error loading API key:', error);
    return null;
  }
}

/**
 * Save API key to storage and configure OpenAI
 * @param {string} apiKey - The API key to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveApiKey(apiKey) {
  try {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new Error('Invalid API key');
    }
    
    const trimmedKey = apiKey.trim();
    await AsyncStorage.setItem(STORAGE_KEY, trimmedKey);
    configureOpenAI({ apiKey: trimmedKey });
    return true;
  } catch (error) {
    console.error('Error saving API key:', error);
    throw error;
  }
}

/**
 * Get current API key (from memory, not storage)
 * @returns {string|null} The current API key or null
 */
export function getCurrentApiKey() {
  return getOpenAIKey();
}

/**
 * Check if API key is configured
 * @returns {boolean} True if API key is set
 */
export function hasApiKey() {
  return !!getOpenAIKey();
}

