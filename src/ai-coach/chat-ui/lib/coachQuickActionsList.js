/**
 * AI Coach home — capability tiles + quick action prefills (not coaching questions).
 */
import { AI_COACH_UI } from '../aiCoachUiTokens';

export const COACH_CAPABILITIES = [
  {
    id: 'food',
    label: 'Log food',
    shortLabel: 'Food',
    icon: 'restaurant-outline',
    color: AI_COACH_UI.chip.food,
    colorSecondary: '#FB923C',
    hint: 'Log meals and look up nutrition facts',
    actions: [
      { label: 'Log a meal', prefill: 'Log ' },
      { label: 'Look up calories', prefill: 'How many calories in ' },
      { label: 'Delete a food log', prefill: 'Remove my ' },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    icon: 'stats-chart-outline',
    color: AI_COACH_UI.cyan,
    colorSecondary: '#22D3EE',
    hint: 'Log or clear sleep, water, steps, mood, energy, rest day',
    actions: [
      { label: 'Log sleep', prefill: 'I slept ' },
      { label: 'Log water', prefill: 'I drank ' },
      { label: 'Log steps', prefill: 'Log ' },
      { label: 'Log rest day', prefill: 'Log a rest day for today' },
      { label: 'Remove dashboard entry', prefill: 'Remove my ' },
    ],
  },
  {
    id: 'web',
    label: 'Web search',
    shortLabel: 'Web',
    icon: 'globe-outline',
    color: AI_COACH_UI.purple,
    colorSecondary: '#A78BFA',
    hint: 'Live search for research, products, and current facts',
    actions: [
      { label: 'Search the web', prefill: 'Search the web: ' },
      { label: 'Verify with sources', prefill: 'Search the web and cite sources for ' },
    ],
  },
  {
    id: 'train',
    label: 'Training',
    shortLabel: 'Train',
    icon: 'barbell-outline',
    color: AI_COACH_UI.chip.workout,
    colorSecondary: '#C084FC',
    hint: 'Workout plan, swaps, and programming help',
    actions: [
      { label: "Open today's workout", prefill: "Show me today's workout plan" },
      { label: 'Swap an exercise', prefill: 'Swap ' },
      { label: 'Adjust my program', prefill: 'Help me adjust my training split' },
    ],
  },
];

/** Rotating quick-action chips on home (actions, not essay prompts). */
export const COACH_QUICK_ACTIONS = [
  'Log 8500 steps for today',
  'Remove my rest day log',
  'I slept 7.5 hours',
  'Search the web: creatine food sources',
  'Log chicken and rice for lunch',
  'Remove my water log',
  'How many calories in a Big Mac',
  'Show me today\'s workout plan',
  'Log my energy as 7/10',
  'Remove my sleep log from today',
];

export function buildHourlyQuickActions({ now = Date.now() } = {}) {
  const hour = Math.floor(now / 3_600_000);
  const rotated = [];
  for (let i = 0; i < COACH_QUICK_ACTIONS.length; i += 1) {
    rotated.push(COACH_QUICK_ACTIONS[(hour + i) % COACH_QUICK_ACTIONS.length]);
  }
  return rotated.slice(0, 8);
}

export function metaForQuickAction(text) {
  const s = String(text || '').toLowerCase();
  const C = AI_COACH_UI;
  if (/\b(search the web|verify)\b/.test(s)) {
    return { icon: 'globe-outline', color: C.purple, tint: 'rgba(192,132,252,0.22)' };
  }
  if (/\b(remove|delete|clear)\b/.test(s)) {
    return { icon: 'trash-outline', color: '#F87171', tint: 'rgba(248,113,113,0.20)' };
  }
  if (/\b(log|slept|drank)\b/.test(s)) {
    return { icon: 'create-outline', color: C.cyan, tint: 'rgba(6,182,212,0.22)' };
  }
  if (/\b(calories|macro|chicken|meal)\b/.test(s)) {
    return { icon: 'restaurant-outline', color: C.chip.food, tint: 'rgba(249,115,22,0.22)' };
  }
  if (/\b(workout|plan)\b/.test(s)) {
    return { icon: 'barbell-outline', color: C.chip.workout, tint: 'rgba(167,139,250,0.22)' };
  }
  return { icon: 'flash-outline', color: C.pink, tint: 'rgba(255,107,157,0.22)' };
}
