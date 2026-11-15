// Hourly-rotating coach starter questions and the "can help with" cards.
// Flow: hour slot → category pool (plus personalized lines from logs) → one prompt per card.
// Used by CoachHomeScreen. Keep the prompt strings; they are what the user taps.

// ===== NAMED CONSTANTS =====

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const HOURS_PER_DAY = 24;
const MS_PER_HOUR = MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;

// Manipulate here: each category jumps a different number of hour-slots so two cards rarely match.
const CATEGORY_OFFSET = { train: 0, fuel: 11, recover: 23, web: 37, log: 5, data: 19, photo: 29 };

const POOL_HOUR_WEIGHT = 17;
const POOL_DAY_WEIGHT = 31;
const POOL_SALT_WEIGHT = 13;

const RECENT_SESSION_LOOKBACK = 12;
const SPOTLIGHT_LIMIT = 8;
const LOW_SLEEP_HOURS = 6.5;
const LOW_WATER_OUNCES = 48;
const PROTEIN_GAP_FRACTION = 0.6;

export const CAN_HELP_WITH_ITEMS = [
  {
    id: 'tools',
    title: 'Log sleep, water, steps, or mood',
    subtitle: 'Dashboard tools with one tap',
    icon: 'create-outline',
    accent: '#0A0A0A',
    rim: ['#FF6B9D', '#FB923C'],
    prompt: 'Can you log data for me?',
  },
  {
    id: 'web',
    title: 'Fitness web research',
    subtitle: 'Studies, supplements & training evidence — with sources',
    icon: 'globe-outline',
    accent: '#64D2FF',
    rim: ['#06B6D4', '#3B82F6'],
    prompt: 'Search the web: what does research say about protein intake for lifters?',
  },
  {
    id: 'data',
    title: 'Review my logs and context',
    subtitle: 'Macros, workouts, and weekly trends',
    icon: 'stats-chart-outline',
    accent: '#0A0A0A',
    rim: ['#FF6B9D', '#FB923C'],
    prompt: 'Can you show me my data and context?',
  },
  {
    id: 'photo',
    title: 'Analyze a progress photo',
    subtitle: 'Form check or physique feedback',
    icon: 'image-outline',
    accent: '#F97316',
    rim: ['#F97316', '#FBBF24'],
    prompt: 'Can you analyze a photo for me?',
  },
  {
    id: 'train',
    title: 'Adjust my training plan',
    subtitle: 'Splits, swaps, and progression',
    icon: 'barbell-outline',
    accent: '#FB7185',
    // Design Law: accent rim only — never solid purple/pink chrome, never green
    rim: ['#A78BFA', '#E879F9'],
    prompt: 'Help me adjust my training plan',
  },
  {
    id: 'recover',
    title: 'Tighten up recovery',
    subtitle: 'Sleep, rest days, and stress',
    icon: 'moon-outline',
    accent: '#60A5FA',
    rim: ['#60A5FA', '#818CF8'],
    prompt: 'Help me improve my recovery this week',
  },
];

// Card id → category pool used when refreshing that card’s prompt for the hour.
const CAN_HELP_CATEGORY_MAP = {
  tools: 'log',
  web: 'web',
  data: 'data',
  photo: 'photo',
  train: 'train',
  recover: 'recover',
};

// Action orb id → category pool for the hourly starter string.
const COACH_ACTION_CATEGORY_MAP = {
  log: 'log',
  web: 'web',
  data: 'data',
};

// Copy pools frozen; edit only with product approval
const TRAIN_PROMPTS = [
  'Dial in my training plan for this week',
  'If I only have 3 sessions this week, how should I use them?',
  'Am I doing too much volume right now — what should I cut or keep?',
  'Help me choose between full-body and upper/lower for my schedule',
  'What should my main lifts look like this week if recovery has been rough?',
  'How do I break a bench plateau without wrecking my shoulders?',
  'Build me a 4-day split with clear progression for the next 2 weeks',
  'Spot the biggest mistake in how I am currently training',
  'What is a smart deload week for me right now?',
  'How should I progress my squat if sleep has been bad?',
];

const FUEL_PROMPTS = [
  'Help me line up meals that match my goal',
  "What's one nutrition habit that would move the needle most for me?",
  'Am I eating enough protein for my training load?',
  'How should I adjust carbs on rest days vs training days?',
  'Give me a simple high-protein day of eating',
  'What should I eat before and after my workout today?',
  'Help me fix my weekend nutrition without being miserable',
  'How many calories should I aim for if I want steady fat loss?',
  'What is a realistic macro split for muscle gain at my size?',
  'How do I hit my protein target when I am busy all day?',
];

