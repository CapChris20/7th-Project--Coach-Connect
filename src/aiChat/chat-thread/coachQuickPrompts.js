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
    title: 'Search the web with sources',
    subtitle: 'Research, products, and current facts',
    icon: 'globe-outline',
    accent: '#64D2FF',
    rim: ['#06B6D4', '#3B82F6'],
    prompt: 'Can you search the web for me?',
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

export function buildHourlySpotlightSuggestions({ userData, sessions, now = Date.now() } = {}) {
  const hourSlot = getCoachHourSlot(now);
  const daySeed = getDaySeed(now);
  const categories = ['train', 'fuel', 'recover', 'web'];
  const picks = categories.map((cat, i) => {
    const offset = CATEGORY_OFFSET[cat] || 0;
    const idx = (hourSlot + offset + daySeed + i) % 100;
    const pool = mergePromptPool(
      cat === 'train' ? TRAIN_PROMPTS : cat === 'fuel' ? FUEL_PROMPTS : cat === 'recover' ? RECOVER_PROMPTS : WEB_PROMPTS,
      [],
    );
    return pool[idx % pool.length];
  });
  const contextual = [
    pickCategoryPrompt('train', { userData, sessions, now }),
    pickCategoryPrompt('fuel', { userData, sessions, now }),
    pickCategoryPrompt('recover', { userData, sessions, now }),
    pickCategoryPrompt('web', { userData, sessions, now }),
  ];
  const merged = mergePromptPool(picks, contextual);
  const rotated = [];
  for (let i = 0; i < merged.length; i += 1) {
    rotated.push(merged[(hourSlot + daySeed + i) % merged.length]);
  }
  return [...new Set(rotated)].slice(0, 8);
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
