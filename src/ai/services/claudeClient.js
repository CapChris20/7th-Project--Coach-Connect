/**
 * Claude AI Client
 * 
 * Simple, modular Claude API client for workout generation.
 * Uses Anthropic's Claude API (compatible with external Claude-compatible services).
 * 
 * Usage:
 *   import { sendClaudePrompt } from '../claudeClient';
 *   const response = await sendClaudePrompt(prompt, userContext);
 */

// Claude API endpoint (Anthropic's standard endpoint)
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Get API key from environment variable (supports both variable names)
const getClaudeApiKey = () => {
  return process.env.EXPO_PUBLIC_API_CLADE_URL || process.env.EXPO_PUBLIC_CLAUDE_API_KEY;
};

/**
 * Send a prompt to Claude with optional user context
 * 
 * @param {string} prompt - The main prompt/message to send
 * @param {Object} userContext - Optional user context (onboarding data, etc.)
 * @param {Object} options - Optional request configuration
 * @returns {Promise<Object>} Response object with { text, error }
 */
export async function sendClaudePrompt(prompt, userContext = null, options = {}) {
  try {
    // Build the message content
    let messageContent = prompt;
    
    // If user context is provided, format it into the prompt
    if (userContext) {
      messageContent = formatPromptWithContext(prompt, userContext);
    }

    // Build the request body
    const requestBody = {
      // Default to cheaper Haiku; callers can override with options.model if they truly need Sonnet
      model: options.model || "claude-3-haiku-20240307",
      // Keep responses reasonably sized by default to control cost
      max_tokens: options.maxTokens || 1200,
      messages: [
        {
          role: "user",
          content: messageContent
        }
      ],
      ...(options.systemPrompt && { system: options.systemPrompt })
    };

    // Get API key from environment
    const apiKey = getClaudeApiKey();
    if (!apiKey) {
      throw new Error("Claude API key not configured. Please set EXPO_PUBLIC_CLAUDE_API_KEY or EXPO_PUBLIC_API_CLADE_URL");
    }

    // Make the API request
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    
    // Extract text from Claude's response format
    const text = data.content?.[0]?.text || "";
    
    return {
      text,
      raw: data,
      error: null
    };

  } catch (error) {
    console.error("Claude API error:", error);
    return {
      text: null,
      raw: null,
      error: error.message || "Failed to get response from Claude"
    };
  }
}

/**
 * Format prompt with user context data
 * 
 * @param {string} prompt - Base prompt
 * @param {Object} userContext - User onboarding/context data
 * @returns {string} Formatted prompt with context
 */
function formatPromptWithContext(prompt, userContext) {
  // Build context section from user data
  let contextSection = "\n\n--- USER CONTEXT ---\n";
  
  // Add each context field in a readable format
  Object.keys(userContext).forEach(key => {
    const value = userContext[key];
    if (value !== null && value !== undefined && value !== "") {
      // Format arrays and objects nicely
      if (Array.isArray(value)) {
        contextSection += `${key}: ${value.join(", ")}\n`;
      } else if (typeof value === "object") {
        contextSection += `${key}: ${JSON.stringify(value, null, 2)}\n`;
      } else {
        contextSection += `${key}: ${value}\n`;
      }
    }
  });
  
  contextSection += "--- END CONTEXT ---\n\n";
  
  return prompt + contextSection;
}

/**
 * Generate a workout plan using Claude
 * 
 * @param {Object} userContext - User onboarding data
 * @returns {Promise<Object>} Workout plan response
 */
export async function generateWorkoutPlan(userContext) {
  const systemPrompt = `You are an expert fitness coach and personal trainer. 
Generate personalized workout plans based on user context. 
Return structured, actionable workout plans that are safe, effective, and aligned with the user's goals, experience level, and constraints.`;

  const prompt = `Generate a personalized workout plan based on the user's context provided below. 
Include specific exercises, sets, reps, rest periods, and progression strategies. 
Make it practical and achievable given their equipment, time constraints, and experience level.`;

  return await sendClaudePrompt(prompt, userContext, {
    systemPrompt,
    maxTokens: 1200
  });
}

