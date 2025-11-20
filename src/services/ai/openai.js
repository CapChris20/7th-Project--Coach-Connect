import OpenAI from 'openai';
import Constants from 'expo-constants';

// Initialize OpenAI client
const apiKey = Constants.expoConfig?.extra?.openaiApiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY;

let openai;

try {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  
  openai = new OpenAI({
    apiKey: apiKey,
  });
  console.log('OpenAI client initialized successfully');
} catch (error) {
  console.error('OpenAI initialization error:', error);
  throw new Error('Failed to initialize OpenAI');
}

// Transcribe audio using Whisper
export const transcribeAudio = async (audioUri) => {
  try {
    console.log('Starting audio transcription with Whisper');
    
    // Convert audio file to the format expected by OpenAI
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Audio transcribed successfully');
    
    return { 
      success: true, 
      data: {
        text: result.text,
        transcribedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Audio transcription error:', error);
    return { success: false, error: error.message };
  }
};

// Generate workout suggestions using GPT
export const generateWorkoutSuggestions = async (userProfile, preferences) => {
  try {
    console.log('Generating workout suggestions with GPT');
    
    const prompt = `Create a personalized workout plan for a ${userProfile.age}-year-old ${userProfile.gender} who is ${userProfile.height}cm tall and weighs ${userProfile.weight}kg.
    
    Fitness Level: ${userProfile.fitnessLevel}
    Goals: ${preferences.goals}
    Available Equipment: ${preferences.equipment}
    Workout Duration: ${preferences.duration} minutes
    Days per Week: ${preferences.frequency}
    
    Provide specific exercises with sets, reps, and rest periods. Include warm-up and cool-down suggestions.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a professional fitness trainer. Provide safe, effective, and personalized workout recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    console.log('Workout suggestions generated successfully');
    return { 
      success: true, 
      data: {
        workoutPlan: response.choices[0].message.content,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Generate workout suggestions error:', error);
    return { success: false, error: error.message };
  }
};
