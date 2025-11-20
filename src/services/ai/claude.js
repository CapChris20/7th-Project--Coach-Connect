import Anthropic from '@anthropic-ai/sdk';
import Constants from 'expo-constants';

// Initialize Claude client
const apiKey = Constants.expoConfig?.extra?.claudeApiKey || process.env.EXPO_PUBLIC_CLAUDE_API_KEY;

let claude;

try {
  if (!apiKey) {
    throw new Error('Claude API key is required');
  }
  
  claude = new Anthropic({
    apiKey: apiKey,
  });
  console.log('Claude client initialized successfully');
} catch (error) {
  console.error('Claude initialization error:', error);
  throw new Error('Failed to initialize Claude');
}

// Generate personalized meal plan
export const generateMealPlan = async (userPreferences) => {
  try {
    console.log('Generating meal plan with Claude for user:', userPreferences.userId);
    
    const prompt = `Create a personalized meal plan for a ${userPreferences.age}-year-old ${userPreferences.gender} who is ${userPreferences.height}cm tall and weighs ${userPreferences.weight}kg. 
    
    Goals: ${userPreferences.goals}
    Activity Level: ${userPreferences.activityLevel}
    Dietary Restrictions: ${userPreferences.dietaryRestrictions}
    Target Calories: ${userPreferences.targetCalories}
    Macro Split: ${userPreferences.macroSplit}
    
    Provide a 7-day meal plan with breakfast, lunch, dinner, and snacks. Include specific foods, portions, and nutritional breakdown for each meal.`;

    const response = await claude.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    console.log('Meal plan generated successfully');
    return { 
      success: true, 
      data: {
        mealPlan: response.content[0].text,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Generate meal plan error:', error);
    return { success: false, error: error.message };
  }
};

// Chat with AI coach
export const chatWithCoach = async (message, conversationHistory = []) => {
  try {
    console.log('Sending message to Claude coach');
    
    const messages = [
      {
        role: "user",
        content: "You are Anatrox, an AI fitness coach. Provide helpful, motivating, and scientifically accurate fitness and nutrition advice. Be encouraging and supportive."
      },
      ...conversationHistory,
      {
        role: "user",
        content: message
      }
    ];

    const response = await claude.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 2000,
      messages: messages
    });

    console.log('Coach response generated successfully');
    return { 
      success: true, 
      data: {
        response: response.content[0].text,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Chat with coach error:', error);
    return { success: false, error: error.message };
  }
};