const RECOVER_PROMPTS = [
  'Tighten up my recovery so I actually adapt',
  'My sleep has been inconsistent — what should I change first?',
  'How much rest do I need between hard leg days?',
  'What recovery habits give the best ROI for lifters?',
  'I feel run down — train lighter or take a rest day?',
  'Help me build a wind-down routine that actually works',
  'How do I know if I am under-recovered vs just lazy?',
  'What should mobility look like if I only have 10 minutes?',
];

const WEB_PROMPTS = [
  'Search the web: best evidence-based approach for body recomposition',
  'What does the research say about creatine loading vs maintenance?',
  'Search the web: how much protein do lifters really need per day?',
  'What do studies say about ashwagandha and stress or sleep?',
  'Search the web: is 10k steps per day actually meaningful for fat loss?',
  'Compare full-body vs PPL for busy schedules — what does evidence favor?',
  'Search the web: safest way to increase training volume over time',
  'What does research say about meal timing around workouts?',
];

const LOG_PROMPTS = [
  'Can you log data for me?',
  'Log my steps for today',
  'Can you log that I slept 8 hours last night?',
  'Track my water intake for today',
  'Can you log my mood for today?',
  'Log my weight for this morning',
  'Can you record my protein intake for today?',
];

const DATA_PROMPTS = [
  'Can you show me my data and context?',
  'Review my macros and workouts from this week',
  'How am I tracking against my goals right now?',
  'Show me my training and nutrition trends',
  'What patterns do you see in my recent logs?',
  'Summarize my week — sleep, food, and workouts',
];

const PHOTO_PROMPTS = [
  'Can you analyze a photo for me?',
  'Check my form in this photo and give coaching cues',
  'Give me physique feedback from this progress photo',
  'What should I improve based on this gym photo?',
];

// ===== HELPER FUNCTIONS =====

function calendarDayIndexFromNow(now = Date.now()) {
  return Math.floor(now / MS_PER_DAY);
}

function pickOnePromptByHourSlot(promptPool, hourSlot, saltText = '') {
  const nonEmptyPrompts = [];
  const rawPool = promptPool || [];
  for (let index = 0; index < rawPool.length; index += 1) {
    if (rawPool[index]) nonEmptyPrompts.push(rawPool[index]);
  }
  if (!nonEmptyPrompts.length) return '';

  const daySeed = calendarDayIndexFromNow(hourSlot * MS_PER_HOUR);
  const saltLength = String(saltText || '').length;
  const poolIndex = Math.abs(
    (hourSlot * POOL_HOUR_WEIGHT + daySeed * POOL_DAY_WEIGHT + saltLength * POOL_SALT_WEIGHT) %
      nonEmptyPrompts.length,
  );
  return nonEmptyPrompts[poolIndex];
}

function mergeUniquePromptLines(baseLines, contextualLines) {
  const seenPromptText = new Set();
  const mergedLines = [];
  const orderedLines = [...(contextualLines || []), ...(baseLines || [])];

  for (let index = 0; index < orderedLines.length; index += 1) {
    const promptText = String(orderedLines[index] || '').trim();
    if (!promptText) continue;
    if (seenPromptText.has(promptText)) continue;
    seenPromptText.add(promptText);
    mergedLines.push(promptText);
  }
  return mergedLines;
}

function wordsForPrimaryGoal(userData) {
  if (!userData) {
    return '';
  }
  if (userData.primaryGoal) {
    return String(userData.primaryGoal).replace(/_/g, ' ').trim();
  }
  if (userData.goal) {
    return String(userData.goal).replace(/_/g, ' ').trim();
  }
  if (Array.isArray(userData.goals) && userData.goals[0]) {
    return String(userData.goals[0]).replace(/_/g, ' ').trim();
  }
  return '';
}

function userProfileIsTrainer(userData) {
  if (!userData) {
    return false;
  }
  const roleText = String(userData.role || '').toLowerCase();
  return roleText === 'trainer';
}

function sessionListOrEmpty(sessions) {
  if (Array.isArray(sessions)) {
    return sessions;
  }
  return [];
}

