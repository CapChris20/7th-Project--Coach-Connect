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

export function deriveChatTitle(firstUserText) {
  const raw = String(firstUserText || '').trim();
  if (!raw) return 'Chat';

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
    { key: 'skinny fat', title: 'Skinny Fat' },
    { key: 'recomp', title: 'Body Recomposition' },
    { key: 'recomposition', title: 'Body Recomposition' },
    { key: 'body recomp', title: 'Body Recomposition' },
    { key: 'zero sugar', title: 'Zero Sugar Drinks' },
    { key: 'diet soda', title: 'Diet Soda' },
    { key: 'energy drink', title: 'Energy Drinks' },
    { key: 'preworkout', title: 'Pre-Workout' },
    { key: 'pre-workout', title: 'Pre-Workout' },
    { key: 'creatine', title: 'Creatine' },
    { key: 'protein', title: 'Protein Intake' },
    { key: 'macros', title: 'Macros' },
    { key: 'calories', title: 'Calories' },
    { key: 'cut', title: 'Cutting' },
    { key: 'bulk', title: 'Bulking' },
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
  return cleaned ? toTitleCase(cleaned) : 'Chat';
}

/**
 * True when the stored title still looks like a raw first message (not a creative title).
 */
export function needsCreativeTitle(title, firstUserText = '') {
  const t = String(title || '').trim();
  if (!t || t === 'New Chat' || t === 'Chat') return true;

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

  if (/\bprotein\b/i.test(lower)) return 'Protein Game Plan';
  if (/\bcalorie|calories|kcal\b/i.test(lower)) return 'Calorie Strategy';
  if (/\bmacro/i.test(lower)) return 'Macro Breakdown';

  const stepsMatch = raw.match(/(\d[\d,]*)\s*steps?/i);
  if (stepsMatch || (/\b(log|track|record)\b/i.test(raw) && /\bsteps?\b/i.test(raw))) {
    const n = stepsMatch ? Number(stepsMatch[1].replace(/,/g, '')) : null;
    if (n && n >= 1000) {
      const label = n >= 10000 ? `${Math.round(n / 1000)}K` : n.toLocaleString();
      return `${label} Steps`;
    }
    return 'Step Tracker';
  }

  const sleepMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (sleepMatch && /\b(sleep|slept|log|nap)\b/i.test(lower)) {
    const hrs = sleepMatch[1].replace(/\.0$/, '');
    return `${hrs}h Sleep Log`;
  }

  if (/\b(log|track|record)\b/i.test(raw)) {
    if (/\bprotein\b/i.test(raw)) return 'Protein Log';
    if (/\bcalorie|calories|kcal\b/i.test(raw)) return 'Calorie Log';
    if (/\bfood|meal|ate|breakfast|lunch|dinner\b/i.test(raw)) return 'Meal Log';
    if (/\bwater|hydrat/i.test(raw)) return 'Hydration Log';
    if (/\bweight\b/i.test(raw)) return 'Weight Log';
    return 'Fitness Log';
  }

  if (/\bdirty cut\b/i.test(raw)) return 'Dirty Cut';
  if (/\brecomp|recomposition\b/i.test(raw)) return 'Body Recomp';

  if (raw.length <= 28 && !/\?/.test(raw) && raw.split(/\s+/).length <= 5) {
    return toTitleCase(raw);
  }

  const assistant = String(assistantText || '').trim();
  if (assistant && raw.length < 40) {
    const topic = assistant.match(
      /\b(protein|macros|calories|sleep|recovery|workout|hypertrophy|cutting|bulking|recomp|steps|cardio)\b/i,
    );
    if (topic) return `${toTitleCase(topic[0])} Chat`;
  }

  return null;
}
