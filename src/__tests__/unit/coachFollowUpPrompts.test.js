const {
  extractFollowUpSection,
  buildContextualFollowUps,
  prepareCoachReplyForDisplay,
} = require('../../ai-coach/chat-ui/lib/coachFollowUpPrompts');

describe('coachFollowUpPrompts', () => {
  it('extracts ## Suggested follow-ups from reply and strips from display', () => {
    const raw = `## What it is
Sleep matters.

## Suggested follow-ups
- How much sleep do lifters need?
- What hurts recovery most?
- Compare this to my logged sleep?`;

    const { displayText, prompts } = extractFollowUpSection(raw);
    expect(displayText).not.toMatch(/Suggested follow-ups/);
    expect(prompts).toHaveLength(3);
    expect(prompts[0]).toMatch(/sleep/i);
  });

  it('builds follow-ups anchored to nutrition web search thread', () => {
    const prompts = buildContextualFollowUps({
      userMessage: 'Search the web: protein carbs and fats for lifters',
      assistantReply: `## Key findings
- Most sources recommend 1.6–2.2 g/kg protein for hypertrophy.
- Carbs support training performance when timed pre/post workout.
- Dietary fat should not drop below ~20% of calories.

## What this means for you
Balance all three macros rather than cutting one aggressively.`,
      searchedWeb: true,
    });

    expect(prompts).toHaveLength(3);
    expect(prompts.some((p) => /protein|carb|fat|sources|lifters/i.test(p))).toBe(true);
    expect(prompts.some((p) => /what i have been logging|my meals this week/i.test(p))).toBe(false);
  });

  it('references assistant reply bullets instead of vague profile prompts', () => {
    const prompts = buildContextualFollowUps({
      userMessage: 'How much protein do I need?',
      assistantReply: `## Key findings
- Aim for roughly 0.7–1 g per pound of body weight when training hard.
- Spread intake across 3–4 meals for better absorption.`,
      searchedWeb: false,
    });

    expect(prompts[0]).toMatch(/protein|0\.7|pound|mentioned/i);
    expect(prompts.some((p) => /my meals this week|my logs/i.test(p))).toBe(false);
  });

  it('builds contextual follow-ups for sleep web search', () => {
    const prompts = buildContextualFollowUps({
      userMessage: 'Search the web: sleep and muscle growth',
      assistantReply: 'Sleep supports hypertrophy...',
      searchedWeb: true,
    });
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.some((p) => /sleep|muscle|sources|evidence/i.test(p))).toBe(true);
  });

  it('prepareCoachReplyForDisplay prefers model follow-ups', () => {
    const { displayText, followUpPrompts } = prepareCoachReplyForDisplay(
      `## Key findings\n- Point one\n\n## Suggested follow-ups\n- Custom Q1?\n- Custom Q2?\n- Custom Q3?`,
      { userMessage: 'protein', searchedWeb: true },
    );
    expect(displayText).not.toMatch(/Suggested follow-ups/);
    expect(followUpPrompts[0]).toBe('Custom Q1?');
  });

  it('replaces vague model follow-ups with thread-anchored heuristics', () => {
    const { followUpPrompts } = prepareCoachReplyForDisplay(
      `## Key findings\n- Higher protein preserves lean mass in a deficit.\n\n## Suggested follow-ups\n- How does this compare to what I have been logging?`,
      {
        userMessage: 'Search the web: protein while cutting',
        assistantReply: '## Key findings\n- Higher protein preserves lean mass in a deficit.',
        searchedWeb: true,
      },
    );

    expect(followUpPrompts.some((p) => /logging/i.test(p))).toBe(false);
    expect(followUpPrompts.some((p) => /protein|cutting|sources/i.test(p))).toBe(true);
  });
});
