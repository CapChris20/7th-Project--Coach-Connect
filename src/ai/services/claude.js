import Anthropic from '@anthropic-ai/sdk';
import Constants from 'expo-constants';

// Claude client removed - all AI calls should go through server routes
// This file is deprecated and should not be used for new features
let claude = null;

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
        content: "You are CoachConnect, an AI fitness coach. Provide helpful, motivating, and scientifically accurate fitness and nutrition advice. Be encouraging and supportive."
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
