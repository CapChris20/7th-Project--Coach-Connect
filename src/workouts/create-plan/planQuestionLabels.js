/**
 * Workout onboarding field display helpers for profile pill grid.
 */

const PLAN_BUILDER_COLORS = {
  orange: '#F97316',
};

export function formatProfileHeightDisplay(h) {
  if (h == null) return '—';
  if (typeof h === 'object') {
    const ftRaw = h.feet;
    const inRaw = h.inches;
    const hasFt = ftRaw != null && ftRaw !== '';
    const hasIn = inRaw != null && inRaw !== '';
    if (hasFt || hasIn) {
      const ft = hasFt ? Number(ftRaw) : 0;
      const inch = hasIn ? Number(inRaw) : 0;
      if (Number.isFinite(ft) && Number.isFinite(inch)) return `${ft}'${inch}"`;
    }
    return '—';
  }
  const n = typeof h === 'number' ? h : Number(String(h).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(n) && n >= 36 && n <= 96) {
    const t = Math.round(n);
    return `${Math.floor(t / 12)}'${t % 12}"`;
  }
  return '—';
}

const MARKDOWN_STYLES = {
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22 },
  heading1: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  heading2: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  strong: { color: '#ffffff', fontWeight: '700' },

export const LOVABLE_ACCENTS = [
  { key: 'warm-a', gradient: ['#BE185D', '#C2410C'], text: '#BE185D' },
  { key: 'warm-b', gradient: ['#C2410C', '#BE185D'], text: '#C2410C' },
  { key: 'warm-c', gradient: ['#BE185D', '#9A3412'], text: '#BE185D' },
  { key: 'warm-d', gradient: ['#9A3412', '#C2410C'], text: '#C2410C' },
];

function getWorkoutBuilderFieldRawDisplay(key, onboardingData) {
  if (!onboardingData) return '';
  switch (key) {
    case 'personalInfo':
      return `${onboardingData.gender || 'N/A'}, ${onboardingData.age || 'N/A'}yrs, ${onboardingData.weight || 'N/A'}lbs, ${onboardingData.height?.feet || 0}'${onboardingData.height?.inches || 0}"`;
    case 'fitnessLevel':
      return onboardingData.fitnessLevel
        ? onboardingData.fitnessLevel.charAt(0).toUpperCase() + onboardingData.fitnessLevel.slice(1)
        : 'Not set';
    case 'goal':
      return onboardingData.primaryGoal
        ? onboardingData.primaryGoal.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
        : 'Not set';
    case 'equipment':
      return onboardingData.equipmentAccess?.join(', ') || 'None selected';
    case 'frequency':
      return `${onboardingData.daysPerWeek || 0} days per week`;
    case 'injuries':
      return onboardingData.injuries || 'None reported';
    case 'trainingEnvironment':
      return onboardingData.trainingEnvironment
        ? onboardingData.trainingEnvironment.charAt(0).toUpperCase() + onboardingData.trainingEnvironment.slice(1)
        : 'Not set';
    case 'preferredWorkoutTime':
      return onboardingData.preferredWorkoutTime
        ? onboardingData.preferredWorkoutTime.charAt(0).toUpperCase() + onboardingData.preferredWorkoutTime.slice(1)
        : 'Not set';
    case 'exercisesDislike':
      return onboardingData.exercisesDislike || 'None';
    case 'supplementsCurrentlyTaking':
      return onboardingData.supplementsCurrentlyTaking || 'None';
    case 'currentStressLevel':
      return onboardingData.currentStressLevel
        ? onboardingData.currentStressLevel.charAt(0).toUpperCase() + onboardingData.currentStressLevel.slice(1)
        : 'Not set';
    case 'sleepQuality':
      return onboardingData.sleepQuality
        ? onboardingData.sleepQuality.charAt(0).toUpperCase() + onboardingData.sleepQuality.slice(1)
        : 'Not set';
    case 'energyLevels':
      return onboardingData.energyLevels
        ? onboardingData.energyLevels.charAt(0).toUpperCase() + onboardingData.energyLevels.slice(1)
        : 'Not set';
    case 'hydrationHabits':
      if (onboardingData.hydrationHabits === 'less_than_4') return 'Less than 4 cups/day';
      if (onboardingData.hydrationHabits === '4_8') return '4–8 cups/day';
      if (onboardingData.hydrationHabits === 'more_than_8') return 'More than 8 cups/day';
      return 'Not set';
    case 'situationDescription':
      return onboardingData.situationDescription || 'Not provided';
    default:
      return '';
  }
}

  const humanizeOnboardingToken = (token) => {
    const key = String(token || '').trim().toLowerCase();
    const labels = {
      full_gym: 'Full Gym',
      home_gym: 'Home Gym',
      dumbbells: 'Dumbbells',
      barbell: 'Barbell',
      machines: 'Machines',
      bands: 'Resistance Bands',
      bodyweight: 'Bodyweight',
      less_than_4: 'Less than 4 cups/day',
      '4_8': '4–8 cups/day',
      more_than_8: 'More than 8 cups/day',
    };
    if (labels[key]) return labels[key];
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatDisplayValue = (raw) => {
    if (raw == null || raw === undefined || raw === '') return null;
    let s = String(raw).trim();
    if (!s) return null;
    if (s === 'Not set' || s === 'None selected' || s === 'None reported' || s === 'Not provided') return null;
    if (s === 'undefined' || s.toLowerCase() === 'undefined') return null;
    if (/^N\/A,\s*N\/Ayrs,\s*N\/Albs,\s*0'0"$/i.test(s)) return null;
    if (/^0\s*days\s*per\s*week$/i.test(s)) return null;
    if (s.includes('_') && (s.includes(',') || /^[a-z0-9_]+$/i.test(s))) {
      s = s
        .split(',')
        .map((part) => humanizeOnboardingToken(part))
        .join(', ');
    } else if (/^[a-z0-9_]+$/i.test(s) && s.includes('_')) {
      s = humanizeOnboardingToken(s);
    }
    return s;
  };

export function displayForFieldKey(fieldKey, onboardingData) {
  const raw = getWorkoutBuilderFieldRawDisplay(fieldKey, onboardingData);
  const formatted = formatDisplayValue(raw);
  const s = formatted != null ? String(formatted).trim() : '';
  return s && s !== 'null' && s !== 'undefined' ? s : '—';
}
