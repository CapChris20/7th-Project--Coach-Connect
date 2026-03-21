/**
 * Claude Workout Service
 * 
 * Handles workout plan generation and regeneration via Claude API.
 * API key must be set in EXPO_PUBLIC_CLAUDE_API_KEY (or EXPO_PUBLIC_API_CLADE_URL) environment variable.
 */

import Constants from 'expo-constants';

const DEFAULT_CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Serialize error object to capture all details
 */
function serializeError(error) {
  if (!error) return null;
  
  const serialized = {
    message: error.message,
    name: error.name,
    stack: error.stack,
  };
  
  // Capture all enumerable and non-enumerable properties
  const props = Object.getOwnPropertyNames(error);
  for (const prop of props) {
    if (!serialized[prop]) {
      try {
        serialized[prop] = error[prop];
      } catch (e) {
        serialized[prop] = `[Error accessing property: ${e.message}]`;
      }
    }
  }
  
  // If error has a cause, serialize it too
  if (error.cause) {
    serialized.cause = serializeError(error.cause);
  }
  
  return serialized;
}

/**
 * Parse JSON from Claude response with error handling and auto-fix for incomplete JSON
 */
function parseClaudeResponse(data) {
  const text = data.content?.[0]?.text || "";
  const stopReason = data.stop_reason || data.stopReason;

  if (!text) {
    throw new Error("Empty response from Claude API. Please try again.");
  }

  // Check if response was truncated
  if (stopReason === 'max_tokens' || stopReason === 'length') {
    console.warn("⚠️ Response was truncated! Consider increasing max_tokens or simplifying the request.");
  }

  console.log("📝 Raw Claude response length:", text.length, "chars");
  console.log("📝 Stop reason:", stopReason);

  // Extract JSON from response (handle markdown code blocks if present)
  let jsonText = text.trim();
  
  // Try to find JSON in code blocks
  if (jsonText.includes("```json")) {
    const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonText = jsonMatch[1].trim();
    }
  } else if (jsonText.includes("```")) {
    const codeMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (codeMatch && codeMatch[1]) {
      jsonText = codeMatch[1].trim();
    }
  }

  // Try to find JSON object in the text
  if (!jsonText.startsWith("{")) {
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
  }

  if (!jsonText || jsonText.length === 0) {
    throw new Error("No valid JSON found in Claude response. Response: " + text.substring(0, 200));
  }

  console.log("📦 Extracted JSON length:", jsonText.length, "chars");

  // Try to parse JSON
  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    console.error("❌ JSON parse error. JSON text length:", jsonText.length);
    console.error("❌ Parse error details:", parseError.message);
    
    // Try to fix incomplete JSON by closing brackets in correct order
    if (parseError.message.includes("Unexpected end") || parseError.message.includes("end of input")) {
      console.log("🔧 Attempting to fix incomplete JSON...");
      let fixedJson = jsonText.trim();
      
      // Track bracket stack to close in correct order (LIFO)
      const stack = [];
      let inString = false;
      let escapeNext = false;
      
      // Find the last valid position and track what needs to be closed
      for (let i = 0; i < fixedJson.length; i++) {
        const char = fixedJson[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (inString) continue;
        
        if (char === '{') {
          stack.push('}');
        } else if (char === '[') {
          stack.push(']');
        } else if (char === '}' || char === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === char) {
            stack.pop();
          }
        }
      }
      
      // Close brackets in reverse order (LIFO)
      fixedJson += stack.reverse().join('');
      
      try {
        const fixed = JSON.parse(fixedJson);
        console.log("✅ Successfully fixed incomplete JSON!");
        return fixed;
      } catch (fixError) {
        console.error("❌ Could not fix JSON:", fixError.message);
        console.error("❌ Last 200 chars of attempted fix:", fixedJson.substring(fixedJson.length - 200));
        throw new Error(`Failed to parse JSON: ${parseError.message}. Response was likely truncated. Try again or simplify your request.`);
      }
    } else {
      throw new Error(`Failed to parse JSON: ${parseError.message}. Response preview: ${jsonText.substring(0, 200)}`);
    }
  }
}

/**
 * Generate initial workout plan from onboarding answers
 * @param {Object} onboardingAnswers - User onboarding data
 * @returns {Promise<Object>} { success: boolean, plan: Object|null, error: string|null }
 */