function topicTagsFromRecentChats(sessions) {
  const topicTags = [];
  const sessionList = sessionListOrEmpty(sessions);
  const newestSessions = sessionList.slice(0, RECENT_SESSION_LOOKBACK);

  for (let index = 0; index < newestSessions.length; index += 1) {
    const session = newestSessions[index];
    const chatBlob = `${session.lastUserMessage || ''} ${session.title || ''}`.toLowerCase();
    if (/protein|macro|meal|eat|calorie|food/.test(chatBlob)) {
      topicTags.push('nutrition');
    }
    if (/sleep|recover|rest|sore/.test(chatBlob)) {
      topicTags.push('recovery');
    }
    if (/squat|bench|deadlift|workout|lift|train/.test(chatBlob)) {
      topicTags.push('training');
    }
    if (/injur|pain|knee|shoulder/.test(chatBlob)) {
      topicTags.push('injury');
    }
  }
  return topicTags;
}

function uniqueTopicList(topicTags) {
  const seen = new Set();
  const unique = [];
  for (let index = 0; index < topicTags.length; index += 1) {
    const tag = topicTags[index];
    if (seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    unique.push(tag);
  }
  return unique;
}

function calorieTargetFromUserData(userData) {
  if (!userData) {
    return null;
  }
  const calorieTargetRaw = Number(
    userData.calorieTarget || userData.dailyCalories || userData.targetCalories,
  );
  if (Number.isFinite(calorieTargetRaw)) {
    return calorieTargetRaw;
  }
  return null;
}

function proteinTargetFromUserData(userData) {
  if (!userData) {
    return null;
  }
  const proteinTargetRaw = Number(userData.proteinTarget || userData.targetProtein);
  if (Number.isFinite(proteinTargetRaw)) {
    return proteinTargetRaw;
  }
  return null;
}

function fitnessLevelFromUserData(userData) {
  if (!userData) {
    return undefined;
  }
  return userData.fitnessLevel || userData.trainingLevel;
}

function equipmentFromUserData(userData) {
  if (!userData) {
    return undefined;
  }
  return userData.equipment || userData.availableEquipment;
}

function injuriesFromUserData(userData) {
  if (!userData) {
    return undefined;
  }
  return userData.injuries || userData.injuryNotes;
}

function buildSpotlightContextFromUserLogs({ userData, sessions, dailyMetrics, nutritionToday } = {}) {
  let daysPerWeek;
  if (userData) {
    daysPerWeek = userData.daysPerWeek;
  }

  let metricsForContext = null;
  if (dailyMetrics) {
    metricsForContext = dailyMetrics;
  }

  let nutritionForContext = null;
  if (nutritionToday) {
    nutritionForContext = nutritionToday;
  }

  return {
    goal: wordsForPrimaryGoal(userData),
    fitnessLevel: fitnessLevelFromUserData(userData),
    daysPerWeek,
    calorieTarget: calorieTargetFromUserData(userData),
    proteinTarget: proteinTargetFromUserData(userData),
    equipment: equipmentFromUserData(userData),
    injuries: injuriesFromUserData(userData),
    dailyMetrics: metricsForContext,
    nutritionToday: nutritionForContext,
    topics: uniqueTopicList(topicTagsFromRecentChats(sessions)),
    trainer: userProfileIsTrainer(userData),
  };
}

function trainerAndSetupPrompts(spotlightContext) {
  const prompts = [];
  if (spotlightContext.trainer) {
    prompts.push('Which clients should I check in on today based on their recent logs?');
    prompts.push('Help me spot clients who have not logged food or workouts this week.');
  }
  if (spotlightContext.goal) {
    prompts.push(
      `My goal is ${spotlightContext.goal} — help me set calories, protein, and a training split that fits.`,
    );
    prompts.push(`Given my ${spotlightContext.goal} goal, what should I prioritize this week?`);
  }
  if (spotlightContext.fitnessLevel) {
    prompts.push(
      `I'm at a ${spotlightContext.fitnessLevel} level — adjust my training volume for this week.`,
    );
  }
  if (spotlightContext.daysPerWeek) {
    prompts.push(
      `I can train ${spotlightContext.daysPerWeek} days a week — build me a realistic plan.`,
    );
  }
  if (spotlightContext.equipment) {
    prompts.push(
      `With my equipment (${spotlightContext.equipment}), what workout should I run next?`,
    );
  }
  if (spotlightContext.injuries) {
    prompts.push(
      `I have ${spotlightContext.injuries} — what exercises should I avoid or modify?`,
    );
  }
  return prompts;
}

function sleepHoursFromMetrics(dailyMetrics) {
  if (!dailyMetrics) {
    return Number.NaN;
  }
  return Number(dailyMetrics.sleepHours);
}

function waterOuncesFromMetrics(dailyMetrics) {
  if (!dailyMetrics) {
    return Number.NaN;
  }
  return Number(dailyMetrics.waterIntake);
}

function sleepAndWaterPrompts(spotlightContext) {
  const prompts = [];
  const sleepHours = sleepHoursFromMetrics(spotlightContext.dailyMetrics);
  const hasLoggedSleep = Number.isFinite(sleepHours) && sleepHours > 0;

  // Low sleep → adjust training; missing sleep + a goal → sleep-improvement nudge.
  if (hasLoggedSleep && sleepHours < LOW_SLEEP_HOURS) {
    prompts.push(
      `I only logged ${sleepHours} hours of sleep — how should I adjust training today?`,
    );
  } else if (!sleepHours && spotlightContext.goal) {
    prompts.push(`Help me improve sleep so my ${spotlightContext.goal} progress does not stall.`);
  }

  const waterOunces = waterOuncesFromMetrics(spotlightContext.dailyMetrics);
  const hasLoggedWater = Number.isFinite(waterOunces) && waterOunces > 0;

  // Low water → catch-up help; no log yet → ask for a daily target.
  if (hasLoggedWater && waterOunces < LOW_WATER_OUNCES) {
    prompts.push(
      `I'm only at ${waterOunces}oz water today — help me catch up without overdoing it.`,
    );
  } else if (!waterOunces) {
    prompts.push('I have not logged water today — what should I aim for based on my goals?');
  }
  return prompts;
}

function caloriesEatenFromNutrition(nutritionToday) {
  if (!nutritionToday) {
    return Number.NaN;
  }
  return Number(nutritionToday.calories);
}

function proteinGramsFromNutrition(nutritionToday) {
  if (!nutritionToday) {
    return Number.NaN;
  }
  return Number(nutritionToday.protein);
}

function foodAndTopicPrompts(spotlightContext) {
  const prompts = [];
  const caloriesEaten = caloriesEatenFromNutrition(spotlightContext.nutritionToday);
  const proteinGrams = proteinGramsFromNutrition(spotlightContext.nutritionToday);
  const calorieTarget = spotlightContext.calorieTarget;
  const proteinTarget = spotlightContext.proteinTarget;
  const goalLabel = spotlightContext.goal;

  appendCaloriePromptLines(prompts, caloriesEaten, calorieTarget, goalLabel);
  appendProteinGapPrompt(prompts, proteinGrams, proteinTarget);
  appendWorkoutAndTopicPrompts(prompts, spotlightContext);
  return prompts;
}

function appendCaloriePromptLines(prompts, caloriesEaten, calorieTarget, goalLabel) {
  const hasCaloriesEaten = Number.isFinite(caloriesEaten);
  const hasCalorieTarget = Number.isFinite(calorieTarget) && calorieTarget > 0;

  if (hasCaloriesEaten && hasCalorieTarget) {
    const remainingCalories = Math.round(calorieTarget - caloriesEaten);
    if (remainingCalories > 0) {
      prompts.push(
        `I've eaten ${Math.round(caloriesEaten)} cal today — help me use my remaining ${remainingCalories} cal wisely.`,
      );
      return;
    }
    prompts.push(
      `I'm at ${Math.round(caloriesEaten)} cal today — am I still on track for ${goalLabel || 'my goal'}?`,
    );
    return;
  }

  if (hasCalorieTarget) {
    prompts.push(
      `I have not logged food today — help me plan meals toward my ${calorieTarget} cal target.`,
    );
  }
}

function appendProteinGapPrompt(prompts, proteinGrams, proteinTarget) {
  const hasProteinGrams = Number.isFinite(proteinGrams);
  const hasProteinTarget = Number.isFinite(proteinTarget) && proteinTarget > 0;
  if (!hasProteinGrams || !hasProteinTarget) return;

  const proteinIsLow = proteinGrams < proteinTarget * PROTEIN_GAP_FRACTION;
  if (!proteinIsLow) return;

  prompts.push(
    `I'm only at ${Math.round(proteinGrams)}g protein — help me close the gap to ${proteinTarget}g.`,
  );
}

function todayWorkoutNameFromMetrics(dailyMetrics) {
  if (!dailyMetrics) {
    return '';
  }
  if (!dailyMetrics.todayWorkout) {
    return '';
  }
  return dailyMetrics.todayWorkout.name || '';
}

function appendWorkoutAndTopicPrompts(prompts, spotlightContext) {
  const todayWorkoutName = todayWorkoutNameFromMetrics(spotlightContext.dailyMetrics);
  if (todayWorkoutName) {
    prompts.push(`Review my ${todayWorkoutName} workout and suggest what to do tomorrow.`);
  }
  if (!todayWorkoutName && spotlightContext.topics.includes('training')) {
    prompts.push('Based on our recent training chats, what should I focus on in my next session?');
  }
  if (spotlightContext.topics.includes('nutrition')) {
    prompts.push('Based on what I have been eating lately, what is the one nutrition tweak to make?');
  }
  if (spotlightContext.topics.includes('recovery')) {
    prompts.push('Based on my recent recovery and sleep, should I push hard or deload this week?');
  }
}

function nonEmptyUniquePromptLines(promptList) {
  const seen = new Set();
  const uniqueLines = [];
  for (let index = 0; index < promptList.length; index += 1) {
    const promptText = promptList[index];
    if (!promptText) {
      continue;
    }
    if (seen.has(promptText)) {
      continue;
    }
    seen.add(promptText);
    uniqueLines.push(promptText);
  }
  return uniqueLines;
}

function personalizedLinesFromContext(spotlightContext) {
  const prompts = [];
  const trainerLines = trainerAndSetupPrompts(spotlightContext);
  const sleepWaterLines = sleepAndWaterPrompts(spotlightContext);
  const foodTopicLines = foodAndTopicPrompts(spotlightContext);

  for (let index = 0; index < trainerLines.length; index += 1) {
    prompts.push(trainerLines[index]);
  }
  for (let index = 0; index < sleepWaterLines.length; index += 1) {
    prompts.push(sleepWaterLines[index]);
  }
  for (let index = 0; index < foodTopicLines.length; index += 1) {
    prompts.push(foodTopicLines[index]);
  }

  return nonEmptyUniquePromptLines(prompts);
}

function rotatePromptListForHour(promptPool, hourSlot, daySeed, limit = SPOTLIGHT_LIMIT) {
  const uniquePrompts = nonEmptyUniquePromptLines(promptPool || []);
  if (!uniquePrompts.length) {
    return [];
  }

  const rotatedPrompts = [];
  for (let index = 0; index < uniquePrompts.length; index += 1) {
    const rotatedIndex = (hourSlot + daySeed + index) % uniquePrompts.length;
    rotatedPrompts.push(uniquePrompts[rotatedIndex]);
  }
  return rotatedPrompts.slice(0, limit);
}

function topicListFromCategoryContext(categoryContext) {
  if (!categoryContext) {
    return [];
  }
  if (!categoryContext.topics) {
    return [];
  }
  return categoryContext.topics;
}

function topicListIncludes(topicList, topicName) {
  return topicList.includes(topicName);
}

function buildContextualTrainPrompts(categoryContext) {
  const prompts = [];
  const topicList = topicListFromCategoryContext(categoryContext);
  if (topicListIncludes(topicList, 'hypertrophy')) {
    prompts.push('How should I adjust volume if hypertrophy is my main goal?');
  }
  if (topicListIncludes(topicList, 'squat')) {
    prompts.push('My squat feels stuck — what should I change this week?');
  }
  return prompts;
}

function buildContextualFuelPrompts(categoryContext) {
  const prompts = [];
  const topicList = topicListFromCategoryContext(categoryContext);
  if (topicListIncludes(topicList, 'protein')) {
    prompts.push('Am I on track with protein today based on my logs?');
  }
  if (topicListIncludes(topicList, 'meal')) {
    prompts.push('Help me plan meals for the rest of today');
  }
  return prompts;
}

function buildContextualRecoverPrompts(categoryContext) {
  const prompts = [];
  const topicList = topicListFromCategoryContext(categoryContext);
  if (topicListIncludes(topicList, 'sleep')) {
    prompts.push('Based on my recent sleep, what should I change tonight?');
  }
  return prompts;
}

function buildContextualWebPrompts(categoryContext) {
  const prompts = [];
  const topicList = topicListFromCategoryContext(categoryContext);
  if (topicListIncludes(topicList, 'creatine')) {
    prompts.push('Search the web: creatine timing and dosing for lifters');
  }
  if (topicListIncludes(topicList, 'protein')) {
    prompts.push('Search the web: protein distribution across the day');
  }
  return prompts;
}

function topicTagsForCategoryContext(sessions, goalText) {
  const topicTags = [];
  if (/muscle|hypertrophy|gain/.test(goalText)) {
    topicTags.push('hypertrophy');
  }
  if (/fat|loss|cut/.test(goalText)) {
    topicTags.push('fat_loss');
  }

  const sessionList = sessionListOrEmpty(sessions);
  const newestSessions = sessionList.slice(0, RECENT_SESSION_LOOKBACK);

  for (let index = 0; index < newestSessions.length; index += 1) {
    const session = newestSessions[index];
    const chatBlob = `${session.lastUserMessage || ''} ${session.title || ''}`.toLowerCase();
    if (/protein|macro|meal|eat|calorie/.test(chatBlob)) {
      topicTags.push('protein', 'meal');
    }
    if (/sleep|recover|rest/.test(chatBlob)) {
      topicTags.push('sleep');
    }
    if (/squat|bench|deadlift|lift/.test(chatBlob)) {
      topicTags.push('squat');
    }
    if (/creatine|supplement/.test(chatBlob)) {
      topicTags.push('creatine');
    }
  }
  return uniqueTopicList(topicTags);
}

function goalTextFromUserData(userData) {
  if (!userData) {
    return '';
  }
  const rawGoal = userData.primaryGoal || userData.goal || '';
  return String(rawGoal).toLowerCase();
}

function buildCategoryHourContext({ userData, sessions } = {}) {
  const goalText = goalTextFromUserData(userData);
  return { topics: topicTagsForCategoryContext(sessions, goalText) };
}

function starterPoolForCategory(categoryId, categoryContext) {
  if (categoryId === 'train') {
    return mergeUniquePromptLines(TRAIN_PROMPTS, buildContextualTrainPrompts(categoryContext));
  }
  if (categoryId === 'fuel') {
    return mergeUniquePromptLines(FUEL_PROMPTS, buildContextualFuelPrompts(categoryContext));
  }
  if (categoryId === 'recover') {
    return mergeUniquePromptLines(RECOVER_PROMPTS, buildContextualRecoverPrompts(categoryContext));
  }
  if (categoryId === 'web') {
    return mergeUniquePromptLines(WEB_PROMPTS, buildContextualWebPrompts(categoryContext));
  }
  if (categoryId === 'log' || categoryId === 'tools') return LOG_PROMPTS;
  if (categoryId === 'data') return DATA_PROMPTS;
  if (categoryId === 'photo') return PHOTO_PROMPTS;
  return TRAIN_PROMPTS;
}

function keepNonEmptyPromptPicks(picks) {
  const kept = [];
  for (let index = 0; index < picks.length; index += 1) {
    if (picks[index]) {
      kept.push(picks[index]);
    }
  }
  return kept;
}

function onePickPerCoreCategory(userData, sessions, now) {
  const picks = [
    pickCategoryPrompt('train', { userData, sessions, now }),
    pickCategoryPrompt('fuel', { userData, sessions, now }),
    pickCategoryPrompt('recover', { userData, sessions, now }),
    pickCategoryPrompt('web', { userData, sessions, now }),
  ];
  return keepNonEmptyPromptPicks(picks);
}

function canHelpCardsForThisHour({ userData, sessions, now }) {
  const cards = [];
  for (let index = 0; index < CAN_HELP_WITH_ITEMS.length; index += 1) {
    const item = CAN_HELP_WITH_ITEMS[index];
    const categoryId = CAN_HELP_CATEGORY_MAP[item.id];
    if (!categoryId) {
      cards.push(item);
      continue;
    }
    const hourlyPrompt = pickCategoryPrompt(categoryId, { userData, sessions, now }) || item.prompt;
    cards.push({ ...item, prompt: hourlyPrompt });
  }
  return cards;
}

function rotateCardListFromHourSlot(items, hourSlot) {
  const startIndex = hourSlot % items.length;
  const rotatedCards = [];
  for (let index = 0; index < items.length; index += 1) {
    const rotatedIndex = (startIndex + index) % items.length;
    rotatedCards.push(items[rotatedIndex]);
  }
  return rotatedCards;
}

function coachActionsWithHourlyStarters(actions, { userData, sessions, now }) {
  const readyActions = [];
  const actionList = actions || [];
  for (let index = 0; index < actionList.length; index += 1) {
    const action = actionList[index];
    const categoryId = COACH_ACTION_CATEGORY_MAP[action.id];
    if (!categoryId) {
      readyActions.push(action);
      continue;
    }
    const hourlyStarter =
      pickCategoryPrompt(categoryId, { userData, sessions, now }) || action.starter;
    readyActions.push({ ...action, starter: hourlyStarter });
  }
  return readyActions;
}

// ===== MAIN FUNCTION =====

/**
 * Whole hours since the Unix epoch. Two calls in the same hour return the same slot.
 * vocab: Date.now() is milliseconds; dividing by MS_PER_HOUR floors to the current hour index.
 * @param {number} [now]
 * @returns {number}
 */
export function getCoachHourSlot(now = Date.now()) {
  return Math.floor(now / MS_PER_HOUR);
}

/**
 * One starter question for a home-screen category this hour.
 * Flow: 1. topics from recent chats  2. pick that category's pool  3. one line from the hour slot
 * @param {string} categoryId
 * @param {{ userData?: object, sessions?: Array, now?: number }} [options]
 * @returns {string}
 */
export function pickCategoryPrompt(categoryId, { userData, sessions, now = Date.now() } = {}) {
  // 1. Recent chat topics (protein, squat, sleep) so the pool can add a matching line.
  const categoryContext = buildCategoryHourContext({ userData, sessions });
  const hourSlot = getCoachHourSlot(now);

  // 2. Category pool, plus any extra lines those topics unlocked.
  const promptPool = starterPoolForCategory(categoryId, categoryContext);

  // 3. Offset so "train" and "fuel" do not land on the same index this hour.
  // vocab/symbol: || = missing category id gets offset 0
  const categoryOffset = CATEGORY_OFFSET[categoryId] || 0;
  return pickOnePromptByHourSlot(promptPool, hourSlot + categoryOffset, categoryId);
}

/**
 * Spotlight chips under the composer. Personalized lines first, then the hourly category picks.
 * Flow: 1. logs → personal lines  2. one pick per category  3. merge and rotate
 * @param {{ userData?: object, sessions?: Array, dailyMetrics?: object, nutritionToday?: object, now?: number }} [options]
 * @returns {string[]}
 */
export function buildHourlySpotlightSuggestions({
  userData,
  sessions,
  dailyMetrics,
  nutritionToday,
  now = Date.now(),
} = {}) {
  const hourSlot = getCoachHourSlot(now);
  const daySeed = calendarDayIndexFromNow(now);

  // 1. Sleep, water, calories, and trainer lines built from this user's logs.
  const spotlightContext = buildSpotlightContextFromUserLogs({
    userData,
    sessions,
    dailyMetrics,
    nutritionToday,
  });
  const personalizedLines = personalizedLinesFromContext(spotlightContext);

  // 2. One hourly pick each from train / fuel / recover / web.
  const hourlyCategoryPicks = onePickPerCoreCategory(userData, sessions, now);

  // 3. Personal lines win when they collide with a generic pick; then rotate for this hour.
  const combinedLines = mergeUniquePromptLines(personalizedLines, hourlyCategoryPicks);
  return rotatePromptListForHour(combinedLines, hourSlot, daySeed, SPOTLIGHT_LIMIT);
}

/**
 * "Can help with" cards, rotated so a different card leads each hour.
 * @param {{ userData?: object, sessions?: Array, now?: number }} [options]
 * @returns {Array}
 */
export function buildHourlyCanHelpWith({ userData, sessions, now = Date.now() } = {}) {
  const hourSlot = getCoachHourSlot(now);
  const cardsForHour = canHelpCardsForThisHour({ userData, sessions, now });
  return rotateCardListFromHourSlot(cardsForHour, hourSlot);
}

/**
 * Hourly-rotating starters for the "What do you need?" action orbs.
 * Photo opens the camera — its starter is unused.
 * @param {Array} [actions]
 * @param {{ userData?: object, sessions?: Array, now?: number }} [options]
 * @returns {Array}
 */
export function buildHourlyCoachActions(
  actions = [],
  { userData, sessions, now = Date.now() } = {},
) {
  return coachActionsWithHourlyStarters(actions, { userData, sessions, now });
}
