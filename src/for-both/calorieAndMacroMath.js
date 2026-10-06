// Fitness math shared by client and trainer screens: BMR, TDEE, macros, body fat, BMI, weight goals.
// Flow: each export checks its inputs, applies one formula, and returns a rounded number or a small object.
// Used by the client home screen and the onboarding calculation tests.

// ===== NAMED CONSTANTS =====

const MALE_GENDER = 'male';

// vocab: Mifflin-St Jeor. Resting calories from weight (kg), height (cm), and age.
// Manipulate here: these are the published equation constants, not display tweaks.
const BMR_WEIGHT_COEFFICIENT = 10;
const BMR_HEIGHT_COEFFICIENT = 6.25;
const BMR_AGE_COEFFICIENT = 5;
const BMR_MALE_CONSTANT = 5;
const BMR_FEMALE_CONSTANT = 161;

// vocab: TDEE = resting calories times how active the person is.
// Unknown activity levels use the sedentary multiplier.
const SEDENTARY_ACTIVITY_MULTIPLIER = 1.2;
const ACTIVITY_MULTIPLIERS = {
  sedentary: SEDENTARY_ACTIVITY_MULTIPLIER,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const WEIGHT_LOSS_GOAL = 'weight_loss';
const MUSCLE_GAIN_GOAL = 'muscle_gain';

// Grams of protein per kilogram of body weight. Anything that isn't weight_loss or muscle_gain
// (including "maintenance" and "build_muscle") uses the maintenance multiplier.
const PROTEIN_GRAMS_PER_KG_WEIGHT_LOSS = 2.2;
const PROTEIN_GRAMS_PER_KG_MUSCLE_GAIN = 2.5;
const PROTEIN_GRAMS_PER_KG_MAINTENANCE = 2.0;

const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_CARBS = 4;
const CALORIES_PER_GRAM_FAT = 9;
// Fat is always this share of calories. Carbs get whatever calories are left.
const FAT_CALORIE_SHARE = 0.25;

// vocab: Deurenberg estimate. Not a scan — a rough percent from BMI, age, and sex.
const BODY_FAT_BMI_COEFFICIENT = 1.2;
const BODY_FAT_AGE_COEFFICIENT = 0.23;
const BODY_FAT_MALE_OFFSET = 16.2;
const BODY_FAT_FEMALE_OFFSET = 5.4;
const MINIMUM_BODY_FAT_PERCENT = 3;
const MAXIMUM_BODY_FAT_PERCENT = 50;

const CENTIMETERS_PER_METER = 100;
const ONE_DECIMAL_SCALE = 10;

const DAYS_PER_WEEK = 7;
// The app's rule: each kilogram per week adjusts daily calories by this much.
// Manipulate here: changing it shifts every weight-goal plan in the app.
const CALORIES_PER_KG_OF_WEEKLY_CHANGE = 500;

// ===== HELPER FUNCTIONS =====

function isMale(gender) {
  return gender.toLowerCase() === MALE_GENDER;
}

function basalMetabolicRateForGender(weight, height, age, gender) {
  const restingCalories =
    BMR_WEIGHT_COEFFICIENT * weight +
    BMR_HEIGHT_COEFFICIENT * height -
    BMR_AGE_COEFFICIENT * age;
  if (isMale(gender)) return restingCalories + BMR_MALE_CONSTANT;
  return restingCalories - BMR_FEMALE_CONSTANT;
}

function proteinGramsForGoal(goal, bodyWeight) {
  if (goal === WEIGHT_LOSS_GOAL) return Math.round(bodyWeight * PROTEIN_GRAMS_PER_KG_WEIGHT_LOSS);
  if (goal === MUSCLE_GAIN_GOAL) return Math.round(bodyWeight * PROTEIN_GRAMS_PER_KG_MUSCLE_GAIN);
  return Math.round(bodyWeight * PROTEIN_GRAMS_PER_KG_MAINTENANCE);
}

// Same fat-then-carbs fill for every goal. Only the protein grams change.
function macroSplitFromProtein(calories, proteinGrams) {
  const fatGrams = Math.round((calories * FAT_CALORIE_SHARE) / CALORIES_PER_GRAM_FAT);
  const carbGrams = Math.round(
    (calories - proteinGrams * CALORIES_PER_GRAM_PROTEIN - fatGrams * CALORIES_PER_GRAM_FAT) /
      CALORIES_PER_GRAM_CARBS
  );
  return { protein: proteinGrams, carbs: carbGrams, fat: fatGrams };
}

function bodyFatPercentForGender(gender, age, bodyMassIndex) {
  const fromBmiAndAge = BODY_FAT_BMI_COEFFICIENT * bodyMassIndex + BODY_FAT_AGE_COEFFICIENT * age;
  if (isMale(gender)) return fromBmiAndAge - BODY_FAT_MALE_OFFSET;
  return fromBmiAndAge - BODY_FAT_FEMALE_OFFSET;
}

function clampBodyFatPercent(bodyFatPercent) {
  return Math.max(MINIMUM_BODY_FAT_PERCENT, Math.min(MAXIMUM_BODY_FAT_PERCENT, bodyFatPercent));
}

function roundToOneDecimal(value) {
  return Math.round(value * ONE_DECIMAL_SCALE) / ONE_DECIMAL_SCALE;
}

// ===== MAIN FUNCTION =====

/**
 * Basal metabolic rate with the Mifflin-St Jeor equation.
 * Missing gender is treated as male. Zero or negative height or weight returns null.
 * @param {number} weight Kilograms
 * @param {number} height Centimeters
 * @param {number} age Years
 * @param {string} gender
 * @returns {number|null}
 */
export function calculateBMR(weight, height, age, gender) {
  try {
    let genderForFormula = gender;
    if (!genderForFormula) {
      console.warn('calculateBMR: missing gender, defaulting to male');
      genderForFormula = MALE_GENDER;
    }
    if (height <= 0 || weight <= 0) {
      console.warn('calculateBMR: invalid height or weight', { height, weight });
      return null;
    }
    console.log('Calculating BMR for:', { weight, height, age, gender: genderForFormula });

    const basalMetabolicRate = basalMetabolicRateForGender(weight, height, age, genderForFormula);

    console.log('BMR calculated:', basalMetabolicRate);
    return Math.round(basalMetabolicRate);
  } catch (error) {
    console.error('BMR calculation error:', error);
    return 0;
  }
}

/**
 * Total daily energy expenditure from a BMR and an activity level name.
 * Unknown names use the sedentary multiplier.
 * @param {number} basalMetabolicRate
 * @param {string} activityLevel sedentary, light, moderate, active, or very_active
 * @returns {number}
 */
export function calculateTDEE(basalMetabolicRate, activityLevel) {
  try {
    console.log('Calculating TDEE with activity level:', activityLevel);

    const multiplier =
      ACTIVITY_MULTIPLIERS[activityLevel.toLowerCase()] || SEDENTARY_ACTIVITY_MULTIPLIER;
    const totalDailyEnergyExpenditure = basalMetabolicRate * multiplier;

    console.log('TDEE calculated:', totalDailyEnergyExpenditure);
    return Math.round(totalDailyEnergyExpenditure);
  } catch (error) {
    console.error('TDEE calculation error:', error);
    return 0;
  }
}

/**
 * Protein, carb, and fat grams for a calorie target.
 * Goals other than weight_loss and muscle_gain use the maintenance protein rate.
 * @param {number} calories
 * @param {string} goal
 * @param {number} bodyWeight Kilograms
 * @returns {{ protein: number, carbs: number, fat: number }}
 */
export function calculateMacros(calories, goal, bodyWeight) {
  try {
    console.log('Calculating macros for calories:', calories, 'goal:', goal);

    const proteinGrams = proteinGramsForGoal(goal, bodyWeight);
    const result = macroSplitFromProtein(calories, proteinGrams);

    console.log('Macros calculated:', result);
    return result;
  } catch (error) {
    console.error('Macro calculation error:', error);
    return { protein: 0, carbs: 0, fat: 0 };
  }
}

/**
 * Rough body-fat percent from the Deurenberg formula, clamped between 3 and 50.
 * Missing gender is treated as male. The log line shows the gender that was passed in.
 * @param {string} gender
 * @param {number} age
 * @param {number} bodyMassIndex
 * @returns {number}
 */
export function estimateBodyFat(gender, age, bodyMassIndex) {
  try {
    console.log('Estimating body fat for:', { gender, age, bmi: bodyMassIndex });

    let genderForFormula = gender;
    if (!genderForFormula) {
      genderForFormula = MALE_GENDER;
    }
    const unclamped = bodyFatPercentForGender(genderForFormula, age, bodyMassIndex);
    const clamped = clampBodyFatPercent(unclamped);

    console.log('Body fat estimated:', clamped);
    return Math.round(clamped);
  } catch (error) {
    console.error('Body fat estimation error:', error);
    return 0;
  }
}

/**
 * Body mass index. Height is centimeters. Returns null when height is zero or missing.
 * @param {number} weight Kilograms
 * @param {number} height Centimeters
 * @returns {number|null}
 */
export function calculateBMI(weight, height) {
  try {
    if (!height || height <= 0) return null;
    console.log('Calculating BMI for:', { weight, height });

    const heightInMeters = height / CENTIMETERS_PER_METER;
    const bodyMassIndex = weight / (heightInMeters * heightInMeters);

    console.log('BMI calculated:', bodyMassIndex);
    return roundToOneDecimal(bodyMassIndex);
  } catch (error) {
    console.error('BMI calculation error:', error);
    return 0;
  }
}

/**
 * Weekly weight change and the daily calorie adjustment for that pace.
 * timeframe is days. The returned weeklyChange is rounded to one decimal; the log shows the raw value.
 * @param {number} currentWeight
 * @param {number} targetWeight
 * @param {number} timeframe Days
 * @returns {{ weightDifference: number, weeklyChange: number, dailyCalorieAdjustment: number }}
 */
export function calculateWeightGoal(currentWeight, targetWeight, timeframe) {
  try {
    console.log('Calculating weight goal:', { currentWeight, targetWeight, timeframe });

    const weightDifference = targetWeight - currentWeight;
    const weeklyChange = weightDifference / (timeframe / DAYS_PER_WEEK);
    const dailyCalorieAdjustment = weeklyChange * CALORIES_PER_KG_OF_WEEKLY_CHANGE;

    console.log('Weight goal calculated:', { weightDifference, weeklyChange, dailyCalorieAdjustment });
    return {
      weightDifference,
      weeklyChange: roundToOneDecimal(weeklyChange),
      dailyCalorieAdjustment: Math.round(dailyCalorieAdjustment),
    };
  } catch (error) {
    console.error('Weight goal calculation error:', error);
    return { weightDifference: 0, weeklyChange: 0, dailyCalorieAdjustment: 0 };
  }
}
