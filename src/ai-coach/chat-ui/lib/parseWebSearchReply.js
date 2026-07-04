/**
 * Parse web-search replies — preserve full content, extract sections for tests/tools only.
 */

const SUMMARY_TITLES = /^(summary|quick answer|takeaway|overview|tl;dr)$/i;
const ACTION_TITLES = /^(next step|next steps|what to do|your next step|action|try this)$/i;
const PERSONAL_TITLES =
  /^(what this means for you|for you|practical takeaway|in practice|coaching take|bottom line for you|what to do with this)$/i;

function normalizeTitle(raw) {
  return String(raw || '')
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/^#+\s*/, '')
    .trim();
}

function sectionKind(title) {
  const t = normalizeTitle(title).toLowerCase();
  if (SUMMARY_TITLES.test(t)) return 'summary';
  if (ACTION_TITLES.test(t)) return 'action';
  if (PERSONAL_TITLES.test(t) || /what this means/.test(t)) return 'personal';
  if (/key point|key finding|finding|research|evidence|what the research|highlights|sources|citations/.test(t)) {
    return 'bullets';
  }
  return 'default';
}

function extractSections(text) {
  const sections = [];

  if (/^##\s+/m.test(text)) {
    const chunks = text.split(/\n(?=##\s+)/).filter(Boolean);
    for (const chunk of chunks) {
      const m = chunk.match(/^##\s+(.+?)\s*\n([\s\S]*)/);
      if (m) {
        sections.push({
          title: normalizeTitle(m[1]),
          body: m[2].trim(),
          kind: sectionKind(m[1]),
          lead: null,
        });
      }
    }
    return sections;
  }

  if (/\*\*[A-Za-z][^*\n]{2,60}\*\*/.test(text)) {
    const chunks = text.split(/\n(?=\*\*[A-Za-z][^*\n]+\*\*\s*\n?)/).filter(Boolean);
    for (const chunk of chunks) {
      const m = chunk.match(/^\*\*([^*]+)\*\*\s*\n?([\s\S]*)/);
      if (m) {
        sections.push({
          title: normalizeTitle(m[1]),
          body: m[2].trim(),
          kind: sectionKind(m[1]),
          lead: null,
        });
      }
    }
  }

  return sections;
}

/** Light layout pass — adds ## headers only when missing; never drops content. */
export function preprocessWebSearchLayout(markdown) {
  let t = String(markdown || '').trim();
  if (!t) return t;

  t = t.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  const hasStructure =
    /^#{1,3}\s/m.test(t) ||
    /^[-*•]\s/m.test(t) ||
    /^\d+[.)]\s/m.test(t) ||
    /\*\*[^*\n]{2,60}\*\*/.test(t) ||
    t.includes('\n\n');

  if (hasStructure) return t.trim();

  const sentences = t.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [t];
  if (sentences.length < 3) {
    return sentences.join('\n\n');
  }

  const summary = sentences.slice(0, 3).join(' ');
  const rest = sentences.slice(3);
  if (rest.length >= 2) {
    return `Here's a clear breakdown based on current research.\n\n## What it is\n${summary}\n\n## Key findings\n${rest.map((s) => `- **Point:** ${s}`).join('\n')}`;
  }

  return `${summary}\n\n${rest.join('\n\n')}`;
}

/** Non-destructive parse — every character from raw is preserved in output. */
export function parseWebSearchReply(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return { summary: null, summaryLead: null, sections: [], fallbackMarkdown: '', fullText: '' };
  }

  const sections = extractSections(text);
  if (!sections.length) {
    return { summary: null, summaryLead: null, sections: [], fallbackMarkdown: text, fullText: text };
  }

  const summaryIdx = sections.findIndex((s) => s.kind === 'summary');
  let summary = null;
  let summaryLead = null;
  let bodySections = sections;

  if (summaryIdx >= 0) {
    const s = sections[summaryIdx];
    summaryLead = s.body || null;
    bodySections = sections.filter((_, i) => i !== summaryIdx);
  }

  return {
    summary,
    summaryLead,
    sections: bodySections,
    fallbackMarkdown: '',
    fullText: text,
  };
}

export function parseSectionBlocks(body) {
  const raw = String(body || '').trim();
  if (!raw) return { paragraphs: [], bullets: [], numbered: [] };

  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const bullets = [];
  const numbered = [];
  const paragraphs = [];

  for (const line of lines) {
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, '').trim());
    } else if (/^\d+[.)]\s+/.test(line)) {
      numbered.push(line.replace(/^\d+[.)]\s+/, '').trim());
    } else {
      paragraphs.push(line);
    }
  }

  return { paragraphs, bullets, numbered };
}

/** @deprecated Use preprocessWebSearchLayout — kept for sentence splitting in tests. */
export function splitDenseParagraph(text, leadCount = 2) {
  const raw = String(text || '').trim();
  if (!raw) return { lead: '', bullets: [] };

  const sentences =
    raw.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [raw];
  if (sentences.length <= leadCount) {
    return { lead: sentences.join(' '), bullets: [] };
  }

  return {
    lead: sentences.slice(0, leadCount).join(' '),
    bullets: sentences.slice(leadCount),
  };
}

export { SUMMARY_TITLES, ACTION_TITLES, PERSONAL_TITLES };
