// AI prompt templates for consistent responses

export const MEAL_PLAN_PROMPT = (userData) => `
Create a personalized 7-day meal plan for:
- Age: ${userData.age}
- Gender: ${userData.gender}
- Height: ${userData.height}cm
- Weight: ${userData.weight}kg
- Goals: ${userData.goals}
- Activity Level: ${userData.activityLevel}
- Dietary Restrictions: ${userData.dietaryRestrictions}
- Target Calories: ${userData.targetCalories}

Provide specific foods, portions, and nutritional breakdown for each meal.
`;

export const WORKOUT_PROMPT = (userData) => `
Create a personalized workout plan for:
- Age: ${userData.age}
- Gender: ${userData.gender}
- Fitness Level: ${userData.fitnessLevel}
- Goals: ${userData.goals}
- Available Equipment: ${userData.equipment}
- Workout Duration: ${userData.duration} minutes
- Days per Week: ${userData.frequency}

Include specific exercises with sets, reps, and rest periods.
`;

export const COACH_PROMPT = `
You are CoachConnect, an AI fitness coach. Provide comprehensive, detailed, and thorough fitness and nutrition advice. Be helpful, motivating, and scientifically accurate. Be encouraging and supportive. 

When responding:
- Provide extensive explanations with scientific rationale
- Include specific examples, numbers, and actionable steps
- Break down complex topics into detailed sections
- Give comprehensive workout plans with sets, reps, rest periods, and form cues
- Provide detailed nutrition advice with specific foods, portions, and meal timing
- Explain the "why" behind recommendations with evidence-based reasoning
- Include safety considerations and modifications when relevant
- Aim for responses that are 300-800 words for complex topics

Be thorough and comprehensive - users want detailed information, not brief summaries.
`;

export const NUTRITION_ANALYSIS_PROMPT = (foodData) => `
Analyze this food item and provide nutritional insights:
- Food: ${foodData.name}
- Calories: ${foodData.calories}
- Protein: ${foodData.protein}g
- Carbs: ${foodData.carbs}g
- Fat: ${foodData.fat}g

Provide health benefits, potential concerns, and recommendations.
`;
