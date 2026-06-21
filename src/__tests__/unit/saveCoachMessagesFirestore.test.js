const { stripUndefinedForFirestore } = require('../../shared-utils/firestoreSanitize');

describe('saveCoachMessages Firestore payloads', () => {
  test('stripUndefinedForFirestore removes nested undefined in attachments', () => {
    const payload = stripUndefinedForFirestore({
      id: 'm1',
      role: 'user',
      text: 'hello',
      attachments: [
        { id: 'a1', name: 'photo.jpg', preview: 'file://x', mimeType: undefined },
      ],
      toolCall: { name: 'logWater', params: { amountOz: 16, note: undefined } },
    });
    expect(payload.attachments[0].mimeType).toBeUndefined();
    expect('mimeType' in payload.attachments[0]).toBe(false);
    expect(payload.toolCall.params.note).toBeUndefined();
    expect('note' in payload.toolCall.params).toBe(false);
  });

  test('webSources array omits undefined preview fields', () => {
    const payload = stripUndefinedForFirestore({
      webSources: [{ url: 'https://example.com', title: 'Example', image: undefined }],
    });
    expect(payload.webSources[0].url).toBe('https://example.com');
    expect('image' in payload.webSources[0]).toBe(false);
  });
});