export async function generateWorkoutPlan(onboardingAnswers) {
  // Client-side Claude API keys removed for security
  const errorMsg = "❌ Claude API key removed from client. Workout generation should use server-side routes instead.";
  console.error(errorMsg);
  return {
    success: false,
    plan: null,
    error: errorMsg
  };
}

/**
 * Regenerate workout plan with refinements
 * @param {Object} originalOnboarding - Original onboarding answers
 * @param {Object} currentPlan - Current workout plan
 * @param {string} refinementText - User's refinement request
 * @returns {Promise<Object>} { success: boolean, plan: Object|null, error: string|null }
 */
export async function regenerateWorkoutPlan(originalOnboarding, currentPlan, refinementText) {
  // Client-side Claude API keys removed for security
  const errorMsg = "❌ Claude API key removed from client. Workout regeneration should use server-side routes instead.";
  return {
    success: false,
    plan: null,
    error: errorMsg
  };
}

// Deprecated code below - all workout generation should use server routes
/*
  const systemPrompt = `You are an expert fitness coach focused on EFFICIENCY and MINIMALISM. Generate personalized workout plans that use the FEWEST exercises possible to reach fitness goals.

CRITICAL RULES:
- Generate ONLY 1-2 weeks of workouts. Do NOT generate more than 2 weeks.
- MINIMIZE exercise count: Use 3-6 exercises per workout maximum. Quality over quantity.
- Focus on compound movements and exercises that deliver maximum results.
- Respect the user's available days per week and session time limits.
- Provide strategic recommendations for optimal results.

Return ONLY valid JSON in this exact structure:
{
  "recommendations": {
    "bestTimeToTrain": "Morning (7-9 AM) or Evening (6-8 PM) based on schedule",
    "optimalRestDays": "Monday and Friday for recovery",
    "progressionStrategy": "Increase weight by 5% weekly",
    "keyFocusAreas": ["Form first", "Progressive overload", "Adequate rest"]
  },
  "weeks": [
    {
      "weekNumber": 1,
      "days": [
        {
          "dayNumber": 1,
          "dayName": "Push Day",
          "exercises": [
            {
              "name": "Bench Press",
              "sets": 4,
              "reps": 8,
              "rest": 90,
              "notes": "Focus on form"
            }
          ]
        }
      ]
    }
  ]
}

Each exercise must have: name (string), sets (number), reps (number), rest (number in seconds), notes (string, optional).
Recommendations object must include: bestTimeToTrain, optimalRestDays, progressionStrategy, keyFocusAreas.

Generate 1-2 weeks maximum with MINIMAL exercises (3-6 per workout) that efficiently target the user's goals. Prioritize effectiveness over volume.`;

    const userPrompt = buildOnboardingPrompt(onboardingAnswers);

    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01"
    };

    // Only add API key header if we have a key (not using proxy URL)
    if (apiKey && !isUrl) {
      headers["x-api-key"] = apiKey;
    }

    // Try multiple model names as fallback (most common first)
    const modelNames = [
      "claude-3-5-sonnet-20241022", // Claude 3.5 Sonnet (most common)
      "claude-sonnet-4-20250514",   // Latest Sonnet 4
      "claude-3-opus-20240229",     // Claude 3 Opus
      "claude-3-sonnet-20240229",   // Claude 3 Sonnet
      "claude-3-5-sonnet",          // Without date suffix
      "claude-sonnet-4",            // Without date suffix
    ];

    let lastError = null;
    let response = null;

    // Try each model name until one works
    for (const modelName of modelNames) {
      try {
        response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelName,
            max_tokens: 8000, // Reduced since we only need 1-2 weeks
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userPrompt
              }
            ]
          })
        });

        if (response.ok) {
          console.log(`✅ Successfully used model: ${modelName}`);
          break; // Success, exit loop
        } else {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error?.type === 'not_found_error') {
            console.log(`⚠️ Model ${modelName} not found, trying next...`);
            lastError = errorData;
            response = null;
            continue; // Try next model
          } else {
            // Different error, break and handle it
            break;
          }
        }
      } catch (err) {
        console.log(`⚠️ Error with model ${modelName}:`, err.message);
        lastError = err;
        continue;
      }
    }

    if (!response) {
      throw new Error(`All model names failed. Last error: ${lastError?.error?.message || lastError?.message || 'Unknown error'}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.error?.type || JSON.stringify(errorData);
      console.error("Claude API error details:", JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        errorData: errorData
      }, null, 2));
      throw new Error(
        errorMessage || 
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const plan = parseClaudeResponse(data);

    return {
      success: true,
      plan: plan,
      error: null
    };

  } catch (error) {
    const errorDetails = serializeError(error);
    console.error("Claude workout generation error:", JSON.stringify(errorDetails, null, 2));
    return {
      success: false,
      plan: null,
      error: error.message || "Failed to generate workout plan"
    };
  }
}

/**
 * Regenerate workout plan with refinements
 * @param {Object} originalOnboarding - Original onboarding answers
 * @param {Object} currentPlan - Current workout plan
 * @param {string} refinementText - User's refinement request
 * @returns {Promise<Object>} { success: boolean, plan: Object|null, error: string|null }
 */
