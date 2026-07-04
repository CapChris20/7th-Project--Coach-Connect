const {
  hostLabel,
  faviconUrl,
  screenshotPreviewUrl,
  resolveSourcePreviewUri,
} = require('../../ai-coach/chat-ui/chat-thread/renderSourcePreview');

test('coach source preview helpers resolve expected URLs', () => {
  expect(hostLabel('https://www.example.com/page')).toBe('example.com');
  expect(faviconUrl('https://example.com')).toContain('google.com/s2/favicons');
  expect(screenshotPreviewUrl('https://example.com')).toContain('thum.io');
  expect(resolveSourcePreviewUri({ url: 'https://example.com' })).toContain('thum.io');
});
