jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async () => ({ uri: 'file:///tmp/plan.pdf' })),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(async () => ({})),
  getDownloadURL: jest.fn(async () => 'https://example.com/plan.pdf'),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(async () => ({})),
  serverTimestamp: jest.fn(() => 123),
  collection: jest.fn(),
  getDocs: jest.fn(async () => ({ docs: [] })),
  query: jest.fn(),
  orderBy: jest.fn(),
}));

jest.mock('../../app-start/config', () => ({
  storage: {},
  db: {},
}));

const {
  parsePlanForPdf,
  stripEmojis,
  stripMarkdown,
  buildPdfHtml,
} = require('../../workouts/plan-viewer/workoutPlanPdfService');

describe('workoutPlanPdfService parsing', () => {
  test('parses simple day/exercise plan text', () => {
    const parsed = parsePlanForPdf(
      'Workout Plan\nDay 1: Push\n1. Bench Press - 4 x 8, 90s rest'
    );
    expect(parsed).not.toBeNull();
    expect(parsed.days.length).toBeGreaterThan(0);
  });

  test('strips markdown and emojis', () => {
    expect(stripEmojis('Great job 🏆')).toBe('Great job');
    expect(stripMarkdown('**Bold**')).toBe('Bold');
  });

  test('builds html with escaped title', () => {
    const html = buildPdfHtml({ title: '<Plan>', subtitle: '', days: [] }, 'Chris');
    expect(html).toContain('&lt;Plan&gt;');
  });
});
