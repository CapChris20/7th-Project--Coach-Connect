const {
  isImageFile,
  isVideoFile,
  isPdfFile,
  getEmbedViewerUri,
  notesFileDedupeKey,
} = require('../../shared-utils/getFileViewType');
const { serializeSpreadsheetRows } = require('../../shared/notes-files/spreadsheetRows');

describe('notes file helpers', () => {
  test('identifies media and pdf files', () => {
    expect(isImageFile({ mimeType: 'image/png' })).toBe(true);
    expect(isVideoFile({ mimeType: 'video/mp4' })).toBe(true);
    expect(isPdfFile({ name: 'doc.pdf' })).toBe(true);
  });

  test('builds office viewer url and stable dedupe key', () => {
    const uri = getEmbedViewerUri({ name: 'sheet.xlsx' }, 'https://example.com/sheet.xlsx');
    expect(uri).toContain('officeapps');
    expect(notesFileDedupeKey({ id: 'abc' })).toBe('id:abc');
  });

  test('serializeSpreadsheetRows avoids nested arrays for Firestore', () => {
    const stored = serializeSpreadsheetRows([['A1', 'B1'], ['A2', '']]);
    expect(stored).toEqual([{ cells: ['A1', 'B1'] }, { cells: ['A2', ''] }]);
    expect(Array.isArray(stored[0])).toBe(false);
  });
});