export async function regenerateWorkoutPlan(originalOnboarding, currentPlan, refinementText) {
  // Client-side Claude API keys removed for security
  const errorMsg = "❌ Claude API key removed from client. Workout regeneration should use server-side routes instead.";
  return {
    success: false,
    plan: null,
    error: errorMsg
  };
}

/* All code below is deprecated - workout generation moved to server-side routes
  try {
    const systemPrompt = `You are an expert fitness coach focused on EFFICIENCY. Modify an existing workout plan based on user feedback.

CRITICAL RULES:
- Return ONLY 1-2 weeks of workouts. Do NOT generate more than 2 weeks.
- MINIMIZE exercise count: Use 3-6 exercises per workout maximum.
- Focus on compound movements and maximum efficiency.

Return ONLY valid JSON in this exact structure:
{
  "recommendations": {
    "bestTimeToTrain": "Morning (7-9 AM) or Evening (6-8 PM)",
    "optimalRestDays": "Monday and Friday",
    "progressionStrategy": "Increase weight by 5% weekly",
    "keyFocusAreas": ["Form first", "Progressive overload"]
  },
  "weeks": [
    {
      "weekNumber": 1,
      "days": [
        {
          "dayNumber": 1,
          "dayName": "Push Day",
          "exercises": [
            {
              "name": "Bench Press",
              "sets": 4,
              "reps": 8,
              "rest": 90,
              "notes": "Focus on form"
            }
          ]
        }
      ]
    }
  ]
}

Modify the plan based on the user's request while keeping it aligned with their original goals. Keep it to 1-2 weeks maximum with MINIMAL exercises (3-6 per workout).`;

    const userPrompt = `Original preferences:
${buildOnboardingPrompt(originalOnboarding)}

Current workout plan:
${JSON.stringify(currentPlan, null, 2)}

User's request for changes:
${refinementText}

Please modify the workout plan according to the user's request. Return the complete updated plan as JSON.`;

    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01"
    };

    // Only add API key header if we have a key (not using proxy URL)
    if (apiKey && !isUrl) {
      headers["x-api-key"] = apiKey;
    }

    // Try multiple model names as fallback (most common first)
    const modelNames = [
      "claude-3-5-sonnet-20241022", // Claude 3.5 Sonnet (most common)
      "claude-sonnet-4-20250514",   // Latest Sonnet 4
      "claude-3-opus-20240229",     // Claude 3 Opus
      "claude-3-sonnet-20240229",   // Claude 3 Sonnet
      "claude-3-5-sonnet",          // Without date suffix
      "claude-sonnet-4",            // Without date suffix
    ];

    let lastError = null;
    let response = null;

    // Try each model name until one works
    for (const modelName of modelNames) {
      try {
        response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: modelName,
            max_tokens: 8000, // Reduced since we only need 1-2 weeks
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: userPrompt
              }
            ]
          })
        });

        if (response.ok) {
          console.log(`✅ Successfully used model: ${modelName}`);
          break; // Success, exit loop
        } else {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error?.type === 'not_found_error') {
            console.log(`⚠️ Model ${modelName} not found, trying next...`);
            lastError = errorData;
            response = null;
            continue; // Try next model
          } else {
            // Different error, break and handle it
            break;
          }
        }
      } catch (err) {
        console.log(`⚠️ Error with model ${modelName}:`, err.message);
        lastError = err;
        continue;
      }
    }

    if (!response) {
      throw new Error(`All model names failed. Last error: ${lastError?.error?.message || lastError?.message || 'Unknown error'}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || errorData.error?.type || JSON.stringify(errorData);
      console.error("Claude API error details:", JSON.stringify({
        status: response.status,
        statusText: response.statusText,
        errorData: errorData
      }, null, 2));
      throw new Error(
        errorMessage || 
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const plan = parseClaudeResponse(data);

    return {
      success: true,
      plan: plan,
      error: null
    };

  } catch (error) {
    const errorDetails = serializeError(error);
    console.error("Claude workout regeneration error:", JSON.stringify(errorDetails, null, 2));
    return {
      success: false,
      plan: null,
      error: error.message || "Failed to regenerate workout plan"
    };
  }
}

/**
 * Build prompt text from structured onboarding data
 */
