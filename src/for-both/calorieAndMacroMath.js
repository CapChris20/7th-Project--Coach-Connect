// Fitness math shared by client and trainer screens: BMR, TDEE, macros, body fat, BMI, weight goals.
// Flow: each export checks its inputs → applies one formula → returns a rounded number or a small object.
// Used by the client home screen and the onboarding calculation tests.
// Read order: constants → exported recipes → PLUMBING formula helpers.

// ===== NAMED CONSTANTS =====

const MALE_GENDER = 'male';

// Mifflin-St Jeor resting calories from weight (kg), height (cm), and age.
// Manipulate here: these are the published equation constants, not display tweaks.
const BMR_WEIGHT_COEFFICIENT = 10;
const BMR_HEIGHT_COEFFICIENT = 6.25;
const BMR_AGE_COEFFICIENT = 5;
const BMR_MALE_CONSTANT = 5;
const BMR_FEMALE_CONSTANT = 161;

// TDEE = resting calories times how active the person is.
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

// Grams of protein per kilogram of body weight.
// Anything that is not weight_loss or muscle_gain (including "maintenance" and "build_muscle")
// uses the maintenance multiplier.
const PROTEIN_GRAMS_PER_KG_WEIGHT_LOSS = 2.2;
const PROTEIN_GRAMS_PER_KG_MUSCLE_GAIN = 2.5;
const PROTEIN_GRAMS_PER_KG_MAINTENANCE = 2.0;

const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_CARBS = 4;
const CALORIES_PER_GRAM_FAT = 9;
// Fat is always this share of calories. Carbs get whatever calories are left.
const FAT_CALORIE_SHARE = 0.25;

// Deurenberg estimate = rough body-fat percent from BMI, age, and sex — not a scan.
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

