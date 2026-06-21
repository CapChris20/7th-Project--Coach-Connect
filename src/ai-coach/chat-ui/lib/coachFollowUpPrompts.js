/**
 * Context-aware follow-up chips after coach replies — anchored to the thread, not vague profile prompts.
 */

const FOLLOW_UP_SECTION_RE =
  /##\s*Suggested follow-ups?\s*\n([\s\S]*?)(?=\n##\s+|$)/i;

function linesToPrompts(block) {
  return String(block || '')
    .split('\n')
    .map((l) => l.replace(/^[-*•\d.)]+\s*/, '').trim())
    .filter((l) => l.length > 8 && l.endsWith('?'));
}

export function extractFollowUpSection(text) {
  const raw = String(text || '');
  const m = raw.match(FOLLOW_UP_SECTION_RE);
  if (!m) return { displayText: raw.trim(), prompts: [] };

  const prompts = linesToPrompts(m[1]);
  const displayText = raw.replace(FOLLOW_UP_SECTION_RE, '').trim();
  return { displayText, prompts };
}

function topicFromText(...parts) {
  return parts.join(' ').toLowerCase();
}

function pickUnique(list, max = 3) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const s = String(item || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function clipPhrase(s, maxLen = 72) {
  const t = String(s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function cleanUserAsk(msg) {
  return String(msg || '')
    .replace(/^search the web:\s*/i, '')
    .replace(/^@\w+\s*/, '')
    .trim();
}

function extractReplySections(text) {
  const titles = [];
  const re = /^##\s+(.+?)\s*$/gm;
  let match;
  while ((match = re.exec(String(text || ''))) !== null) {
    const title = match[1].replace(/\*\*/g, '').trim();
    if (!/suggested follow-up/i.test(title)) titles.push(title);
  }
  return titles;
}

function extractReplyBullets(text, max = 4) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/^[-*•\d.)]+\s*/, '').replace(/\*\*/g, '').trim())
    .filter((line) => line.length > 14 && line.length < 140 && !line.startsWith('#'))
    .slice(0, max);
}

function isGenericProfilePrompt(prompt) {
  return /what i have been logging|my meals this week|based on my goal|based on my logs|fit my goal/i.test(
    String(prompt || ''),
  );
}

/** Heuristic follow-ups when the model omits the ## Suggested follow-ups section. */
export function buildContextualFollowUps({
  userMessage = '',
  assistantReply = '',
  searchedWeb = false,
  userProfile = null,
} = {}) {
  const userAsk = cleanUserAsk(userMessage);
  const reply = String(assistantReply || '');
  const blob = topicFromText(userMessage, assistantReply);
  const sections = extractReplySections(reply);
  const bullets = extractReplyBullets(reply);
  const prompts = [];

  if (searchedWeb && userAsk.length >= 6) {
    const topic = clipPhrase(userAsk, 52);
    prompts.push(`Which of your sources had the strongest take on ${topic}?`);
    prompts.push(`Where do those sources disagree on ${topic}?`);
  } else if (userAsk.endsWith('?') && userAsk.length >= 12) {
    prompts.push(`Go deeper on your answer to: ${clipPhrase(userAsk, 64)}`);
  } else if (userAsk.length >= 10) {
    prompts.push(`What’s the practical takeaway from your answer about ${clipPhrase(userAsk, 48)}?`);
  }

  for (const title of sections) {
    if (/key finding|what it is|practical|what this means|next step|evidence|research/i.test(title)) {
      prompts.push(`Can you expand on “${clipPhrase(title, 44)}” from your reply?`);
    }
  }

  if (bullets[0]) {
    prompts.push(`You mentioned “${clipPhrase(bullets[0], 56)}” — can you make that more concrete?`);
  }

  if (searchedWeb) {
    prompts.push('Which finding had the weakest evidence behind it?');
    prompts.push('Can you rank your key points by how confident you are in them?');
  }

  if (/protein|macro|carb|fat|calorie|nutrition|meal|deficit|surplus/.test(blob)) {
    if (/protein/.test(blob)) {
      prompts.push('What protein target would you use based on what you just explained?');
    }
    if (/carb/.test(blob)) {
      prompts.push('When should I time carbs around training based on this reply?');
    }
    if (/fat/.test(blob)) {
      prompts.push('How should I set dietary fat given what you recommended?');
    }
    if (/deficit|cut|fat loss|lose weight/.test(blob)) {
      prompts.push('How would you adjust this advice if I’m in a calorie deficit?');
    } else if (/surplus|bulk|gain/.test(blob)) {
      prompts.push('How would you adjust this advice if I’m trying to gain muscle?');
    }
  }

  if (/supplement|creatine|vitamin|fiber|ashwagandha|omega/.test(blob)) {
    prompts.push('Is this worth it for my situation, or is there a better option?');
    prompts.push('What dose and timing would you recommend from what you shared?');
    if (searchedWeb) prompts.push('Search the web: are there cleaner or better-rated alternatives?');
  }

  if (/workout|hypertrophy|strength|volume|program|split|lift|train/.test(blob)) {
    prompts.push('How should I adjust my training based on what you just said?');
    prompts.push('What would you prioritize if I only have 3 sessions this week?');
  }

  if (/injury|pain|shoulder|knee|back|mobility/.test(blob)) {
    prompts.push('Which movements should I modify or avoid based on this?');
    prompts.push('When should I see a physio vs work around this?');
  }

  if (/progress|plateau|stalled|journey|since i started|cycle/.test(blob)) {
    prompts.push('What in my recent logs might explain this?');
    prompts.push('Walk me through my progress cycle since I joined');
  }

  if (/sleep|insomnia|rest|recovery/.test(blob)) {
    prompts.push('What sleep habit from your answer should I try first this week?');
    prompts.push('How does this connect to recovery from my training?');
  }

  prompts.push('Can you boil that down to 3 concrete actions?');
  prompts.push('What part of that answer matters most if I only remember one thing?');
  prompts.push('Can you simplify that in plain language?');

  return pickUnique(
    prompts.filter((p) => !isGenericProfilePrompt(p)),
    3,
  );
}

export function prepareCoachReplyForDisplay(rawText, options = {}) {
  const { displayText: stripped, prompts: fromModel } = extractFollowUpSection(rawText);
  const displayText = stripped || String(rawText || '').trim();
  let followUpPrompts = fromModel.filter((p) => !isGenericProfilePrompt(p));

  if (followUpPrompts.length < 2) {
    followUpPrompts = buildContextualFollowUps({
      ...options,
      assistantReply: displayText,
    });
  }

  return {
    displayText,
    followUpPrompts: pickUnique(followUpPrompts, 3),
  };
}
