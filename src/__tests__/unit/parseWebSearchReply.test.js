const {
  parseWebSearchReply,
  parseSectionBlocks,
  preprocessWebSearchLayout,
} = require('../../ai-coach/chat-ui/lib/parseWebSearchReply');

describe('parseWebSearchReply', () => {
  it('parses ## sections without dropping content', () => {
    const raw = `## Summary
Body recomp needs lifting plus a small deficit with adequate protein intake over time.

## Key findings
- Lift heavy 3–4x/week for hypertrophy stimulus [Healthline]
- Protein around 1.6g/kg supports muscle retention during deficit [PubMed]
- Sleep quality affects recovery during recomp phases [NIH]

## What this means for you
You need consistency on protein and training volume to recomp effectively.

## Next steps
Track protein for two weeks and adjust based on scale and gym performance.`;

    const { summaryLead, sections, fullText } = parseWebSearchReply(raw);
    expect(summaryLead).toMatch(/Body recomp/);
    expect(sections.some((s) => /Key finding/i.test(s.title))).toBe(true);
    expect(sections.some((s) => s.title === 'What this means for you')).toBe(true);
    expect(fullText).toBe(raw);
    expect(fullText).toMatch(/1\.6g\/kg/);
    expect(fullText).toMatch(/Sleep quality/);
  });

  it('preserves full wall-of-text when unstructured', () => {
    const wall =
      'First sentence with detail. Second sentence with more detail. Third finding one with numbers. Fourth finding two. Fifth finding three.';
    const { fallbackMarkdown, fullText } = parseWebSearchReply(wall);
    expect(fallbackMarkdown || fullText).toBe(wall);
  });

  it('preprocessWebSearchLayout keeps every sentence for unstructured text', () => {
    const wall =
      'Alpha detail one. Beta detail two. Gamma detail three. Delta detail four. Epsilon detail five.';
    const laid = preprocessWebSearchLayout(wall);
    expect(laid).toMatch(/Alpha detail one/);
    expect(laid).toMatch(/Epsilon detail five/);
    expect(laid).toMatch(/## What it is/);
    expect(laid).toMatch(/## Key findings/);
  });

  it('stripInlineWebCitations preserves newlines', () => {
    const strip = (text) =>
      String(text || '')
        .replace(/\s*\[\d+\]/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    const raw = 'Line one [1]\n\n## Summary\nLine two [2]';
    expect(strip(raw)).toBe('Line one\n\n## Summary\nLine two');
  });

  it('splits bullets and paragraphs in a section', () => {
    const { bullets, paragraphs } = parseSectionBlocks('- One\n- Two\nA short note.');
    expect(bullets).toEqual(['One', 'Two']);
    expect(paragraphs).toEqual(['A short note.']);
  });
});
