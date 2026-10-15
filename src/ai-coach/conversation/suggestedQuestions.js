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

const CAN_HELP_CATEGORY_MAP = {
  tools: 'log',
  web: 'web',
  data: 'data',
  photo: 'photo',
  train: 'train',
  recover: 'recover',
};

const COACH_ACTION_CATEGORY_MAP = {
  log: 'log',
  web: 'web',
  data: 'data',
};

export const CAN_HELP_WITH_ITEMS = [
  {
    id: 'tools',
    title: 'Log sleep, water, steps, or mood',
    subtitle: 'Dashboard tools with one tap',
    icon: 'create-outline',
    accent: '#FF6B9D',
    rim: ['#FF6B9D', '#C084FC'],
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
    accent: '#C084FC',
    rim: ['#A78BFA', '#C084FC'],
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
    rim: ['#FF6B9D', '#DB2777'],
    prompt: 'Help me adjust my training plan',
  },
  {
    id: 'recover',
    title: 'Tighten up recovery',
    subtitle: 'Sleep, rest days, and stress',
    icon: 'moon-outline',
    accent: '#34D399',
    rim: ['#10B981', '#6EE7B7'],
    prompt: 'Help me improve my recovery this week',
  },
];

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
  const ctx = buildCoachContext({ userData, sessions });
  const hourSlot = getCoachHourSlot(now);

  // 2. Category pool, plus any extra lines those topics unlocked.
  const pool = promptPoolForCategory(categoryId, ctx);

  // 3. Offset so "train" and "fuel" do not land on the same index this hour.
  const offset = CATEGORY_OFFSET[categoryId] || 0;
  return pickFromPool(pool, hourSlot + offset, categoryId);
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
  const daySeed = getDaySeed(now);

  // 1. Sleep, water, calories, and trainer lines built from this user's logs.
  const ctx = buildRichCoachContext({ userData, sessions, dailyMetrics, nutritionToday });
  const personalized = buildPersonalizedPromptPool(ctx);

  // 2. One hourly pick each from train / fuel / recover / web.
  const hourlyPicks = hourlyCategoryPicks(userData, sessions, now);

  // 3. Personal lines win when they collide with a generic pick; then rotate for this hour.
  const combined = mergePromptPool(personalized, hourlyPicks);
  return rotatePool(combined, hourSlot, daySeed, SPOTLIGHT_LIMIT);
}

/**
 * "Can help with" cards, rotated so a different card leads each hour.
 * @param {{ userData?: object, sessions?: Array, now?: number }} [options]
 * @returns {Array}
 */
