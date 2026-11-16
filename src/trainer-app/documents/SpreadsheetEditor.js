// Re-export SpreadsheetEditor for JavaScript and JSX interoperability.
// Flow: import SpreadsheetEditor from jsx component → export as default.
// Used by screens importing SpreadsheetEditor from .js path.

import SpreadsheetEditor from './SpreadsheetEditor.jsx';

// ===== NAMED CONSTANTS =====

const COMPONENT_NAME = 'SpreadsheetEditor';

// ===== HELPER FUNCTIONS =====

/**
 * Identify the exported component.
 * @returns {string}
 */
export function getSpreadsheetEditorName() {
  return COMPONENT_NAME;
}

// ===== MAIN FUNCTION =====

export default SpreadsheetEditor;
