const {
  hostLabel,
  faviconUrl,
  resolveSourcePreviewUri,
} = require('../../aiChat/chat-thread/renderSourcePreview');

describe('CoachWebSourceCards helpers', () => {
  test('extracts host and preview URLs for web source cards', () => {
    const url = 'https://www.example.com/article';
    expect(hostLabel(url)).toBe('example.com');
    expect(faviconUrl(url)).toContain('google.com/s2/favicons');
    expect(resolveSourcePreviewUri({ url })).toContain('thum.io');
  });
});