export function buildHourlyCanHelpWith({ userData, sessions, now = Date.now() } = {}) {
  const hourSlot = getCoachHourSlot(now);
  const items = canHelpItemsForHour({ userData, sessions, now });
  return rotateItemsFromHour(items, hourSlot);
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
  return actionsWithHourlyStarters(actions, { userData, sessions, now });
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function getDaySeed(now = Date.now()) {
  return Math.floor(now / MS_PER_DAY);
}

function pickFromPool(pool, hourSlot, salt = '') {
  const list = (pool || []).filter(Boolean);
  if (!list.length) return '';
  const daySeed = getDaySeed(hourSlot * MS_PER_HOUR);
  const poolIndex = Math.abs(
    (hourSlot * POOL_HOUR_WEIGHT + daySeed * POOL_DAY_WEIGHT + salt.length * POOL_SALT_WEIGHT) %
      list.length,
  );
  return list[poolIndex];
}

function mergePromptPool(base, contextual) {
  const seen = new Set();
  const merged = [];
  for (const item of [...(contextual || []), ...(base || [])]) {
    const promptText = String(item || '').trim();
    if (!promptText || seen.has(promptText)) continue;
    seen.add(promptText);
    merged.push(promptText);
  }
  return merged;
}

function goalLabel(userData) {
  if (userData?.primaryGoal) return String(userData.primaryGoal).replace(/_/g, ' ').trim();
  if (userData?.goal) return String(userData.goal).replace(/_/g, ' ').trim();
  if (Array.isArray(userData?.goals) && userData.goals[0]) {
    return String(userData.goals[0]).replace(/_/g, ' ').trim();
  }
  return '';
}

function isTrainer(userData) {
  return String(userData?.role || '').toLowerCase() === 'trainer';
}

function topicTagsFromSessions(sessions) {
  const topics = [];
  const sessionList = Array.isArray(sessions) ? sessions : [];
  const newestSessions = sessionList.slice(0, RECENT_SESSION_LOOKBACK);
  for (const session of newestSessions) {
    const blob = `${session.lastUserMessage || ''} ${session.title || ''}`.toLowerCase();
    if (/protein|macro|meal|eat|calorie|food/.test(blob)) topics.push('nutrition');
    if (/sleep|recover|rest|sore/.test(blob)) topics.push('recovery');
    if (/squat|bench|deadlift|workout|lift|train/.test(blob)) topics.push('training');
    if (/injur|pain|knee|shoulder/.test(blob)) topics.push('injury');
  }
  return topics;
}

function buildRichCoachContext({ userData, sessions, dailyMetrics, nutritionToday } = {}) {
  const calorieTarget = Number(userData?.calorieTarget || userData?.dailyCalories || userData?.targetCalories);
  const proteinTarget = Number(userData?.proteinTarget || userData?.targetProtein);
  return {
    goal: goalLabel(userData),
    fitnessLevel: userData?.fitnessLevel || userData?.trainingLevel,
    daysPerWeek: userData?.daysPerWeek,
    calorieTarget: Number.isFinite(calorieTarget) ? calorieTarget : null,
    proteinTarget: Number.isFinite(proteinTarget) ? proteinTarget : null,
    equipment: userData?.equipment || userData?.availableEquipment,
    injuries: userData?.injuries || userData?.injuryNotes,
    dailyMetrics: dailyMetrics || null,
    nutritionToday: nutritionToday || null,
    topics: [...new Set(topicTagsFromSessions(sessions))],
    trainer: isTrainer(userData),
  };
}

function trainerAndSetupPrompts(ctx) {
  const prompts = [];
  if (ctx.trainer) {
    prompts.push('Which clients should I check in on today based on their recent logs?');
    prompts.push('Help me spot clients who have not logged food or workouts this week.');
  }
  if (ctx.goal) {
    prompts.push(`My goal is ${ctx.goal} — help me set calories, protein, and a training split that fits.`);
    prompts.push(`Given my ${ctx.goal} goal, what should I prioritize this week?`);
  }
  if (ctx.fitnessLevel) {
    prompts.push(`I'm at a ${ctx.fitnessLevel} level — adjust my training volume for this week.`);
  }
  if (ctx.daysPerWeek) {
    prompts.push(`I can train ${ctx.daysPerWeek} days a week — build me a realistic plan.`);
  }
  if (ctx.equipment) {
    prompts.push(`With my equipment (${ctx.equipment}), what workout should I run next?`);
  }
  if (ctx.injuries) {
    prompts.push(`I have ${ctx.injuries} — what exercises should I avoid or modify?`);
  }
  return prompts;
}

function sleepAndWaterPrompts(ctx) {
  const prompts = [];
  const sleepHours = Number(ctx.dailyMetrics?.sleepHours);
  if (Number.isFinite(sleepHours) && sleepHours > 0 && sleepHours < LOW_SLEEP_HOURS) {
    prompts.push(`I only logged ${sleepHours} hours of sleep — how should I adjust training today?`);
  } else if (!sleepHours && ctx.goal) {
    prompts.push(`Help me improve sleep so my ${ctx.goal} progress does not stall.`);
  }

  const waterOunces = Number(ctx.dailyMetrics?.waterIntake);
  if (Number.isFinite(waterOunces) && waterOunces > 0 && waterOunces < LOW_WATER_OUNCES) {
    prompts.push(`I'm only at ${waterOunces}oz water today — help me catch up without overdoing it.`);
  } else if (!waterOunces) {
    prompts.push('I have not logged water today — what should I aim for based on my goals?');
  }
  return prompts;
}

function foodAndTopicPrompts(ctx) {
  const prompts = [];
  const caloriesEaten = Number(ctx.nutritionToday?.calories);
  const proteinGrams = Number(ctx.nutritionToday?.protein);
  const calorieTarget = ctx.calorieTarget;
  const proteinTarget = ctx.proteinTarget;
  const goal = ctx.goal;

  if (Number.isFinite(caloriesEaten) && Number.isFinite(calorieTarget) && calorieTarget > 0) {
    const remainingCalories = Math.round(calorieTarget - caloriesEaten);
    if (remainingCalories > 0) {
      prompts.push(
        `I've eaten ${Math.round(caloriesEaten)} cal today — help me use my remaining ${remainingCalories} cal wisely.`,
      );
    } else {
      prompts.push(
        `I'm at ${Math.round(caloriesEaten)} cal today — am I still on track for ${goal || 'my goal'}?`,
      );
    }
  } else if (Number.isFinite(calorieTarget) && calorieTarget > 0) {
    prompts.push(`I have not logged food today — help me plan meals toward my ${calorieTarget} cal target.`);
  }

  if (
    Number.isFinite(proteinGrams) &&
    Number.isFinite(proteinTarget) &&
    proteinTarget > 0 &&
    proteinGrams < proteinTarget * PROTEIN_GAP_FRACTION
  ) {
    prompts.push(`I'm only at ${Math.round(proteinGrams)}g protein — help me close the gap to ${proteinTarget}g.`);
  }

  if (ctx.dailyMetrics?.todayWorkout?.name) {
    prompts.push(`Review my ${ctx.dailyMetrics.todayWorkout.name} workout and suggest what to do tomorrow.`);
  } else if (ctx.topics.includes('training')) {
    prompts.push('Based on our recent training chats, what should I focus on in my next session?');
  }

  if (ctx.topics.includes('nutrition')) {
    prompts.push('Based on what I have been eating lately, what is the one nutrition tweak to make?');
  }

  if (ctx.topics.includes('recovery')) {
    prompts.push('Based on my recent recovery and sleep, should I push hard or deload this week?');
  }
  return prompts;
}

function buildPersonalizedPromptPool(ctx) {
  const prompts = [
    ...trainerAndSetupPrompts(ctx),
    ...sleepAndWaterPrompts(ctx),
    ...foodAndTopicPrompts(ctx),
  ];
  return [...new Set(prompts.filter(Boolean))];
}

function rotatePool(pool, hourSlot, daySeed, limit = SPOTLIGHT_LIMIT) {
  const list = [...new Set((pool || []).filter(Boolean))];
  if (!list.length) return [];
  const rotated = [];
  for (let i = 0; i < list.length; i += 1) {
    rotated.push(list[(hourSlot + daySeed + i) % list.length]);
  }
  return rotated.slice(0, limit);
}

function buildContextualTrainPrompts(ctx) {
  const prompts = [];
  if (ctx.topics?.includes('hypertrophy')) prompts.push('How should I adjust volume if hypertrophy is my main goal?');
  if (ctx.topics?.includes('squat')) prompts.push('My squat feels stuck — what should I change this week?');
  return prompts;
}

function buildContextualFuelPrompts(ctx) {
  const prompts = [];
  if (ctx.topics?.includes('protein')) prompts.push('Am I on track with protein today based on my logs?');
  if (ctx.topics?.includes('meal')) prompts.push('Help me plan meals for the rest of today');
  return prompts;
}

function buildContextualRecoverPrompts(ctx) {
  const prompts = [];
  if (ctx.topics?.includes('sleep')) prompts.push('Based on my recent sleep, what should I change tonight?');
  return prompts;
}

function buildContextualWebPrompts(ctx) {
  const prompts = [];
  if (ctx.topics?.includes('creatine')) prompts.push('Search the web: creatine timing and dosing for lifters');
  if (ctx.topics?.includes('protein')) prompts.push('Search the web: protein distribution across the day');
  return prompts;
}

function topicTagsForCategoryContext(sessions, goal) {
  const topics = [];
  if (/muscle|hypertrophy|gain/.test(goal)) topics.push('hypertrophy');
  if (/fat|loss|cut/.test(goal)) topics.push('fat_loss');

  const sessionList = Array.isArray(sessions) ? sessions : [];
  const newestSessions = sessionList.slice(0, RECENT_SESSION_LOOKBACK);
  for (const session of newestSessions) {
    const blob = `${session.lastUserMessage || ''} ${session.title || ''}`.toLowerCase();
    if (/protein|macro|meal|eat|calorie/.test(blob)) topics.push('protein', 'meal');
    if (/sleep|recover|rest/.test(blob)) topics.push('sleep');
    if (/squat|bench|deadlift|lift/.test(blob)) topics.push('squat');
    if (/creatine|supplement/.test(blob)) topics.push('creatine');
  }
  return [...new Set(topics)];
}

function buildCoachContext({ userData, sessions } = {}) {
  const goal = String(userData?.primaryGoal || userData?.goal || '').toLowerCase();
  return { topics: topicTagsForCategoryContext(sessions, goal) };
}

function promptPoolForCategory(categoryId, ctx) {
  const pools = {
    train: mergePromptPool(TRAIN_PROMPTS, buildContextualTrainPrompts(ctx)),
    fuel: mergePromptPool(FUEL_PROMPTS, buildContextualFuelPrompts(ctx)),
    recover: mergePromptPool(RECOVER_PROMPTS, buildContextualRecoverPrompts(ctx)),
    web: mergePromptPool(WEB_PROMPTS, buildContextualWebPrompts(ctx)),
    log: LOG_PROMPTS,
    tools: LOG_PROMPTS,
    data: DATA_PROMPTS,
    photo: PHOTO_PROMPTS,
  };
  return pools[categoryId] || TRAIN_PROMPTS;
}

function hourlyCategoryPicks(userData, sessions, now) {
  const picks = [
    pickCategoryPrompt('train', { userData, sessions, now }),
    pickCategoryPrompt('fuel', { userData, sessions, now }),
    pickCategoryPrompt('recover', { userData, sessions, now }),
    pickCategoryPrompt('web', { userData, sessions, now }),
  ];
  return picks.filter(Boolean);
}

function canHelpItemsForHour({ userData, sessions, now }) {
  const items = [];
  for (const item of CAN_HELP_WITH_ITEMS) {
    const categoryId = CAN_HELP_CATEGORY_MAP[item.id];
    if (!categoryId) {
      items.push(item);
      continue;
    }
    const prompt = pickCategoryPrompt(categoryId, { userData, sessions, now }) || item.prompt;
    items.push({ ...item, prompt });
  }
  return items;
}

function rotateItemsFromHour(items, hourSlot) {
  const start = hourSlot % items.length;
  const rotated = [];
  for (let i = 0; i < items.length; i += 1) {
    rotated.push(items[(start + i) % items.length]);
  }
  return rotated;
}

function actionsWithHourlyStarters(actions, { userData, sessions, now }) {
  const ready = [];
  for (const action of actions || []) {
    const categoryId = COACH_ACTION_CATEGORY_MAP[action.id];
    if (!categoryId) {
      ready.push(action);
      continue;
    }
    const starter = pickCategoryPrompt(categoryId, { userData, sessions, now }) || action.starter;
    ready.push({ ...action, starter });
  }
  return ready;
}
