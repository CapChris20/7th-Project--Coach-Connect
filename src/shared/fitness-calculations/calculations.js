/**
 * calculations
 *
 * Purpose: Fitness math utilities — BMR, TDEE, macros, body composition.
 * Why it matters: Single source of truth for all energy and macro calculations across the app.
 * Area: src/shared/fitness
 * Key exports: calculateBMR, calculateTDEE, calculateMacros, estimateBodyFat, calculateBMI, calculateWeightGoal
 *
 * @file-header
 */

/** BMR calculation using Mifflin-St Jeor equation. */
export const calculateBMR = (weight, height, age, gender) => {
  try {
    if (!gender) {
      console.warn('calculateBMR: missing gender, defaulting to male');
      gender = 'male';
    }
    if (height <= 0 || weight <= 0) {
      console.warn('calculateBMR: invalid height or weight', { height, weight });
      return null;
    }
    console.log('Calculating BMR for:', { weight, height, age, gender });

    let bmr;
    if (gender.toLowerCase() === 'male') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }

    console.log('BMR calculated:', bmr);
    return Math.round(bmr);
  } catch (error) {
    console.error('BMR calculation error:', error);
    return 0;
  }
};

/** TDEE calculation based on activity level. */
export const calculateTDEE = (bmr, activityLevel) => {
  try {
    console.log('Calculating TDEE with activity level:', activityLevel);

    const activityMultipliers = {
      'sedentary': 1.2,
      'light': 1.375,
      'moderate': 1.55,
      'active': 1.725,
      'very_active': 1.9,
    };

    const multiplier = activityMultipliers[activityLevel.toLowerCase()] || 1.2;
    const tdee = bmr * multiplier;

    console.log('TDEE calculated:', tdee);
    return Math.round(tdee);
  } catch (error) {
    console.error('TDEE calculation error:', error);
    return 0;
  }
};

/** Macro split calculator. */
export const calculateMacros = (calories, goal, bodyWeight) => {
  try {
    console.log('Calculating macros for calories:', calories, 'goal:', goal);

    let protein, carbs, fat;

    if (goal === 'weight_loss') {
      protein = Math.round(bodyWeight * 2.2);
      fat = Math.round(calories * 0.25 / 9);
      carbs = Math.round((calories - (protein * 4) - (fat * 9)) / 4);
    } else if (goal === 'muscle_gain') {
      protein = Math.round(bodyWeight * 2.5);
      fat = Math.round(calories * 0.25 / 9);
      carbs = Math.round((calories - (protein * 4) - (fat * 9)) / 4);
    } else {
      protein = Math.round(bodyWeight * 2.0);
      fat = Math.round(calories * 0.25 / 9);
      carbs = Math.round((calories - (protein * 4) - (fat * 9)) / 4);
    }

    const result = { protein, carbs, fat };
    console.log('Macros calculated:', result);
    return result;
  } catch (error) {
    console.error('Macro calculation error:', error);
    return { protein: 0, carbs: 0, fat: 0 };
  }
};

/** Body fat percentage estimation using Deurenberg formula. */
export const estimateBodyFat = (gender, age, bmi) => {
  try {
    console.log('Estimating body fat for:', { gender, age, bmi });

    if (!gender) { gender = 'male'; }
    let bodyFat;
    if (gender.toLowerCase() === 'male') {
      bodyFat = (1.20 * bmi) + (0.23 * age) - 16.2;
    } else {
      bodyFat = (1.20 * bmi) + (0.23 * age) - 5.4;
    }

    bodyFat = Math.max(3, Math.min(50, bodyFat));

    console.log('Body fat estimated:', bodyFat);
    return Math.round(bodyFat);
  } catch (error) {
    console.error('Body fat estimation error:', error);
    return 0;
  }
};

/** BMI calculation. Returns null when height is zero or missing. */
export const calculateBMI = (weight, height) => {
  try {
    if (!height || height <= 0) return null;
    console.log('Calculating BMI for:', { weight, height });

    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);

    console.log('BMI calculated:', bmi);
    return Math.round(bmi * 10) / 10;
  } catch (error) {
    console.error('BMI calculation error:', error);
    return 0;
  }
};

/** Weekly weight goal and daily calorie adjustment. */
export const calculateWeightGoal = (currentWeight, targetWeight, timeframe) => {
  try {
    console.log('Calculating weight goal:', { currentWeight, targetWeight, timeframe });

    const weightDifference = targetWeight - currentWeight;
    const weeklyChange = weightDifference / (timeframe / 7);
    const dailyCalorieAdjustment = weeklyChange * 500;

    console.log('Weight goal calculated:', { weightDifference, weeklyChange, dailyCalorieAdjustment });
    return {
      weightDifference,
      weeklyChange: Math.round(weeklyChange * 10) / 10,
      dailyCalorieAdjustment: Math.round(dailyCalorieAdjustment),
    };
  } catch (error) {
    console.error('Weight goal calculation error:', error);
    return { weightDifference: 0, weeklyChange: 0, dailyCalorieAdjustment: 0 };
  }
};
