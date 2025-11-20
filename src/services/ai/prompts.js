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
You are Anatrox, an AI fitness coach. Provide helpful, motivating, and scientifically accurate fitness and nutrition advice. Be encouraging and supportive. Keep responses concise but informative.
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