function buildOnboardingPrompt(data) {
  let prompt = "Create a personalized workout plan based on the following comprehensive user information:\n\n";
  
  // Goals & Context
  prompt += "=== GOALS & CONTEXT ===\n";
  prompt += `Primary Goal: ${data.goals.primary}\n`;
  if (data.goals.secondary) prompt += `Secondary Goal: ${data.goals.secondary}\n`;
  prompt += `Time Horizon: ${data.goals.timeHorizon}\n`;
  prompt += `Why Training: ${data.goals.whyTraining}\n\n`;
  
  // Training Background
  prompt += "=== TRAINING BACKGROUND ===\n";
  prompt += `Training Age: ${data.background.trainingAge}\n`;
  prompt += `Familiar with Compound Lifts: ${data.background.familiarWithCompounds ? 'Yes' : 'No'}\n`;
  prompt += `Previous Programs: ${data.background.previousPrograms}\n`;
  if (data.background.dislikedMovements) {
    prompt += `Disliked Movements: ${data.background.dislikedMovements}\n`;
  }
  prompt += "\n";
  
  // Schedule & Recovery
  prompt += "=== SCHEDULE & RECOVERY ===\n";
  prompt += `Days Per Week: ${data.schedule.daysPerWeek}\n`;
  if (data.schedule.preferredRestDays) {
    prompt += `Preferred Rest Days: ${data.schedule.preferredRestDays}\n`;
  }
  prompt += `Session Length HARD LIMIT: ${data.schedule.sessionLengthLimit}\n`;
  prompt += `Sleep Quality: ${data.schedule.sleepQuality}\n`;
  prompt += `Stress Level: ${data.schedule.stressLevel}\n\n`;
  
  // Equipment & Environment
  prompt += "=== EQUIPMENT & ENVIRONMENT ===\n";
  prompt += `Training Location: ${data.equipment.location}\n`;
  prompt += `Available Equipment: ${data.equipment.available.join(", ")}\n`;
  if (data.equipment.avoid) {
    prompt += `Equipment to Avoid: ${data.equipment.avoid}\n`;
  }
  prompt += "\n";
  
  // Limitations
  prompt += "=== INJURIES & LIMITATIONS ===\n";
  prompt += `Has Injuries: ${data.limitations.hasInjuries ? 'Yes' : 'No'}\n`;
  if (data.limitations.hasInjuries && data.limitations.injuryDetails) {
    prompt += `Injury Details: ${data.limitations.injuryDetails}\n`;
  }
  if (data.limitations.movementsToAvoid) {
    prompt += `Movements to Avoid: ${data.limitations.movementsToAvoid}\n`;
  }
  prompt += "\n";
  
  // Intensity & Style
  prompt += "=== INTENSITY & STYLE ===\n";
  prompt += `Preferred Intensity: ${data.intensity.preferred}\n`;
  prompt += `Proximity to Failure: ${data.intensity.proximityToFailure}\n`;
  prompt += `Cardio Tolerance: ${data.intensity.cardioTolerance}\n`;
  prompt += `Include Conditioning: ${data.intensity.includeConditioning ? 'Yes' : 'No'}\n\n`;
  
  // Final Notes
  if (data.notes) {
    prompt += "=== ADDITIONAL NOTES ===\n";
    prompt += `${data.notes}\n\n`;
  }
  
  prompt += "\n=== CRITICAL REQUIREMENTS ===\n";
  prompt += "- Generate ONLY 1-2 weeks maximum\n";
  prompt += "- Use MINIMAL exercises: 3-6 exercises per workout maximum\n";
  prompt += "- Focus on EFFICIENCY: Choose exercises that deliver maximum results\n";
  prompt += "- Prioritize compound movements over isolation exercises\n";
  prompt += "- Respect session time limits and days per week availability\n";
  prompt += "- Provide recommendations for best training times, rest days, progression, and key focus areas\n";
  prompt += "\nGenerate a safe, realistic, and EFFECTIVE workout plan with MINIMAL exercises that efficiently helps the user reach their fitness goals.";
  
  return prompt;
}

// End of deprecated workout generation code - all functionality moved to server-side routes
