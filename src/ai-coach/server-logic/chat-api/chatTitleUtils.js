/**
 * Chat title helpers — creative short titles for AI Coach history.
 */

function toTitleCase(s) {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function normalizeTitleKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Titles that are coach disclaimers / raw replies — never keep these. */
export function isJunkChatTitle(title) {
  const t = String(title || '').trim();
  if (!t) return true;
  if (/live search wasn'?t available/i.test(t)) return true;
  if (/here'?s what i know from coaching/i.test(t)) return true;
  if (/not cited web results/i.test(t)) return true;
  if (/^as an ai\b/i.test(t)) return true;
  if (/i (can|could) help you with/i.test(t)) return true;
  if (/\btool_call\b|```|\{"name":/i.test(t)) return true;
  if (/^(new chat|chat|untitled)$/i.test(t)) return true;
  // Bland "X Chat" leftovers from old local fallback
  if (/^(calories|protein|macro|macros|fitness|sleep|recovery|workout|hypertrophy|cutting|bulking|recomp|steps|cardio)\s+chat$/i.test(t)) {
    return true;
  }
  return false;
}

export function deriveChatTitle(firstUserText) {
  const raw = String(firstUserText || '').trim();
  if (!raw) return 'Coach Check-In';

  const t = raw.toLowerCase();

  const patterns = [
    /^(what is|what's|whats)\s+(.+)\??$/i,
    /^explain\s+(.+)\??$/i,
    /^define\s+(.+)\??$/i,
    /^how do i\s+(.+)\??$/i,
    /^how to\s+(.+)\??$/i,
    /^can i\s+(.+)\??$/i,
    /^should i\s+(.+)\??$/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m && (m[2] || m[1])) {
      const candidate = (m[2] || m[1] || '').trim();
      const cleaned = candidate
        .replace(/^go on the web and\s+/i, '')
        .replace(/^google\s+/i, '')
        .replace(/^(about|for)\s+/i, '')
        .replace(/\s+/g, ' ')
        .replace(/["'.!?]+$/g, '')
        .slice(0, 48);
      if (cleaned) return toTitleCase(cleaned);
    }
  }

  const topicMap = [
    { key: 'skinny fat', title: 'Skinny-Fat Fix' },
    { key: 'recomp', title: 'Recomp Roadmap' },
    { key: 'recomposition', title: 'Recomp Roadmap' },
    { key: 'body recomp', title: 'Recomp Roadmap' },
    { key: 'ashwagandha', title: 'Ashwagandha & Sleep' },
    { key: 'zero sugar', title: 'Zero-Sugar Sips' },
    { key: 'diet soda', title: 'Diet Soda Debate' },
    { key: 'energy drink', title: 'Energy Drink Check' },
    { key: 'preworkout', title: 'Pre-Workout Playbook' },
    { key: 'pre-workout', title: 'Pre-Workout Playbook' },
    { key: 'creatine', title: 'Creatine Clarity' },
    { key: 'protein', title: 'Protein Playbook' },
    { key: 'macros', title: 'Macro Math' },
    { key: 'calories', title: 'Calorie Strategy' },
    { key: 'cut', title: 'Cutting Game Plan' },
    { key: 'bulk', title: 'Bulking Blueprint' },
  ];
  for (const { key, title } of topicMap) {
    if (t.includes(key)) return title;
  }

  const cleaned = raw
    .replace(/[^\w\s%-]/g, ' ')
    .replace(/\b(please|pls|hey|hi|hello|ok|okay|so|like|just|really|actually|basically|google|web|search)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
  return cleaned ? toTitleCase(cleaned) : 'Coach Check-In';
}

/**
 * True when the stored title still looks like a raw first message (not a creative title).
 */
export function needsCreativeTitle(title, firstUserText = '') {
  const t = String(title || '').trim();
  if (isJunkChatTitle(t)) return true;

  const u = String(firstUserText || '').trim();
  if (u) {
    const norm = normalizeTitleKey;
    if (norm(t) === norm(u)) return true;
    if (norm(t) === norm(deriveChatTitle(u))) return true;
    if (norm(t) === norm(u.slice(0, 48))) return true;
  }

  if (/^(can u|can you|what do u|what do you|hey |please |log i|log that|check the)\b/i.test(t)) {
    return true;
  }
  if (t.length > 32 && /\b(for|that i|you don|walked|slept)\b/i.test(t)) return true;

  return false;
}

/**
 * Client-side creative title when the chat-title API is unavailable.
 */
export function buildCreativeTitleLocal(userText = '', assistantText = '') {
  const raw = String(userText || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return null;

  if (/\bashwagandha\b/i.test(lower)) return 'Ashwagandha & Sleep Science';
  if (/\bprotein\b/i.test(lower)) return 'Protein Playbook';
  if (/\bcalorie|calories|kcal\b/i.test(lower)) return 'Calorie Strategy';
  if (/\bmacro/i.test(lower)) return 'Macro Math Night';

  const stepsMatch = raw.match(/(\d[\d,]*)\s*steps?/i);
  if (stepsMatch || (/\b(log|track|record)\b/i.test(raw) && /\bsteps?\b/i.test(raw))) {
    const n = stepsMatch ? Number(stepsMatch[1].replace(/,/g, '')) : null;
    if (n && n >= 1000) {
      const label = n >= 10000 ? `${Math.round(n / 1000)}K` : n.toLocaleString();
      return `${label}-Step Day`;
    }
    return 'Step Streak Check';
  }

  const sleepMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (sleepMatch && /\b(sleep|slept|log|nap)\b/i.test(lower)) {
    const hrs = sleepMatch[1].replace(/\.0$/, '');
    return `${hrs}h Sleep Debrief`;
  }

  if (/\b(log|track|record)\b/i.test(raw)) {
    if (/\bprotein\b/i.test(raw)) return 'Protein Log Drop';
    if (/\bcalorie|calories|kcal\b/i.test(raw)) return 'Calorie Log Drop';
    if (/\bfood|meal|ate|breakfast|lunch|dinner\b/i.test(raw)) return 'Meal Log Drop';
    if (/\bwater|hydrat/i.test(raw)) return 'Hydration Check-In';
    if (/\bweight\b/i.test(raw)) return 'Scale Check-In';
    return 'Daily Metrics Drop';
  }

  if (/\bdirty cut\b/i.test(raw)) return 'Dirty Cut Debate';
  if (/\brecomp|recomposition\b/i.test(raw)) return 'Recomp Roadmap';
  if (/\bcreatinee?\b/i.test(raw)) return 'Creatine Clarity';
  if (/\bpre[- ]?workout\b/i.test(raw)) return 'Pre-Workout Playbook';
  if (/\bsleep\b/i.test(raw)) return 'Sleep Recovery Tactics';
  if (/\bworkout|training|lift|gym\b/i.test(raw)) return 'Training Tune-Up';
  if (/\bcut(ting)?\b/i.test(raw)) return 'Cutting Game Plan';
  if (/\bbulk(ing)?\b/i.test(raw)) return 'Bulking Blueprint';

  if (raw.length <= 28 && !/\?/.test(raw) && raw.split(/\s+/).length <= 5) {
    return toTitleCase(raw);
  }

  const assistant = String(assistantText || '').trim();
  if (assistant && !isJunkChatTitle(assistant) && raw.length < 40) {
    const topic = assistant.match(
      /\b(protein|macros|calories|sleep|recovery|workout|hypertrophy|cutting|bulking|recomp|steps|cardio|creatine|ashwagandha)\b/i,
    );
    if (topic) {
      const map = {
        protein: 'Protein Playbook',
        macros: 'Macro Math Night',
        calories: 'Calorie Strategy',
        sleep: 'Sleep Recovery Tactics',
        recovery: 'Recovery Reset',
        workout: 'Training Tune-Up',
        hypertrophy: 'Hypertrophy Huddle',
        cutting: 'Cutting Game Plan',
        bulking: 'Bulking Blueprint',
        recomp: 'Recomp Roadmap',
        steps: 'Step Streak Check',
        cardio: 'Cardio Strategy',
        creatine: 'Creatine Clarity',
        ashwagandha: 'Ashwagandha & Sleep Science',
      };
      return map[topic[0].toLowerCase()] || `${toTitleCase(topic[0])} Focus`;
    }
  }

  return null;
}
