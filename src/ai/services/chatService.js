// Chat service for CoachConnect AI Coach
// Handles chat conversations with input sanitization and OpenAI integration
// Supports both text and image messages (OpenAI Vision API)
import { generateResponse } from './openaiClient';
import { prepareImageForOpenAI } from './imageService';

/**
 * Sanitize user input: remove special symbols (#, *, $, etc.) for clean GPT queries
 */
export function sanitizeInput(text) {
  if (!text) return '';
  // Remove special symbols but keep letters, numbers, spaces, basic punctuation
  return text
    .replace(/[#*$%^&<>[\]{}|\\`~]/g, '') // Remove special symbols
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Send a chat message to the AI coach (with optional image support)
 * @param {string} userMessage - User's message (will be sanitized)
 * @param {Array} conversationHistory - Previous messages in format [{ role: 'user'|'assistant', content: string|array }]
 * @param {object} options - Additional options
 * @param {string} options.imageUri - Optional image URI to include with the message
 * @returns {Promise<{ text: string, raw: any }>}
 */
export async function sendChatMessage(userMessage, conversationHistory = [], options = {}) {
  // System prompt for CoachConnect fitness coach
  const systemPrompt =
    'You are CoachConnect, an elite AI fitness coach. Provide comprehensive, detailed, and thorough responses. Be supportive, safety-first, and highly informative. When answering questions:\n\n- Provide extensive explanations with scientific rationale\n- Include specific examples, numbers, and actionable steps\n- Break down complex topics into detailed sections\n- Give comprehensive workout plans with sets, reps, rest periods, and form cues\n- Provide detailed nutrition advice with specific foods, portions, and meal timing\n- Explain the "why" behind recommendations with evidence-based reasoning\n- Include safety considerations and modifications when relevant\n- When analyzing images, provide thorough analysis of fitness form, nutrition labels, meal planning, exercise technique, or body measurements\n- Use web information when available to give current, accurate, and detailed advice\n- Aim for responses that are 300-800 words for complex topics, ensuring users get all the information they need\n\nBe thorough and comprehensive - users want detailed information, not brief summaries.';

  // Prepare image if provided
  let imageDataUrl = null;
  if (options.imageUri) {
    try {
      // If imageUri is already base64 from pickImage, use it directly
      if (typeof options.imageUri === 'object' && options.imageUri.base64) {
        imageDataUrl = `data:image/jpeg;base64,${options.imageUri.base64}`;
      } else if (typeof options.imageUri === 'string') {
        imageDataUrl = await prepareImageForOpenAI(options.imageUri);
      }
    } catch (e) {
      console.error('Error preparing image:', e);
      throw new Error('Failed to process image. Please try again.');
    }
  }

  // Build user message content
  let userContent;
  if (imageDataUrl) {
    // If image is provided, use vision API format
    userContent = [
      { 
        type: 'text', 
        text: userMessage || 'Please analyze this fitness/nutrition related image and provide helpful insights.' 
      },
      {
        type: 'image_url',
        image_url: {
          url: imageDataUrl, // Base64 data URL
        },
      },
    ];
  } else {
    // Text only - sanitize input
    const sanitizedMessage = sanitizeInput(userMessage || '');
    if (!sanitizedMessage) {
      throw new Error('Please enter a valid message without special symbols.');
    }
    userContent = sanitizedMessage;
  }

  // Clean conversation history (remove imageUri from UI messages)
  const historyArr = Array.isArray(conversationHistory) ? conversationHistory : [];
  const cleanHistory = historyArr.map(msg => {
    if (msg.imageUri) {
      // Remove imageUri property, keep content for API
      const { imageUri, ...rest } = msg;
      return rest;
    }
    return msg;
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    ...cleanHistory,
    { role: 'user', content: userContent },
  ];

  // Use vision model if image is provided (gpt-4o-mini supports vision)
  const model = imageDataUrl ? 'gpt-4o-mini' : (options.model || 'gpt-4o-mini');

  // Generate response with web search enabled (only for text, not images)
  const enableWebSearch = !imageDataUrl;
  if (enableWebSearch) {
    console.log('🔍 [CHAT] Web search ENABLED - Will attempt to use Serper API');
  } else {
    console.log('🚫 [CHAT] Web search DISABLED (image query detected)');
  }
  
  return await generateResponse('', {
    messages,
    enableWeb: enableWebSearch,
    model,
    maxTokens: 4000, // Allow longer, more detailed responses
  });
}

/**
 * Generate a quick workout plan response
 * @param {string} userPrompt - User's fitness request
 * @returns {Promise<{ text: string, raw: any }>}
 */
export async function generateWorkoutResponse(userPrompt) {
  const systemPrompt =
    'You are CoachConnect, an elite AI fitness coach. Provide comprehensive, detailed, and thorough workout plans. Be supportive, safety-first, and highly informative. Include:\n\n- Detailed exercise descriptions with proper form cues\n- Specific sets, reps, rest periods, and progression schemes\n- Warm-up and cool-down routines\n- Safety considerations and modifications\n- Scientific rationale for exercise selection\n- Equipment alternatives when applicable\n- Expected results and timeline\n\nUse web information when available to give current, accurate, and detailed advice. Aim for comprehensive responses (300-800 words) that give users all the information they need.';
  
  const sanitizedPrompt = sanitizeInput(userPrompt);
  
  return await generateResponse(sanitizedPrompt, {
    systemPrompt,
    enableWeb: true,
    model: 'gpt-4o-mini',
    maxTokens: 4000,
  });
}