const EMPTY_MACROS = { protein: 0, carbs: 0, fat: 0 };
const EMPTY_WEIGHT_GOAL = {
  weightDifference: 0,
  weeklyChange: 0,
  dailyCalorieAdjustment: 0,
};

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
    // 1. Pick a gender for the formula. Missing → male (and warn).
    const genderForFormula = genderOrMaleDefault(gender, 'calculateBMR');

    // 2. Refuse zero / negative height or weight.
    if (heightOrWeightIsInvalid(height, weight)) {
      console.warn('calculateBMR: invalid height or weight', { height, weight });
      return null;
    }

    console.log('Calculating BMR for:', {
      weight,
      height,
      age,
      gender: genderForFormula,
    });

    // 3. Mifflin-St Jeor, then round to a whole calorie.
    const basalMetabolicRate = basalMetabolicRateForGender(
      weight,
      height,
      age,
      genderForFormula,
    );
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
    // 1. Unknown activity names use the sedentary multiplier.
    console.log('Calculating TDEE with activity level:', activityLevel);
    const multiplier = activityMultiplier(activityLevel);

    // 2. Resting calories times how active the person is.
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
    // 1. Protein grams from the goal. Everything else uses the maintenance rate.
    console.log('Calculating macros for calories:', calories, 'goal:', goal);
    const proteinGrams = proteinGramsForGoal(goal, bodyWeight);

    // 2. Fat is a fixed share. Carbs get the leftover calories.
    const result = macroSplitFromProtein(calories, proteinGrams);
    console.log('Macros calculated:', result);
    return result;
  } catch (error) {
    console.error('Macro calculation error:', error);
    return EMPTY_MACROS;
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
    // 1. Missing gender is treated as male. The log still shows what was passed in.
    console.log('Estimating body fat for:', { gender, age, bmi: bodyMassIndex });
    const genderForFormula = genderOrMaleDefault(gender, null);

    // 2. Deurenberg estimate, then clamp between 3% and 50%.
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
    // 1. Height is centimeters. Zero or missing height cannot make a BMI.
    if (heightIsMissingOrZero(height)) return null;
    console.log('Calculating BMI for:', { weight, height });

    // 2. kg / m², then one decimal place.
    const bodyMassIndex = bodyMassIndexFromKgAndCm(weight, height);
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
    // 1. How far the target is, and how many kilograms that is per week.
    console.log('Calculating weight goal:', { currentWeight, targetWeight, timeframe });
    const weightDifference = targetWeight - currentWeight;
    const weeksInTimeframe = timeframe / DAYS_PER_WEEK;
    const weeklyChange = weightDifference / weeksInTimeframe;

    // 2. Each kilogram per week shifts daily calories by the app's rule.
    const dailyCalorieAdjustment = weeklyChange * CALORIES_PER_KG_OF_WEEKLY_CHANGE;
    console.log('Weight goal calculated:', {
      weightDifference,
      weeklyChange,
      dailyCalorieAdjustment,
    });

    return {
      weightDifference,
      weeklyChange: roundToOneDecimal(weeklyChange),
      dailyCalorieAdjustment: Math.round(dailyCalorieAdjustment),
    };
  } catch (error) {
    console.error('Weight goal calculation error:', error);
    return EMPTY_WEIGHT_GOAL;
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless you are changing the formulas.

function genderOrMaleDefault(gender, warnLabel) {
  if (gender) return gender;
  if (warnLabel) console.warn(`${warnLabel}: missing gender, defaulting to male`);
  return MALE_GENDER;
}

function heightOrWeightIsInvalid(height, weight) {
  if (height <= 0) return true;
  if (weight <= 0) return true;
  return false;
}

function heightIsMissingOrZero(height) {
  if (!height) return true;
  if (height <= 0) return true;
  return false;
}

function genderIsMale(gender) {
  return gender.toLowerCase() === MALE_GENDER;
}

function basalMetabolicRateForGender(weight, height, age, gender) {
  const restingCalories =
    BMR_WEIGHT_COEFFICIENT * weight +
    BMR_HEIGHT_COEFFICIENT * height -
    BMR_AGE_COEFFICIENT * age;

  if (genderIsMale(gender)) return restingCalories + BMR_MALE_CONSTANT;
  return restingCalories - BMR_FEMALE_CONSTANT;
}

function activityMultiplier(activityLevel) {
  const namedMultiplier = ACTIVITY_MULTIPLIERS[activityLevel.toLowerCase()];
  if (namedMultiplier) return namedMultiplier;
  return SEDENTARY_ACTIVITY_MULTIPLIER;
}

function proteinGramsForGoal(goal, bodyWeight) {
  if (goal === WEIGHT_LOSS_GOAL) {
    return Math.round(bodyWeight * PROTEIN_GRAMS_PER_KG_WEIGHT_LOSS);
  }
  if (goal === MUSCLE_GAIN_GOAL) {
    return Math.round(bodyWeight * PROTEIN_GRAMS_PER_KG_MUSCLE_GAIN);
  }
  return Math.round(bodyWeight * PROTEIN_GRAMS_PER_KG_MAINTENANCE);
}

function macroSplitFromProtein(calories, proteinGrams) {
  const fatGrams = Math.round((calories * FAT_CALORIE_SHARE) / CALORIES_PER_GRAM_FAT);
  const caloriesUsedByProtein = proteinGrams * CALORIES_PER_GRAM_PROTEIN;
  const caloriesUsedByFat = fatGrams * CALORIES_PER_GRAM_FAT;
  const caloriesLeftForCarbs = calories - caloriesUsedByProtein - caloriesUsedByFat;
  const carbGrams = Math.round(caloriesLeftForCarbs / CALORIES_PER_GRAM_CARBS);
  return { protein: proteinGrams, carbs: carbGrams, fat: fatGrams };
}

function bodyFatPercentForGender(gender, age, bodyMassIndex) {
  const fromBmiAndAge =
    BODY_FAT_BMI_COEFFICIENT * bodyMassIndex + BODY_FAT_AGE_COEFFICIENT * age;

  if (genderIsMale(gender)) return fromBmiAndAge - BODY_FAT_MALE_OFFSET;
  return fromBmiAndAge - BODY_FAT_FEMALE_OFFSET;
}

function clampBodyFatPercent(bodyFatPercent) {
  if (bodyFatPercent < MINIMUM_BODY_FAT_PERCENT) return MINIMUM_BODY_FAT_PERCENT;
  if (bodyFatPercent > MAXIMUM_BODY_FAT_PERCENT) return MAXIMUM_BODY_FAT_PERCENT;
  return bodyFatPercent;
}

function bodyMassIndexFromKgAndCm(weight, heightCentimeters) {
  const heightInMeters = heightCentimeters / CENTIMETERS_PER_METER;
  return weight / (heightInMeters * heightInMeters);
}

function roundToOneDecimal(value) {
  return Math.round(value * ONE_DECIMAL_SCALE) / ONE_DECIMAL_SCALE;
}
