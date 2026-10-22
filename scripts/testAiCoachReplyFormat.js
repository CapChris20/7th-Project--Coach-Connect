// Reply-format regression (Oct 2026): the coach moved to a "Google AI answer"
// format (bold lead → ## sections → bullets → tables → one follow-up question).
// Before this, COACH_VOICE_DIRECTIVE *banned* bullets/bold/headers — this test
// guards against that conflict creeping back, and checks the phone can
// actually render the format (themed table styles + scrolling table rule).
// Offline only. Run: node scripts/testAiCoachReplyFormat.js

const fs = require('fs');
const path = require('path');
const {
  COACH_VOICE_DIRECTIVE,
  COACH_REPLY_FORMAT,
  COACH_WEB_SEARCH_FORMAT,
} = require('../server/lib/coachVoice');
const {
  buildCoachSystemPrompt,
  buildWeeklyContextSystemPrompt,
} = require('../server/lib/coachPrompt/coachPromptBuilders');

let passed = 0;
let failed = 0;
function check(label, ok) {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${label}`);
}
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

// ── 1. The format is in every system prompt, with all its rules ─────────────
for (const [label, prompt] of [
  ['general prompt', buildCoachSystemPrompt({}, { generalMode: true })],
  ['personal prompt', buildCoachSystemPrompt({}, { generalMode: false })],
  ['weekly-context prompt', buildWeeklyContextSystemPrompt({})],
]) {
  check(`${label} includes REPLY FORMAT`, prompt.includes('REPLY FORMAT'));
  check(`${label} asks for bold lead`, prompt.includes('bold lead sentence'));
  check(`${label} asks for section headers`, prompt.includes('section headers'));
  check(`${label} asks for comparison tables`, prompt.includes('multi-column markdown table'));
  check(`${label} asks for closing follow-up question`, prompt.includes('ONE short follow-up question'));
}

// ── 2. The old no-markdown conflict is gone everywhere ──────────────────────
check('voice directive has no bullet/bold ban', !/NEVER use:\s*\n- Bullet points/.test(COACH_VOICE_DIRECTIVE));
check('voice directive has no "never formatted breakdown"', !COACH_VOICE_DIRECTIVE.includes('never as a formatted breakdown'));
check('COACH_REPLY_FORMAT is exported for reuse/tests', typeof COACH_REPLY_FORMAT === 'string' && COACH_REPLY_FORMAT.length > 100);
check('web format builds on REPLY FORMAT (no override of a ban)', COACH_WEB_SEARCH_FORMAT.includes('builds on the REPLY FORMAT'));
check('web format ends with one follow-up question', COACH_WEB_SEARCH_FORMAT.includes('one follow-up question'));
check('short-turn exceptions exist (greetings/tool replies stay short)', COACH_REPLY_FORMAT.includes('Short-turn exceptions'));

// ── 3. The client renders it: themed tables + horizontal scroll ─────────────
const styles = read('src/ai-coach/reply-display/replyTextStyles.js');
for (const key of ['table:', 'thead:', 'th:', 'td:', 'tableBorder', 'tableHeaderBg']) {
  check(`markdown styles include ${key}`, styles.includes(key));
}
const rules = read('src/ai-coach/reply-display/coachMarkdownRules.jsx');
check('table rule wraps tables in a horizontal ScrollView', rules.includes('horizontal') && rules.includes('ScrollView'));
check('table rule sizes by column count', rules.includes('countTableColumns'));
check('CoachReplyText passes the custom rules', read('src/ai-coach/reply-display/CoachReplyText.jsx').includes('rules={markdownRules}'));
check('InternetAnswerReply passes the custom rules', read('src/ai-coach/reply-display/InternetAnswerReply.jsx').includes('rules={markdownRules}'));

// ── 4. A sample answer tokenizes as real markdown (not raw symbols) ─────────
const MarkdownIt = require('markdown-it');
const tokens = new MarkdownIt().parse(
  [
    '**For a beginner chest day, two presses and one fly is enough.**',
    '',
    '## The workout',
    '',
    '| Exercise | Sets × Reps | Rest |',
    '| --- | --- | --- |',
    '| **Machine chest press** | Do 3 sets of 8–12 reps. | Rest 90 seconds between sets. |',
    '',
    '## What to watch for',
    '',
    '- **Stop 1–2 reps before failure** on every set.',
    '',
    'Want me to adjust this for a home workout, build a weekly plan, or explain the form?',
  ].join('\n'),
);
const tokenTypes = new Set(tokens.map((t) => t.type));
const inlineChildren = tokens.flatMap((t) => (t.children || []).map((c) => c.type));
check('sample has a heading token', tokenTypes.has('heading_open'));
check('sample has a bullet list token', tokenTypes.has('bullet_list_open'));
check('sample has a table token', tokenTypes.has('table_open'));
check('sample has bold (strong) tokens', inlineChildren.includes('strong_open'));

console.log(`\nReply format regression: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
