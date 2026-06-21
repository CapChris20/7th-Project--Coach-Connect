/**
 * coach Category Prompts
 *
 * Purpose: coach Category Prompts — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: getCoachHourSlot, pickCategoryPrompt, buildHourlySpotlightSuggestions, buildHourlyCanHelpWith, CAN_HELP_WITH_ITEMS
 *
 * @file-header
 */
/**
 * Hourly-rotating AI Coach prompts + capability carousel copy.
 * Pools refresh every hour; daily reshuffle reduces repetition.
 */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const CATEGORY_OFFSET = { train: 0, fuel: 11, recover: 23, web: 37 };

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

export function getCoachHourSlot(now = Date.now()) {
  return Math.floor(now / MS_PER_HOUR);
}

function getDaySeed(now = Date.now()) {
  return Math.floor(now / MS_PER_DAY);
}

function pickFromPool(pool, hourSlot, salt = '') {
  const list = (pool || []).filter(Boolean);
  if (!list.length) return '';
  const daySeed = getDaySeed(hourSlot * MS_PER_HOUR);
  const idx = Math.abs((hourSlot * 17 + daySeed * 31 + salt.length * 13) % list.length);
  return list[idx];
}

function mergePromptPool(base, contextual) {
  const seen = new Set();
  const out = [];
  for (const item of [...(contextual || []), ...(base || [])]) {
    const s = String(item || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function goalLabel(userData) {
  const raw =
    userData?.primaryGoal ||
    userData?.goal ||
    (Array.isArray(userData?.goals) ? userData.goals[0] : '') ||
    '';
  return String(raw).replace(/_/g, ' ').trim();
}

function isTrainer(userData) {
  return String(userData?.role || '').toLowerCase() === 'trainer';
}

function buildRichCoachContext({ userData, sessions, dailyMetrics, nutritionToday } = {}) {
  const goal = goalLabel(userData);
  const fitnessLevel = userData?.fitnessLevel || userData?.trainingLevel;
  const daysPerWeek = userData?.daysPerWeek;
  const calorieTarget = Number(userData?.calorieTarget || userData?.dailyCalories || userData?.targetCalories);
  const proteinTarget = Number(userData?.proteinTarget || userData?.targetProtein);
  const topics = [];

  for (const s of (sessions || []).slice(0, 12)) {
    const blob = `${s.lastUserMessage || ''} ${s.title || ''}`.toLowerCase();
    if (/protein|macro|meal|eat|calorie|food/.test(blob)) topics.push('nutrition');
    if (/sleep|recover|rest|sore/.test(blob)) topics.push('recovery');
    if (/squat|bench|deadlift|workout|lift|train/.test(blob)) topics.push('training');
    if (/injur|pain|knee|shoulder/.test(blob)) topics.push('injury');
  }

  return {
    goal,
    fitnessLevel,
    daysPerWeek,
    calorieTarget: Number.isFinite(calorieTarget) ? calorieTarget : null,
    proteinTarget: Number.isFinite(proteinTarget) ? proteinTarget : null,
    equipment: userData?.equipment || userData?.availableEquipment,
    injuries: userData?.injuries || userData?.injuryNotes,
    dailyMetrics: dailyMetrics || null,
    nutritionToday: nutritionToday || null,
    topics: [...new Set(topics)],
    trainer: isTrainer(userData),
  };
}

function buildPersonalizedPromptPool(ctx) {
  const out = [];
  const { goal, fitnessLevel, daysPerWeek, calorieTarget, proteinTarget, dailyMetrics, nutritionToday, topics, trainer } =
    ctx;

  if (trainer) {
    out.push('Which clients should I check in on today based on their recent logs?');
    out.push('Help me spot clients who have not logged food or workouts this week.');
  }

  if (goal) {
    out.push(`My goal is ${goal} — help me set calories, protein, and a training split that fits.`);
    out.push(`Given my ${goal} goal, what should I prioritize this week?`);
  }

  if (fitnessLevel) {
    out.push(`I'm at a ${fitnessLevel} level — adjust my training volume for this week.`);
  }

  if (daysPerWeek) {
    out.push(`I can train ${daysPerWeek} days a week — build me a realistic plan.`);
  }

  if (ctx.equipment) {
    out.push(`With my equipment (${ctx.equipment}), what workout should I run next?`);
  }

  if (ctx.injuries) {
    out.push(`I have ${ctx.injuries} — what exercises should I avoid or modify?`);
  }

  const sleepHours = Number(dailyMetrics?.sleepHours);
  if (Number.isFinite(sleepHours) && sleepHours > 0 && sleepHours < 6.5) {
    out.push(`I only logged ${sleepHours} hours of sleep — how should I adjust training today?`);
  } else if (!sleepHours && goal) {
    out.push(`Help me improve sleep so my ${goal} progress does not stall.`);
  }

  const water = Number(dailyMetrics?.waterIntake);
  if (Number.isFinite(water) && water > 0 && water < 48) {
    out.push(`I'm only at ${water}oz water today — help me catch up without overdoing it.`);
  } else if (!water) {
    out.push('I have not logged water today — what should I aim for based on my goals?');
  }

  const cals = Number(nutritionToday?.calories);
  const protein = Number(nutritionToday?.protein);
  if (Number.isFinite(cals) && Number.isFinite(calorieTarget) && calorieTarget > 0) {
    const remaining = Math.round(calorieTarget - cals);
    out.push(
      remaining > 0
        ? `I've eaten ${Math.round(cals)} cal today — help me use my remaining ${remaining} cal wisely.`
        : `I'm at ${Math.round(cals)} cal today — am I still on track for ${goal || 'my goal'}?`,
    );
  } else if (Number.isFinite(calorieTarget) && calorieTarget > 0) {
    out.push(`I have not logged food today — help me plan meals toward my ${calorieTarget} cal target.`);
  }

  if (Number.isFinite(protein) && Number.isFinite(proteinTarget) && proteinTarget > 0 && protein < proteinTarget * 0.6) {
    out.push(`I'm only at ${Math.round(protein)}g protein — help me close the gap to ${proteinTarget}g.`);
  }

  if (dailyMetrics?.todayWorkout?.name) {
    out.push(`Review my ${dailyMetrics.todayWorkout.name} workout and suggest what to do tomorrow.`);
  } else if (topics.includes('training')) {
    out.push('Based on our recent training chats, what should I focus on in my next session?');
  }

  if (topics.includes('nutrition')) {
    out.push('Based on what I have been eating lately, what is the one nutrition tweak to make?');
  }

  if (topics.includes('recovery')) {
    out.push('Based on my recent recovery and sleep, should I push hard or deload this week?');
  }

  return [...new Set(out.filter(Boolean))];
}

function rotatePool(pool, hourSlot, daySeed, limit = 8) {
  const list = [...new Set((pool || []).filter(Boolean))];
  if (!list.length) return [];
  const rotated = [];
  for (let i = 0; i < list.length; i += 1) {
    rotated.push(list[(hourSlot + daySeed + i) % list.length]);
  }
  return rotated.slice(0, limit);
}

function buildContextualTrainPrompts(ctx) {
  const out = [];
  if (ctx.topics?.includes('hypertrophy')) out.push('How should I adjust volume if hypertrophy is my main goal?');
  if (ctx.topics?.includes('squat')) out.push('My squat feels stuck — what should I change this week?');
  return out;
}

function buildContextualFuelPrompts(ctx) {
  const out = [];
  if (ctx.topics?.includes('protein')) out.push('Am I on track with protein today based on my logs?');
  if (ctx.topics?.includes('meal')) out.push('Help me plan meals for the rest of today');
  return out;
}

function buildContextualRecoverPrompts(ctx) {
  const out = [];
  if (ctx.topics?.includes('sleep')) out.push('Based on my recent sleep, what should I change tonight?');
  return out;
}

function buildContextualWebPrompts(ctx) {
  const out = [];
  if (ctx.topics?.includes('creatine')) out.push('Search the web: creatine timing and dosing for lifters');
  if (ctx.topics?.includes('protein')) out.push('Search the web: protein distribution across the day');
  return out;
}

function buildCoachContext({ userData, sessions } = {}) {
  const topics = [];
  const goal = String(userData?.primaryGoal || userData?.goal || '').toLowerCase();
  if (/muscle|hypertrophy|gain/.test(goal)) topics.push('hypertrophy');
  if (/fat|loss|cut/.test(goal)) topics.push('fat_loss');

  for (const s of (sessions || []).slice(0, 12)) {
    const blob = `${s.lastUserMessage || ''} ${s.title || ''}`.toLowerCase();
    if (/protein|macro|meal|eat|calorie/.test(blob)) topics.push('protein', 'meal');
    if (/sleep|recover|rest/.test(blob)) topics.push('sleep');
    if (/squat|bench|deadlift|lift/.test(blob)) topics.push('squat');
    if (/creatine|supplement/.test(blob)) topics.push('creatine');
  }
  return { topics: [...new Set(topics)] };
}

export function pickCategoryPrompt(categoryId, { userData, sessions, now = Date.now() } = {}) {
  const ctx = buildCoachContext({ userData, sessions });
  const hourSlot = getCoachHourSlot(now);
  const pools = {
    train: mergePromptPool(TRAIN_PROMPTS, buildContextualTrainPrompts(ctx)),
    fuel: mergePromptPool(FUEL_PROMPTS, buildContextualFuelPrompts(ctx)),
    recover: mergePromptPool(RECOVER_PROMPTS, buildContextualRecoverPrompts(ctx)),
    web: mergePromptPool(WEB_PROMPTS, buildContextualWebPrompts(ctx)),
  };
  const pool = pools[categoryId] || TRAIN_PROMPTS;
  const offset = CATEGORY_OFFSET[categoryId] || 0;
  return pickFromPool(pool, hourSlot + offset, categoryId);
}

export function buildHourlySpotlightSuggestions({
  userData,
  sessions,
  dailyMetrics,
  nutritionToday,
  now = Date.now(),
} = {}) {
  const hourSlot = getCoachHourSlot(now);
  const daySeed = getDaySeed(now);
  const ctx = buildRichCoachContext({ userData, sessions, dailyMetrics, nutritionToday });
  const personalized = buildPersonalizedPromptPool(ctx);

  if (personalized.length >= 4) {
    return rotatePool(personalized, hourSlot, daySeed, 8);
  }

  const fallback = [
    ...personalized,
    pickCategoryPrompt('train', { userData, sessions, now }),
    pickCategoryPrompt('fuel', { userData, sessions, now }),
    pickCategoryPrompt('recover', { userData, sessions, now }),
    pickCategoryPrompt('web', { userData, sessions, now }),
  ];
  return rotatePool(fallback, hourSlot, daySeed, 8);
}

export function buildHourlyCanHelpWith({ now = Date.now() } = {}) {
  const hourSlot = getCoachHourSlot(now);
  const items = [...CAN_HELP_WITH_ITEMS];
  const start = hourSlot % items.length;
  const rotated = [];
  for (let i = 0; i < items.length; i += 1) {
    rotated.push(items[(start + i) % items.length]);
  }
  return rotated;
}
