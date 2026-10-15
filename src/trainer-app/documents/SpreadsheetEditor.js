// Trainer spreadsheet editor modal — sheet grid + Firestore save shell.
// Flow: load sheet → edit cells/formulas → autosave to users/{trainerId}/documents → share/export.
// Used by: trainer files screen when opening or creating a spreadsheet.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, Keyboard, Platform, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { deleteDoc, doc, collection } from 'firebase/firestore';
import { getTrainerDocument, saveTrainerSpreadsheet } from '../../for-both/files-and-notes/saveNotesAndFiles';
import { db } from '../../app-start/cloudConnection';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import ShareDocumentPopup from './ShareDocumentPopup';
import SaveStatusLabel from './SaveStatusLabel';
import { EditorIconButton, EditorTitleField, DEFAULT_SAVE_TITLE_SPREADSHEET } from './EditorTopButtons';
import { formatEditorSavedAgo, getEditorTheme } from './editorColors';
import { ROWS, COLS, DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, TOUCH_MIN, keyOf, newSheet, normalizeSel } from './spreadsheet-grid/spreadsheetConstants';
import { detectFormat, formatNumberNice } from './spreadsheet-grid/cellFormatting';
import { prepareCellText, lookupDisplay } from './spreadsheet-grid/prepareCellText';
import FormulaBar from './spreadsheet-grid/FormulaBar';
import { syncCellDims, syncDimsForRange } from './spreadsheet-grid/columnWidths';
import { firestoreToSheets, sheetsToFirestore } from './spreadsheet-grid/saveAndLoadSheet';
import SpreadsheetGrid from './spreadsheet-grid/SpreadsheetGrid';
import SlideUpMenu, { SheetMenuItem } from './spreadsheet-grid/SlideUpMenu';

// ===== NAMED CONSTANTS =====

const TOAST_VISIBLE_MS = 2000;
const SCROLL_RETRY_MS = 2000;
const AUTOSAVE_DEBOUNCE_MS = 1500;
const DEFER_SAVE_WHILE_EDITING_MS = 800;
const HISTORY_KEEP_COUNT = 99;

// ===== HELPER FUNCTIONS =====

/**
 * Title used when saving — blank titles become the default spreadsheet name.
 * @param {string} raw
 * @returns {string}
 */
function saveTitle(raw) {
  const trimmedTitle = String(raw || '').trim();
  return trimmedTitle || DEFAULT_SAVE_TITLE_SPREADSHEET;
}

/**
 * @returns {Date}
 */
function now() {
  return new Date();
}

/**
 * Walk every cell in a selection rectangle.
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {(rowIndex: number, columnIndex: number) => void} visitCell
 */
function forEachCellInSelection(sel, visitCell) {
  for (let rowIndex = sel.r1; rowIndex <= sel.r2; rowIndex += 1) {
    for (let columnIndex = sel.c1; columnIndex <= sel.c2; columnIndex += 1) {
      visitCell(rowIndex, columnIndex);
    }
  }
}

/**
 * True when every non-empty cell in the selection already has this style flag.
 * @param {object} cells
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {string} styleKey
 * @returns {boolean}
 */
function selectionAlreadyHasStyle(cells, sel, styleKey) {
  let allHave = true;
  let anyCell = false;
  forEachCellInSelection(sel, (rowIndex, columnIndex) => {
    const existing = cells[keyOf(rowIndex, columnIndex)];
    if (existing) anyCell = true;
    if (!existing?.style?.[styleKey]) allHave = false;
  });
  return anyCell && allHave;
}

/**
 * Turn a style flag on or off for every cell in the selection.
 * @param {object} cells
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {string} styleKey
 * @param {boolean} styleOn
 */
function setStyleFlagOnSelection(cells, sel, styleKey, styleOn) {
  forEachCellInSelection(sel, (rowIndex, columnIndex) => {
    const key = keyOf(rowIndex, columnIndex);
    const existing = cells[key] ?? { raw: '' };
    cells[key] = { ...existing, style: { ...existing.style, [styleKey]: styleOn } };
  });
}

/**
 * Apply a number/checkbox format to every cell in the selection.
 * @param {object} cells
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {string} formatName
 * @param {string|undefined} currency
 */
function setFormatOnSelection(cells, sel, formatName, currency) {
  forEachCellInSelection(sel, (rowIndex, columnIndex) => {
    const key = keyOf(rowIndex, columnIndex);
    const existing = cells[key] ?? { raw: '' };
    let raw = existing.raw;
    if (formatName === 'checkbox' && raw === '') raw = 'false';
    cells[key] = {
      ...existing,
      raw,
      format: formatName,
      currency: currency ?? existing.currency,
    };
  });
}

/**
 * Toggle bold/italic/underline across the active sheet's selection.
 * @param {object} sheet
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {string} styleKey
 * @returns {object}
 */
function sheetWithToggledStyle(sheet, sel, styleKey) {
  const cells = { ...sheet.cells };
  const styleOn = !selectionAlreadyHasStyle(cells, sel, styleKey);
  setStyleFlagOnSelection(cells, sel, styleKey, styleOn);
  const { colWidths, rowHeights } = syncDimsForRange(
    cells,
    sheet.colWidths,
    sheet.rowHeights,
    sel.r1,
    sel.r2,
    sel.c1,
    sel.c2,
  );
  return { ...sheet, cells, colWidths, rowHeights };
}

/**
 * @param {object} sheet
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {string} formatName
 * @param {string|undefined} currency
 * @returns {object}
 */
function sheetWithFormat(sheet, sel, formatName, currency) {
  const cells = { ...sheet.cells };
  setFormatOnSelection(cells, sel, formatName, currency);
  return { ...sheet, cells };
}

/**
 * Move one cell key when inserting or deleting a row/column.
 * @param {string} cellKey
 * @param {object} sourceCells
 * @param {object} destCells
 * @param {'row'|'col'} kind
 * @param {number} at
 * @param {number} delta
 */
function placeShiftedCell(cellKey, sourceCells, destCells, kind, at, delta) {
  const [rowIndex, columnIndex] = cellKey.split(',').map(Number);
  if (kind === 'row') {
    placeShiftedRowCell(rowIndex, columnIndex, cellKey, sourceCells, destCells, at, delta);
    return;
  }
  placeShiftedColumnCell(rowIndex, columnIndex, cellKey, sourceCells, destCells, at, delta);
}

/**
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @param {string} cellKey
 * @param {object} sourceCells
 * @param {object} destCells
 * @param {number} at
 * @param {number} delta
 */
function placeShiftedRowCell(rowIndex, columnIndex, cellKey, sourceCells, destCells, at, delta) {
  if (delta === 1 && rowIndex >= at) {
    destCells[keyOf(rowIndex + 1, columnIndex)] = sourceCells[cellKey];
    return;
  }
  if (delta !== -1) {
    destCells[cellKey] = sourceCells[cellKey];
    return;
  }
  if (rowIndex === at) return;
  if (rowIndex > at) {
    destCells[keyOf(rowIndex - 1, columnIndex)] = sourceCells[cellKey];
    return;
  }
  destCells[cellKey] = sourceCells[cellKey];
}

/**
 * @param {number} rowIndex
 * @param {number} columnIndex
 * @param {string} cellKey
 * @param {object} sourceCells
 * @param {object} destCells
 * @param {number} at
 * @param {number} delta
 */
function placeShiftedColumnCell(rowIndex, columnIndex, cellKey, sourceCells, destCells, at, delta) {
  if (delta === 1 && columnIndex >= at) {
    destCells[keyOf(rowIndex, columnIndex + 1)] = sourceCells[cellKey];
    return;
  }
  if (delta !== -1) {
    destCells[cellKey] = sourceCells[cellKey];
    return;
  }
  if (columnIndex === at) return;
  if (columnIndex > at) {
    destCells[keyOf(rowIndex, columnIndex - 1)] = sourceCells[cellKey];
    return;
  }
  destCells[cellKey] = sourceCells[cellKey];
}

/**
 * Insert or delete a row/column by remapping every cell key.
 * @param {object} sheet
 * @param {'row'|'col'} kind
 * @param {number} at
 * @param {number} delta
 * @returns {object}
 */
function sheetWithShiftedCells(sheet, kind, at, delta) {
  const cells = {};
  for (const cellKey of Object.keys(sheet.cells)) {
    placeShiftedCell(cellKey, sheet.cells, cells, kind, at, delta);
  }
  return { ...sheet, cells };
}

/**
 * Sum / avg / count for a multi-cell selection.
 * @param {Map|object} displayCache
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @returns {{ count: number, sum: number, avg: number|null, hasNums: boolean }|null}
 */
function computeSelectionStats(displayCache, sel) {
  if (sel.r1 === sel.r2 && sel.c1 === sel.c2) return null;
  const numericValues = [];
  let count = 0;
  forEachCellInSelection(sel, (rowIndex, columnIndex) => {
    const displayInfo = lookupDisplay(displayCache, rowIndex, columnIndex);
    if (displayInfo.rawValue === null || displayInfo.rawValue === '') return;
    count += 1;
    pushNumericIfNeeded(displayInfo, numericValues);
  });
  if (!count) return null;
  const sum = numericValues.reduce((leftTotal, rightTotal) => leftTotal + rightTotal, 0);
  return {
    count,
    sum,
    avg: numericValues.length ? sum / numericValues.length : null,
    hasNums: numericValues.length > 0,
  };
}

/**
 * @param {object} displayInfo
 * @param {number[]} numericValues
 */
function pushNumericIfNeeded(displayInfo, numericValues) {
  const numericValue =
    typeof displayInfo.rawValue === 'number' ? displayInfo.rawValue : Number(displayInfo.rawValue);
  if (Number.isNaN(numericValue)) return;
  if (typeof displayInfo.rawValue === 'boolean') return;
  numericValues.push(numericValue);
}
/**
 * Compare two cell raw values for A→Z / Z→A sort.
 * @param {object} leftCell
 * @param {object} rightCell
 * @param {'asc'|'desc'} dir
 * @returns {number}
 */
function compareCellRawForSort(leftCell, rightCell, dir) {
  const leftRaw = leftCell?.[0]?.raw ?? '';
  const rightRaw = rightCell?.[0]?.raw ?? '';
  const leftNumber = Number(leftRaw);
  const rightNumber = Number(rightRaw);
  const bothNumbers = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);
  const cmp = bothNumbers ? leftNumber - rightNumber : String(leftRaw).localeCompare(String(rightRaw));
  return dir === 'asc' ? cmp : -cmp;
}

/**
 * @param {object} sheet
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {'asc'|'desc'} dir
 * @returns {object}
 */
function sheetWithSortedRange(sheet, sel, dir) {
  const cells = { ...sheet.cells };
  const rowsData = collectRowsFromSelection(cells, sel);
  rowsData.sort((leftRow, rightRow) => compareCellRawForSort(leftRow, rightRow, dir));
  writeRowsBackToSelection(cells, sel, rowsData);
  return { ...sheet, cells };
}

/**
 * @param {object} cells
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @returns {object[][]}
 */
function collectRowsFromSelection(cells, sel) {
  const rowsData = [];
  for (let rowIndex = sel.r1; rowIndex <= sel.r2; rowIndex += 1) {
    const row = [];
    for (let columnIndex = sel.c1; columnIndex <= sel.c2; columnIndex += 1) {
      row.push(cells[keyOf(rowIndex, columnIndex)] ?? { raw: '' });
    }
    rowsData.push(row);
  }
  return rowsData;
}

/**
 * @param {object} cells
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {object[][]} rowsData
 */
function writeRowsBackToSelection(cells, sel, rowsData) {
  rowsData.forEach((row, rowOffset) => {
    writeOneSortedRow(cells, sel, row, rowOffset);
  });
}

/**
 * @param {object} cells
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {object[]} row
 * @param {number} rowOffset
 */
function writeOneSortedRow(cells, sel, row, rowOffset) {
  row.forEach((cell, columnOffset) => {
    const key = keyOf(sel.r1 + rowOffset, sel.c1 + columnOffset);
    writeSortedCell(cells, key, cell);
  });
}

/**
 * @param {object} cells
 * @param {string} key
 * @param {object} cell
 */
function writeSortedCell(cells, key, cell) {
  const isEmpty = cell.raw === '' && !cell.style && !cell.format;
  if (isEmpty) {
    delete cells[key];
    return;
  }
  cells[key] = cell;
}

/**
 * Find/replace inside one sheet's cells.
 * @param {object} sheet
 * @param {string} findText
 * @param {string} replaceText
 * @param {boolean} replaceAll
 * @returns {{ sheet: object, replaceCount: number }}
 */
function sheetWithFindReplace(sheet, findText, replaceText, replaceAll) {
  const cells = { ...sheet.cells };
  let replaceCount = 0;
  for (const key of Object.keys(cells)) {
    const hit = replaceOneCellIfMatch(cells, key, findText, replaceText);
    if (!hit) continue;
    replaceCount += 1;
    if (!replaceAll) break;
  }
  return { sheet: { ...sheet, cells }, replaceCount };
}

/**
 * @param {object} cells
 * @param {string} key
 * @param {string} findText
 * @param {string} replaceText
 * @returns {boolean}
 */
function replaceOneCellIfMatch(cells, key, findText, replaceText) {
  const existing = cells[key];
  if (!String(existing.raw).includes(findText)) return false;
  cells[key] = {
    ...existing,
    raw: String(existing.raw).split(findText).join(replaceText),
  };
  return true;
}

/**
 * Build a CSV string from the used rectangle of cells.
 * @param {object} cells
 * @returns {string}
 */
function buildCsvFromCells(cells) {
  const { maxRow, maxColumn } = findUsedCellBounds(cells);
  const csvRows = [];
  for (let rowIndex = 0; rowIndex <= maxRow; rowIndex += 1) {
    csvRows.push(buildCsvRow(cells, rowIndex, maxColumn));
  }
  return csvRows.join('\n');
}

/**
 * @param {object} cells
 * @returns {{ maxRow: number, maxColumn: number }}
 */
function findUsedCellBounds(cells) {
  let maxRow = 0;
  let maxColumn = 0;
  for (const key of Object.keys(cells || {})) {
    const [rowIndex, columnIndex] = key.split(',').map(Number);
    if (rowIndex > maxRow) maxRow = rowIndex;
    if (columnIndex > maxColumn) maxColumn = columnIndex;
  }
  return { maxRow, maxColumn };
}

/**
 * @param {object} cells
 * @param {number} rowIndex
 * @param {number} maxColumn
 * @returns {string}
 */
function buildCsvRow(cells, rowIndex, maxColumn) {
  const row = [];
  for (let columnIndex = 0; columnIndex <= maxColumn; columnIndex += 1) {
    const cellRawText = cells?.[keyOf(rowIndex, columnIndex)]?.raw ?? '';
    row.push(escapeCsvCell(cellRawText));
  }
  return row.join(',');
}

/**
 * @param {string} cellRawText
 * @returns {string}
 */
function escapeCsvCell(cellRawText) {
  if (!/[",\n]/.test(cellRawText)) return cellRawText;
  return `"${String(cellRawText).replace(/"/g, '""')}"`;
}

/**
 * Align every cell in the selection.
 * @param {object} sheet
 * @param {{ r1: number, r2: number, c1: number, c2: number }} sel
 * @param {string} align
 * @returns {object}
 */
function sheetWithAlign(sheet, sel, align) {
  const cells = { ...sheet.cells };
  forEachCellInSelection(sel, (rowIndex, columnIndex) => {
    const key = keyOf(rowIndex, columnIndex);
    const existing = cells[key] ?? { raw: '' };
    cells[key] = { ...existing, style: { ...existing.style, align } };
  });
  return { ...sheet, cells };
}

/**
 * Persist the current sheets to Firestore and update save UI state.
 * @param {object} args
 * @returns {Promise<string|null>}
 */
async function writeSpreadsheetSave({
  trainerId,
  documentId,
  title,
  favorite,
  syncClientStubs,
  sheetsSnapshot,
  mountedRef,
  docIdRef,
  setDocId,
  setLastSaved,
  setStatus,
  onSaved,
}) {
  try {
    const payload = sheetsToFirestore(sheetsSnapshot);
    const res = await saveTrainerSpreadsheet(trainerId, {
      id: documentId || undefined,
      title: saveTitle(title),
      rows: payload.rows,
      columnCount: payload.columnCount,
      rowCount: payload.rowCount,
      formats: payload.formats,
      colWidths: payload.colWidths,
      rowHeights: payload.rowHeights,
      sheets: payload.sheets,
      isFavorite: favorite,
      syncClientStubs,
    });
    return applySuccessfulSpreadsheetSave({
      res,
      documentId,
      mountedRef,
      docIdRef,
      setDocId,
      setLastSaved,
      setStatus,
      onSaved,
    });
  } catch (error) {
    markSpreadsheetSaveFailed(mountedRef, setStatus, error);
    throw error;
  }
}

/**
 * @param {object} args
 * @returns {string|null}
 */
function applySuccessfulSpreadsheetSave({
  res,
  documentId,
  mountedRef,
  docIdRef,
  setDocId,
  setLastSaved,
  setStatus,
  onSaved,
}) {
  if (!mountedRef.current) return res?.id || documentId || null;
  const savedId = res?.id || documentId;
  if (savedId) {
    docIdRef.current = savedId;
    setDocId(savedId);
  }
  setLastSaved(now());
  setStatus('saved');
  onSaved?.();
  return savedId;
}

/**
 * @param {{ current: boolean }} mountedRef
 * @param {Function} setStatus
 * @param {Error} error
 */
function markSpreadsheetSaveFailed(mountedRef, setStatus, error) {
  if (!mountedRef.current) return;
  setStatus('unsaved');
  Alert.alert('Could not save', error?.message || 'Something went wrong saving your spreadsheet.');
}

function ToolBtn({
  children,
  onPress,
  label,
  active,
  theme,
  disabled
}) {
  const inner = <View style={[styles.toolBtn, disabled ? {
    opacity: 0.35
  } : null]}>
      {children}
    </View>;
  if (active) {
    return <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityLabel={label} activeOpacity={0.75}>
        <LinearGradient colors={theme.sheetGradient} start={{
        x: 0,
        y: 0
      }} end={{
        x: 1,
        y: 1
      }} style={[styles.toolBtn, styles.toolBtnActive]}>
          {children}
        </LinearGradient>
      </TouchableOpacity>;
  }
  return <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityLabel={label} activeOpacity={0.75}>
      {inner}
    </TouchableOpacity>;
}
function StatChip({
  label,
  val,
  onPress
}) {
  return <TouchableOpacity onPress={onPress} style={styles.statChip} activeOpacity={0.8}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statVal}>{val}</Text>
    </TouchableOpacity>;
}
function Divider({
  theme
}) {
  return <View style={[styles.divider, {
    backgroundColor: theme.divider
  }]} />;
}

/** Ticks on its own so the header clock does not re-render the whole editor grid. */
function SavedAgoLabel({
  at,
  theme
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((tickCount) => tickCount + 1), TOAST_VISIBLE_MS);
    return () => clearInterval(id);
  }, []);
  return <Text style={{
    color: theme.textMuted,
    fontSize: 11,
    marginLeft: 8
  }}>
      {formatEditorSavedAgo(at)}
    </Text>;
}
// ===== MAIN FUNCTION =====

/**
 * Full-screen spreadsheet editor for trainers.
 * @param {object} props
 */
export default function SpreadsheetEditor({
  visible,
  trainerId,
  documentId = null,
  isDark = true,
  onClose,
  onSaved,
  initialRows,
  initialTitle,
  trainerNavChrome = null
}) {
  const mounted = useRef(false);
  const titleInputRef = useRef(null);
  const formulaInputRef = useRef(null);
  const cellEditRef = useRef(null);
  const editDraftRef = useRef('');
  const editingRef = useRef(null);
  const commitEditRef = useRef(() => {});
  const saveTimer = useRef(null);
  const canAutoSaveRef = useRef(false);
  const userEditedRef = useRef(false);
  const saveChainRef = useRef(Promise.resolve());
  const sheetsRef = useRef([]);
  const gridRef = useRef(null);
  const activeIdRef = useRef('');
  const docIdRef = useRef(documentId || null);
  const performSaveRef = useRef(null);
  const [themeMode, setThemeMode] = useState(isDark ? 'dark' : 'light');
  const isSheetDark = themeMode === 'dark';
  const theme = useMemo(() => getEditorTheme(isSheetDark), [isSheetDark]);
  const [title, setTitle] = useState(initialTitle || '');
  const [titleFocused, setTitleFocused] = useState(false);
  const [docId, setDocId] = useState(documentId || null);
  const [favorite, setFavorite] = useState(false);
  const [status, setStatus] = useState('saved');
  const [lastSaved, setLastSaved] = useState(now());
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [sheets, setSheets] = useState(() => [newSheet(1)]);
  const [activeId, setActiveId] = useState(() => sheets[0]?.id);
  const [selection, setSelection] = useState({
    anchor: {
      r: 0,
      c: 0
    },
    focus: {
      r: 0,
      c: 0
    }
  });
  const [editing, setEditing] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [dimRevision, setDimRevision] = useState(0);
  const [cellEditBoot, setCellEditBoot] = useState('');
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [openSheet, setOpenSheet] = useState(null);
  const [contextSheet, setContextSheet] = useState(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState('');
  const [replaceQ, setReplaceQ] = useState('');
  const [renameSheetId, setRenameSheetId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [sharedWith, setSharedWith] = useState([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  useEffect(() => {
    if (!editing) return undefined;
    const scrollFrameId = requestAnimationFrame(() => {
      gridRef.current?.scrollToRow(editing.r);
    });
    return () => cancelAnimationFrame(scrollFrameId);
  }, [editing?.r, editing?.c]);
  const showToast = useCallback(msg => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), TOAST_VISIBLE_MS);
  }, []);
  useEffect(() => {
    sheetsRef.current = sheets;
  }, [sheets]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    docIdRef.current = docId;
  }, [docId]);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  useEffect(() => {
    if (!visible) return;
    mounted.current = true;
    return () => {
      if (canAutoSaveRef.current && trainerId) void performSaveRef.current?.({
        force: true
      });
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [visible, trainerId]);
  useEffect(() => {
    if (visible) setThemeMode(isDark ? 'dark' : 'light');
  }, [visible, isDark]);
  const active = sheets.find(s => s.id === activeId) ?? sheets[0];
  const pushHistory = useCallback(() => {
    const snapshot = sheetsRef.current;
    const aid = activeIdRef.current;
    setHistory(h => [...h.slice(-HISTORY_KEEP_COUNT), {
      sheets: JSON.parse(JSON.stringify(snapshot)),
      activeId: aid
    }]);
    setFuture([]);
  }, []);
  const undo = useCallback(() => {
    setHistory(h => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setFuture(f => [...f, {
        sheets: JSON.parse(JSON.stringify(sheets)),
        activeId
      }]);
      setSheets(last.sheets);
      setActiveId(last.activeId);
      userEditedRef.current = true;
      canAutoSaveRef.current = true;
      setStatus('unsaved');
      return h.slice(0, -1);
    });
  }, [sheets, activeId]);
  const redo = useCallback(() => {
    setFuture(f => {
      if (!f.length) return f;
      const next = f[f.length - 1];
      setHistory(h => [...h, {
        sheets: JSON.parse(JSON.stringify(sheets)),
        activeId
      }]);
      setSheets(next.sheets);
      setActiveId(next.activeId);
      userEditedRef.current = true;
      canAutoSaveRef.current = true;
      setStatus('unsaved');
      return f.slice(0, -1);
    });
  }, [sheets, activeId]);
  const displayCache = useMemo(() => prepareCellText(active?.cells), [active?.cells]);
  const setCell = useCallback((r, c, raw) => {
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    pushHistory();
    setSheets(prev => {
      const next = prev.map(s => {
        if (s.id !== activeId) return s;
        const cells = {
          ...s.cells
        };
        const k = keyOf(r, c);
        const ex = cells[k];
        if (raw === '') {
          if (ex) delete cells[k];
        } else {
          cells[k] = {
            ...(ex ?? {
              raw: ''
            }),
            raw
          };
        }
        const {
          colWidths,
          rowHeights
        } = syncCellDims(cells, r, c, s.colWidths, s.rowHeights);
        return {
          ...s,
          cells,
          colWidths,
          rowHeights
        };
      });
      sheetsRef.current = next;
      return next;
    });
    setStatus('unsaved');
  }, [activeId, pushHistory]);
  const clearSel = useCallback(() => {
    pushHistory();
    const sel = normalizeSel(selection);
    setSheets(prev => prev.map(s => {
      if (s.id !== activeId) return s;
      const cells = {
        ...s.cells
      };
      for (let rowIndex = sel.r1; rowIndex <= sel.r2; rowIndex++) {
        for (let columnIndex = sel.c1; columnIndex <= sel.c2; columnIndex++) delete cells[keyOf(rowIndex, columnIndex)];
      }
      const {
        colWidths,
        rowHeights
      } = syncDimsForRange(cells, s.colWidths, s.rowHeights, sel.r1, sel.r2, sel.c1, sel.c2);
      return {
        ...s,
        cells,
        colWidths,
        rowHeights
      };
    }));
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    setStatus('unsaved');
  }, [activeId, pushHistory, selection]);
  const toggleStyle = useCallback((styleKey) => {
    pushHistory();
    const sel = normalizeSel(selection);
    setSheets((prev) =>
      prev.map((sheet) => {
        if (sheet.id !== activeId) return sheet;
        return sheetWithToggledStyle(sheet, sel, styleKey);
      }),
    );
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    setStatus('unsaved');
  }, [activeId, pushHistory, selection]);
  const applyFormat = useCallback((fmt, currency) => {
    pushHistory();
    const sel = normalizeSel(selection);
    setSheets((prev) =>
      prev.map((sheet) => {
        if (sheet.id !== activeId) return sheet;
        return sheetWithFormat(sheet, sel, fmt, currency);
      }),
    );
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    setStatus('unsaved');
    showToast(`Formatted as ${fmt}`);
  }, [activeId, pushHistory, selection, showToast]);
  const applyAlign = useCallback((align) => {
    pushHistory();
    const sel = normalizeSel(selection);
    setSheets((prev) =>
      prev.map((sheet) => {
        if (sheet.id !== activeId) return sheet;
        return sheetWithAlign(sheet, sel, align);
      }),
    );
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    setStatus('unsaved');
  }, [activeId, pushHistory, selection]);
  const shiftCells = useCallback((kind, at, delta) => {
    pushHistory();
    setSheets((prev) =>
      prev.map((sheet) => {
        if (sheet.id !== activeId) return sheet;
        return sheetWithShiftedCells(sheet, kind, at, delta);
      }),
    );
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    setStatus('unsaved');
  }, [activeId, pushHistory]);
  const doCopy = useCallback(async () => {
    const sel = normalizeSel(selection);
    const lines = [];
    for (let rowIndex = sel.r1; rowIndex <= sel.r2; rowIndex++) {
      const row = [];
      for (let columnIndex = sel.c1; columnIndex <= sel.c2; columnIndex++) row.push(active?.cells?.[keyOf(rowIndex, columnIndex)]?.raw ?? '');
      lines.push(row.join('\t'));
    }
    try {
      await Clipboard.setStringAsync(lines.join('\n'));
      showToast('Copied');
    } catch {
      showToast('Copy failed');
    }
  }, [active?.cells, selection, showToast]);
  const doCut = useCallback(() => {
    doCopy();
    clearSel();
  }, [doCopy, clearSel]);
  const doPaste = useCallback(async () => {
    try {
      const txt = await Clipboard.getStringAsync();
      if (!txt) return;
      pushHistory();
      const lines = txt.replace(/\r/g, '').split('\n');
      if (lines.length && lines[lines.length - 1] === '') lines.pop();
      const sel = normalizeSel(selection);
      let pasteR2 = sel.r1;
      let pasteC2 = sel.c1;
      setSheets(prev => prev.map(s => {
        if (s.id !== activeId) return s;
        const cells = {
          ...s.cells
        };
        lines.forEach((line, ri) => {
          line.split('\t').forEach((val, ci) => {
            const rowIndex = sel.r1 + ri;
            const columnIndex = sel.c1 + ci;
            if (rowIndex >= ROWS || columnIndex >= COLS) return;
            pasteR2 = Math.max(pasteR2, rowIndex);
            pasteC2 = Math.max(pasteC2, columnIndex);
            const k = keyOf(rowIndex, columnIndex);
            const ex = cells[k] ?? {
              raw: ''
            };
            const det = detectFormat(val);
            if (det) {
              cells[k] = {
                ...ex,
                raw: det.normalized,
                format: det.format,
                currency: det.currency ?? ex.currency
              };
            } else cells[k] = {
              ...ex,
              raw: val
            };
          });
        });
        const {
          colWidths,
          rowHeights
        } = syncDimsForRange(cells, s.colWidths, s.rowHeights, sel.r1, pasteR2, sel.c1, pasteC2);
        return {
          ...s,
          cells,
          colWidths,
          rowHeights
        };
      }));
      userEditedRef.current = true;
      canAutoSaveRef.current = true;
      setStatus('unsaved');
      showToast('Pasted');
    } catch {
      showToast('Clipboard unavailable');
    }
  }, [activeId, pushHistory, selection, showToast]);
  const startEdit = useCallback((r, c, seed, via = 'cell') => {
    const cell = active?.cells?.[keyOf(r, c)];
    const value = String(seed ?? cell?.raw ?? '');
    editDraftRef.current = value;
    setEditDraft(value);
    setCellEditBoot(value);
    const next = {
      r,
      c,
      via
    };
    editingRef.current = next;
    setEditing(next);
    setSelection({
      anchor: {
        r,
        c
      },
      focus: {
        r,
        c
      }
    });
    requestAnimationFrame(() => {
      if (via === 'formula') formulaInputRef.current?.focus();else cellEditRef.current?.focus();
    });
  }, [active?.cells]);
  const commitEdit = useCallback((moveR = 0, moveC = 0) => {
    const cur = editingRef.current;
    if (!cur) return;
    setCell(cur.r, cur.c, editDraftRef.current);
    const nr = Math.max(0, Math.min(ROWS - 1, cur.r + moveR));
    const nc = Math.max(0, Math.min(COLS - 1, cur.c + moveC));
    setSelection({
      anchor: {
        r: nr,
        c: nc
      },
      focus: {
        r: nr,
        c: nc
      }
    });
    editingRef.current = null;
    setEditing(null);
    setEditDraft('');
  }, [setCell]);
  const cancelEdit = useCallback(() => {
    editingRef.current = null;
    setEditing(null);
    setEditDraft('');
  }, []);
  useEffect(() => {
    commitEditRef.current = commitEdit;
  }, [commitEdit]);
  const syncDraftDims = useCallback((r, c, text) => {
    const draft = {
      r,
      c,
      text
    };
    setSheets(prev => prev.map(s => {
      if (s.id !== activeId) return s;
      const {
        colWidths,
        rowHeights
      } = syncCellDims(s.cells, r, c, s.colWidths, s.rowHeights, draft);
      return {
        ...s,
        colWidths,
        rowHeights
      };
    }));
    setDimRevision(n => n + 1);
  }, [activeId]);
  const onFormulaChange = useCallback(v => {
    editDraftRef.current = v;
    setEditDraft(v);
    const {
      r,
      c
    } = selection.focus;
    syncDraftDims(r, c, v);
    if (!editing) startEdit(selection.focus.r, selection.focus.c, v, 'formula');
  }, [editing, selection.focus.c, selection.focus.r, startEdit, syncDraftDims]);
  const onCellDraftChange = useCallback(v => {
    editDraftRef.current = v;
    if (editing) syncDraftDims(editing.r, editing.c, v);
  }, [editing, syncDraftDims]);
  const onCellPress = useCallback((r, c) => {
    const cell = active?.cells?.[keyOf(r, c)];
    if (cell?.format === 'checkbox') {
      if (editing) commitEdit(0, 0);
      const checked = String(cell.raw).toLowerCase() === 'true' || cell.raw === '1';
      setCell(r, c, checked ? 'false' : 'true');
      setSelection({
        anchor: {
          r,
          c
        },
        focus: {
          r,
          c
        }
      });
      return;
    }
    if (editing?.r === r && editing?.c === c) {
      if (editing.via !== 'cell') {
        const next = {
          r,
          c,
          via: 'cell'
        };
        editingRef.current = next;
        setEditing(next);
        requestAnimationFrame(() => cellEditRef.current?.focus());
      } else {
        cellEditRef.current?.focus();
      }
      return;
    }
    if (editing) commitEdit(0, 0);
    startEdit(r, c, undefined, 'cell');
  }, [active?.cells, commitEdit, editing, setCell, startEdit]);
  const stats = useMemo(() => {
    const sel = normalizeSel(selection);
    return computeSelectionStats(displayCache, sel);
  }, [displayCache, selection]);
  const sortRange = useCallback((dir) => {
    pushHistory();
    const sel = normalizeSel(selection);
    setSheets((prev) =>
      prev.map((sheet) => {
        if (sheet.id !== activeId) return sheet;
        return sheetWithSortedRange(sheet, sel, dir);
      }),
    );
    showToast(`Sorted ${dir === 'asc' ? 'A→Z' : 'Z→A'}`);
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    setStatus('unsaved');
  }, [activeId, pushHistory, selection, showToast]);
  const doReplace = useCallback((replaceAll) => {
    if (!findQ) return;
    pushHistory();
    setSheets((prev) =>
      prev.map((sheet) => {
        if (sheet.id !== activeId) return sheet;
        const result = sheetWithFindReplace(sheet, findQ, replaceQ, replaceAll);
        showToast(`Replaced ${result.replaceCount}`);
        return result.sheet;
      }),
    );
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    setStatus('unsaved');
  }, [activeId, findQ, pushHistory, replaceQ, showToast]);
  const downloadAs = useCallback(async (kind) => {
    let content = '';
    let mime = 'text/plain';
    let ext = kind;
    if (kind === 'csv') {
      mime = 'text/csv';
      content = buildCsvFromCells(active?.cells || {});
    } else {
      mime = 'application/json';
      ext = 'json';
      content = JSON.stringify({ title, sheets }, null, 2);
    }
    try {
      const fileName = `${saveTitle(title).replace(/[^a-z0-9_-]/gi, '_')}.${ext}`;
      const path = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(path, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: mime,
          dialogTitle: `Export ${ext.toUpperCase()}`,
        });
      }
      showToast(`Exported ${ext.toUpperCase()}`);
    } catch (error) {
      Alert.alert('Export failed', error?.message || 'Could not export file.');
    }
  }, [active?.cells, sheets, title, showToast]);
  const ensureDocId = useCallback(() => {
    if (docIdRef.current) return docIdRef.current;
    if (!trainerId || !db) return null;
    const id = doc(collection(db, 'users', String(trainerId), 'documents')).id;
    docIdRef.current = id;
    setDocId(id);
    return id;
  }, [trainerId]);
  const performSave = useCallback(async ({
    syncClientStubs = false,
    force = false
  } = {}) => {
    if (!trainerId || !mounted.current || !canAutoSaveRef.current) return null;

    const run = async () => {
      if (!mounted.current || !trainerId) return null;

      // Still typing in a cell — wait, unless caller forced a flush (back/share).
      if (editingRef.current && !force) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void performSaveRef.current?.({ syncClientStubs });
        }, DEFER_SAVE_WHILE_EDITING_MS);
        return null;
      }
      if (editingRef.current) commitEditRef.current(0, 0);

      // 1. Make sure we have a Firestore document id.
      const id = ensureDocId();
      setStatus('saving');

      // 2. Write the sheet payload; mark saved or bounce back to unsaved.
      return writeSpreadsheetSave({
        trainerId,
        documentId: id,
        title,
        favorite,
        syncClientStubs,
        sheetsSnapshot: sheetsRef.current,
        mountedRef: mounted,
        docIdRef,
        setDocId,
        setLastSaved,
        setStatus,
        onSaved,
      });
    };

    saveChainRef.current = saveChainRef.current.then(run, run);
    return saveChainRef.current;
  }, [trainerId, onSaved, ensureDocId, title, favorite]);
  performSaveRef.current = performSave;
  const queueSave = useCallback(() => {
    if (!trainerId) return;
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    setStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => performSave(), AUTOSAVE_DEBOUNCE_MS);
  }, [trainerId, performSave]);
  useEffect(() => {
    if (!visible || !canAutoSaveRef.current || !userEditedRef.current || editing) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => performSave(), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [sheets, favorite, title, visible, performSave, editing]);
  useEffect(() => {
    if (!visible) return;
    userEditedRef.current = false;
    canAutoSaveRef.current = false;
    setDocId(documentId || null);
    setStatus(documentId ? 'saved' : 'idle');
    setFavorite(false);
    setHistory([]);
    setFuture([]);
    setSelection({
      anchor: {
        r: 0,
        c: 0
      },
      focus: {
        r: 0,
        c: 0
      }
    });
    setEditing(null);
    setEditDraft('');
    setSheets([newSheet(1)]);
    setActiveId(prev => prev);
    if (documentId && trainerId && !initialRows) {
      setLoading(true);
      getTrainerDocument(trainerId, documentId).then(docData => {
        if (!mounted.current || !docData) return;
        setTitle(docData.title && docData.title !== DEFAULT_SAVE_TITLE_SPREADSHEET ? docData.title : '');
        setFavorite(!!docData.isFavorite);
        setSharedWith(Array.isArray(docData.sharedWith) ? docData.sharedWith : []);
        const loaded = firestoreToSheets(docData);
        setSheets(loaded);
        setActiveId(loaded[0]?.id);
        setStatus('saved');
        setLastSaved(now());
        canAutoSaveRef.current = true;
      }).catch(() => {}).finally(() => mounted.current && setLoading(false));
    } else if (initialRows?.length) {
      const loaded = firestoreToSheets({
        rows: initialRows
      });
      setSheets(loaded);
      setActiveId(loaded[0]?.id);
      setTitle(initialTitle || '');
      setStatus(documentId ? 'saved' : 'idle');
      setLastSaved(now());
      canAutoSaveRef.current = !!documentId;
    } else {
      const freshSheetList = [newSheet(1)];
      setSheets(freshSheetList);
      setActiveId(freshSheetList[0].id);
      setTitle(initialTitle || '');
      setStatus('idle');
      setLastSaved(now());
      canAutoSaveRef.current = false;
    }
  }, [visible, documentId, trainerId, initialRows, initialTitle]);
  const handleBackPress = useCallback(() => {
    if (status === 'unsaved' || status === 'saving') {
      Alert.alert('Unsaved changes', 'Leave without saving?', [{
        text: 'Cancel',
        style: 'cancel'
      }, {
        text: 'Leave',
        style: 'destructive',
        onPress: onClose
      }]);
      return;
    }
    onClose();
  }, [status, onClose]);
  const handleSharePress = useCallback(() => {
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    performSave({
      syncClientStubs: true,
      force: true
    }).then(savedId => {
      if (!savedId) {
        Alert.alert('Save first', 'Add content so the spreadsheet saves before sharing.');
        return;
      }
      setShowShare(true);
    }).catch(() => {});
  }, [performSave]);
  const handleDuplicate = useCallback(async () => {
    if (!trainerId) return;
    try {
      setStatus('saving');
      const payload = sheetsToFirestore(sheetsRef.current);
      const res = await saveTrainerSpreadsheet(trainerId, {
        title: `${saveTitle(title)} (copy)`,
        rows: payload.rows,
        columnCount: payload.columnCount,
        rowCount: payload.rowCount,
        formats: payload.formats,
        colWidths: payload.colWidths,
        rowHeights: payload.rowHeights,
        sheets: payload.sheets,
        isFavorite: favorite
      });
      if (res?.id) {
        docIdRef.current = res.id;
        setDocId(res.id);
      }
      setStatus('saved');
      setLastSaved(now());
      onSaved?.();
      showToast('Duplicated');
    } catch (e) {
      setStatus('unsaved');
      Alert.alert('Duplicate failed', e?.message || 'Could not duplicate spreadsheet.');
    }
  }, [trainerId, title, favorite, onSaved, showToast]);
  const handleDelete = useCallback(() => {
    if (!trainerId || !docId) {
      Alert.alert('Save first', 'Save the spreadsheet before deleting.');
      return;
    }
    Alert.alert('Delete spreadsheet?', 'This cannot be undone.', [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          await deleteDoc(doc(db, 'users', String(trainerId), 'documents', String(docId)));
          onClose();
          onSaved?.();
        } catch (e) {
          Alert.alert('Delete failed', e?.message || 'Could not delete.');
        }
      }
    }]);
  }, [trainerId, docId, onClose, onSaved]);
  const sel = normalizeSel(selection);
  const focusCell = active?.cells?.[keyOf(selection.focus.r, selection.focus.c)];
  const focusDisp = lookupDisplay(displayCache, selection.focus.r, selection.focus.c);
  const formulaBarValue = editing?.via === 'formula' ? editDraft : String(focusCell?.raw ?? '');
  const menuSections = useMemo(() => ({
    file: {
      label: 'File',
      items: [{
        label: 'Download CSV',
        run: () => downloadAs('csv')
      }, {
        label: 'Download JSON',
        run: () => downloadAs('json')
      }, {
        label: 'Duplicate',
        run: handleDuplicate
      }, {
        label: 'Delete',
        run: handleDelete,
        destructive: true
      }]
    },
    edit: {
      label: 'Edit',
      items: [{
        label: 'Undo',
        shortcut: '⌘Z',
        run: undo
      }, {
        label: 'Redo',
        shortcut: '⌘Y',
        run: redo
      }, {
        label: 'Cut',
        shortcut: '⌘X',
        run: doCut
      }, {
        label: 'Copy',
        shortcut: '⌘C',
        run: doCopy
      }, {
        label: 'Paste',
        shortcut: '⌘V',
        run: doPaste
      }, {
        label: 'Find & replace',
        shortcut: '⌘H',
        run: () => setFindOpen(true)
      }]
    },
    view: {
      label: 'View',
      items: [{
        label: `Theme: ${isSheetDark ? 'Dark' : 'Light'}`,
        run: () => setThemeMode(t => t === 'dark' ? 'light' : 'dark')
      }]
    },
    insert: {
      label: 'Insert',
      items: [{
        label: 'Row above',
        run: () => shiftCells('row', sel.r1, 1)
      }, {
        label: 'Row below',
        run: () => shiftCells('row', sel.r1 + 1, 1)
      }, {
        label: 'Column left',
        run: () => shiftCells('col', sel.c1, 1)
      }, {
        label: 'Column right',
        run: () => shiftCells('col', sel.c1 + 1, 1)
      }]
    },
    format: {
      label: 'Format',
      items: [{
        label: 'Bold',
        shortcut: '⌘B',
        run: () => toggleStyle('bold')
      }, {
        label: 'Italic',
        shortcut: '⌘I',
        run: () => toggleStyle('italic')
      }, {
        label: 'Underline',
        shortcut: '⌘U',
        run: () => toggleStyle('underline')
      }, {
        label: 'Currency',
        run: () => applyFormat('currency', '$')
      }, {
        label: 'Percent',
        run: () => applyFormat('percent')
      }, {
        label: 'Checkbox',
        run: () => applyFormat('checkbox')
      }]
    },
    data: {
      label: 'Data',
      items: [{
        label: 'Sort A→Z',
        run: () => sortRange('asc')
      }, {
        label: 'Sort Z→A',
        run: () => sortRange('desc')
      }]
    }
  }), [applyFormat, doCopy, doCut, doPaste, downloadAs, handleDuplicate, handleDelete, isSheetDark, sel, shiftCells, sortRange, toggleStyle, undo, redo]);
  const promptRenameSheet = sheet => {
    if (Alert.prompt) {
      Alert.prompt('Rename sheet', undefined, [{
        text: 'Cancel',
        style: 'cancel'
      }, {
        text: 'Rename',
        onPress: n => {
          if (!n?.trim()) return;
          pushHistory();
          setSheets(prev => prev.map(x => x.id === sheet.id ? {
            ...x,
            name: n.trim()
          } : x));
          queueSave();
        }
      }], 'plain-text', sheet.name);
    } else {
      setRenameSheetId(sheet.id);
      setRenameValue(sheet.name);
    }
  };
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBackPress}>
      <SafeAreaView style={{
      flex: 1,
      backgroundColor: theme.canvasBg
    }} edges={SHELL_SAFE_AREA_EDGES}>
          {trainerNavChrome ? <TopHeader title="Spreadsheet" skipTopSafeInset appearanceIsDark={isSheetDark} onBack={handleBackPress} onProfilePress={trainerNavChrome.onProfilePress} onSettingsPress={trainerNavChrome.onSettingsPress} /> : <View style={[styles.backRow, {
        backgroundColor: theme.headerBg
      }]}>
              <TouchableOpacity onPress={handleBackPress} style={styles.headerBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>}

          <View style={[styles.titleSection, {
        backgroundColor: theme.headerBg,
        borderBottomColor: theme.border
      }]}>
            <EditorTitleField inputRef={titleInputRef} value={title} onChangeText={t => {
          userEditedRef.current = true;
          canAutoSaveRef.current = true;
          setTitle(t);
          setStatus('unsaved');
        }} onFocus={() => setTitleFocused(true)} onBlur={() => setTitleFocused(false)} focused={titleFocused} theme={theme} />
            <View style={styles.metaRow}>
              <SaveStatusLabel status={status} theme={theme} />
              <SavedAgoLabel at={lastSaved} theme={theme} />
              <View style={{
            flex: 1
          }} />
              <EditorIconButton icon="share-outline" onPress={handleSharePress} theme={theme} accessibilityLabel="Share" />
              <EditorIconButton icon={favorite ? 'star' : 'star-outline'} onPress={() => {
            setFavorite(v => !v);
            queueSave();
          }} theme={theme} active={favorite} accessibilityLabel="Favorite" />
              <EditorIconButton icon={isSheetDark ? 'sunny-outline' : 'moon-outline'} onPress={() => setThemeMode(t => t === 'dark' ? 'light' : 'dark')} theme={theme} accessibilityLabel="Toggle theme" />
              <TouchableOpacity onPress={() => setOpenSheet('menu')} style={styles.menuBtn} accessibilityLabel="Menu">
                <Ionicons name="menu" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.toolbar, {
        backgroundColor: theme.toolbarBg,
        borderBottomColor: theme.border
      }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarRow}>
              <ToolBtn theme={theme} label="Undo" disabled={!history.length} onPress={undo}>
                <Ionicons name="arrow-undo-outline" size={18} color={theme.textMuted} />
              </ToolBtn>
              <ToolBtn theme={theme} label="Redo" disabled={!future.length} onPress={redo}>
                <Ionicons name="arrow-redo-outline" size={18} color={theme.textMuted} />
              </ToolBtn>
              <Divider theme={theme} />
              <ToolBtn theme={theme} label="Add row" onPress={() => shiftCells('row', sel.r1 + 1, 1)}>
                <Ionicons name="add-circle-outline" size={18} color={theme.textMuted} />
              </ToolBtn>
              <ToolBtn theme={theme} label="Remove row" onPress={() => shiftCells('row', sel.r1, -1)}>
                <Ionicons name="remove-circle-outline" size={18} color={theme.textMuted} />
              </ToolBtn>
              <ToolBtn theme={theme} label="Add column" onPress={() => shiftCells('col', sel.c1 + 1, 1)}>
                <MaterialIcons name="view-column" size={18} color={theme.textMuted} />
              </ToolBtn>
              <ToolBtn theme={theme} label="Remove column" onPress={() => shiftCells('col', sel.c1, -1)}>
                <MaterialIcons name="delete-outline" size={18} color={theme.textMuted} />
              </ToolBtn>
              <Divider theme={theme} />
              <ToolBtn theme={theme} label="Bold" active={!!focusCell?.style?.bold} onPress={() => toggleStyle('bold')}>
                <Text style={{
              fontWeight: '900',
              color: theme.text
            }}>B</Text>
              </ToolBtn>
              <ToolBtn theme={theme} label="Italic" active={!!focusCell?.style?.italic} onPress={() => toggleStyle('italic')}>
                <Text style={{
              fontStyle: 'italic',
              fontWeight: '800',
              color: theme.text
            }}>I</Text>
              </ToolBtn>
              <ToolBtn theme={theme} label="Underline" active={!!focusCell?.style?.underline} onPress={() => toggleStyle('underline')}>
                <Text style={{
              textDecorationLine: 'underline',
              fontWeight: '800',
              color: theme.text
            }}>U</Text>
              </ToolBtn>
              <Divider theme={theme} />
              <ToolBtn theme={theme} label="Currency" onPress={() => applyFormat('currency', '$')}>
                <Text style={{
              fontWeight: '800',
              color: theme.textMuted
            }}>$</Text>
              </ToolBtn>
              <ToolBtn theme={theme} label="Percent" onPress={() => applyFormat('percent')}>
                <Text style={{
              fontWeight: '800',
              color: theme.textMuted
            }}>%</Text>
              </ToolBtn>
              <ToolBtn theme={theme} label="Checkbox" onPress={() => applyFormat('checkbox')}>
                <Ionicons name="checkbox-outline" size={18} color={theme.textMuted} />
              </ToolBtn>
              <Divider theme={theme} />
              <ToolBtn theme={theme} label="Find" onPress={() => setFindOpen(true)}>
                <Ionicons name="search-outline" size={18} color={theme.textMuted} />
              </ToolBtn>
              <ToolBtn theme={theme} label="More" onPress={() => setOpenSheet('more')}>
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
              </ToolBtn>
            </ScrollView>
          </View>

          <View style={{
        flex: 1
      }}>
          <FormulaBar theme={theme} focusR={selection.focus.r} focusC={selection.focus.c} value={formulaBarValue} editing={!!editing} focusError={focusDisp.error} inputRef={formulaInputRef} onChangeText={onFormulaChange} onCommit={commitEdit} onCancel={cancelEdit} onBeginEdit={() => {
          setEditDraft(editDraftRef.current);
          if (!editing) {
            startEdit(selection.focus.r, selection.focus.c, focusCell?.raw ?? '', 'formula');
          } else if (editing.via !== 'formula') {
            const next = {
              r: editing.r,
              c: editing.c,
              via: 'formula'
            };
            editingRef.current = next;
            setEditing(next);
          }
        }} />

          <View style={{
          flex: 1,
          backgroundColor: theme.pageBg
        }}>
            {loading ? <View style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
                <ActivityIndicator size="large" color={theme.selectionBorder} />
              </View> : <SpreadsheetGrid ref={gridRef} theme={theme} cells={active?.cells ?? {}} displayCache={displayCache} colWidths={active?.colWidths} rowHeights={active?.rowHeights} dimRevision={dimRevision} selection={selection} editing={editing} editSeed={cellEditBoot} editVia={editing?.via ?? 'cell'} cellEditRef={cellEditRef} onCellPress={onCellPress} onCellLongPress={() => setContextSheet('context')} onCellDraftChange={onCellDraftChange} onCellEditCommit={commitEdit} onColHeaderPress={c => setSelection({
            anchor: {
              r: 0,
              c
            },
            focus: {
              r: ROWS - 1,
              c
            }
          })} onColHeaderLongPress={() => setOpenSheet('more')} onRowHeaderPress={r => setSelection({
            anchor: {
              r,
              c: 0
            },
            focus: {
              r,
              c: COLS - 1
            }
          })} onRowHeaderLongPress={() => setOpenSheet('more')} />}
            {stats && !keyboardVisible ? <LinearGradient colors={theme.sheetGradient} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }} style={styles.statsChip}>
                {stats.hasNums ? <StatChip label="Sum" val={formatNumberNice(stats.sum)} onPress={() => Clipboard.setStringAsync(String(stats.sum)).then(() => showToast('Copied'))} /> : null}
                {stats.avg !== null ? <StatChip label="Avg" val={formatNumberNice(stats.avg)} onPress={() => Clipboard.setStringAsync(String(stats.avg)).then(() => showToast('Copied'))} /> : null}
                <StatChip label="Count" val={String(stats.count)} onPress={() => Clipboard.setStringAsync(String(stats.count)).then(() => showToast('Copied'))} />
              </LinearGradient> : null}
          </View>
          </View>

          {!keyboardVisible ? <View style={[styles.sheetTabs, {
        backgroundColor: theme.headerBg,
        borderTopColor: theme.border
      }]}>
            <TouchableOpacity onPress={() => {
          pushHistory();
          const createdSheet = newSheet(sheets.length + 1);
          setSheets(s => [...s, createdSheet]);
          setActiveId(createdSheet.id);
          queueSave();
        }} style={styles.addSheetBtn}>
              <Ionicons name="add" size={18} color={theme.textMuted} />
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{
          alignItems: 'center',
          gap: 6
        }}>
              {sheets.map(s => {
            const isActive = s.id === activeId;
            return <TouchableOpacity key={s.id} onPress={() => setActiveId(s.id)} onLongPress={() => promptRenameSheet(s)} delayLongPress={400}>
                    {isActive ? <LinearGradient colors={theme.sheetGradient} start={{
                x: 0,
                y: 0
              }} end={{
                x: 1,
                y: 1
              }} style={styles.sheetTabActive}>
                        <Text style={styles.sheetTabActiveText}>{s.name}</Text>
                      </LinearGradient> : <View style={[styles.sheetTab, {
                backgroundColor: theme.inputBg
              }]}>
                        <Text style={{
                  color: theme.textMuted,
                  fontSize: 12,
                  fontWeight: '700'
                }}>{s.name}</Text>
                      </View>}
                  </TouchableOpacity>;
          })}
            </ScrollView>
          </View> : null}

          {toastMsg ? <View style={styles.toast}>
              <Text style={styles.toastText}>{toastMsg}</Text>
            </View> : null}

          <SlideUpMenu visible={openSheet === 'menu'} onClose={() => setOpenSheet(null)} title="Menu" theme={theme}>
            {Object.entries(menuSections).map(([key, m]) => <View key={key}>
                <Text style={[styles.menuSection, {
            color: theme.textMuted
          }]}>{m.label}</Text>
                {m.items.map((it, i) => <SheetMenuItem key={i} label={it.label} shortcut={it.shortcut} theme={theme} onPress={() => {
            it.run?.();
            setOpenSheet(null);
          }} />)}
              </View>)}
          </SlideUpMenu>

          <SlideUpMenu visible={openSheet === 'more'} onClose={() => setOpenSheet(null)} title="More" theme={theme}>
            <SheetMenuItem theme={theme} label="Align left" onPress={() => {
          applyAlign('left');
          setOpenSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Align center" onPress={() => {
          applyAlign('center');
          setOpenSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Align right" onPress={() => {
          applyAlign('right');
          setOpenSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Sort A → Z" onPress={() => {
          sortRange('asc');
          setOpenSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Sort Z → A" onPress={() => {
          sortRange('desc');
          setOpenSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Export CSV" onPress={() => {
          downloadAs('csv');
          setOpenSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Delete spreadsheet" onPress={() => {
          setOpenSheet(null);
          handleDelete();
        }} />
          </SlideUpMenu>

          <SlideUpMenu visible={contextSheet === 'context'} onClose={() => setContextSheet(null)} title="Cell actions" theme={theme}>
            <SheetMenuItem theme={theme} label="Copy" onPress={() => {
          doCopy();
          setContextSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Cut" onPress={() => {
          doCut();
          setContextSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Paste" onPress={() => {
          doPaste();
          setContextSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Delete" onPress={() => {
          clearSel();
          setContextSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Format as currency" onPress={() => {
          applyFormat('currency', '$');
          setContextSheet(null);
        }} />
            <SheetMenuItem theme={theme} label="Format as percent" onPress={() => {
          applyFormat('percent');
          setContextSheet(null);
        }} />
          </SlideUpMenu>

          {findOpen ? <View style={[styles.findModal, {
        backgroundColor: theme.headerBg,
        borderColor: theme.border
      }]}>
              <View style={styles.findHeader}>
                <Text style={{
            color: theme.text,
            fontWeight: '700'
          }}>Find & replace</Text>
                <TouchableOpacity onPress={() => setFindOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
              <TextInput value={findQ} onChangeText={setFindQ} placeholder="Find" placeholderTextColor={theme.textMuted} style={[styles.findInput, {
          color: theme.text,
          borderColor: theme.border,
          backgroundColor: theme.inputBg
        }]} />
              <TextInput value={replaceQ} onChangeText={setReplaceQ} placeholder="Replace with" placeholderTextColor={theme.textMuted} style={[styles.findInput, {
          color: theme.text,
          borderColor: theme.border,
          backgroundColor: theme.inputBg
        }]} />
              <View style={styles.findActions}>
                <TouchableOpacity onPress={() => doReplace(false)} style={[styles.findBtn, {
            borderColor: theme.border
          }]}>
                  <Text style={{
              color: theme.text
            }}>Replace</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => doReplace(true)}>
                  <LinearGradient colors={theme.sheetGradient} start={{
              x: 0,
              y: 0
            }} end={{
              x: 1,
              y: 1
            }} style={styles.findBtnPrimary}>
                    <Text style={{
                color: '#fff',
                fontWeight: '700'
              }}>Replace all</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View> : null}

          {renameSheetId ? <View style={[styles.findModal, {
        backgroundColor: theme.headerBg,
        borderColor: theme.border
      }]}>
              <Text style={{
          color: theme.text,
          fontWeight: '700',
          marginBottom: 8
        }}>Rename sheet</Text>
              <TextInput value={renameValue} onChangeText={setRenameValue} style={[styles.findInput, {
          color: theme.text,
          borderColor: theme.border,
          backgroundColor: theme.inputBg
        }]} autoFocus />
              <View style={styles.findActions}>
                <TouchableOpacity onPress={() => setRenameSheetId(null)} style={[styles.findBtn, {
            borderColor: theme.border
          }]}>
                  <Text style={{
              color: theme.text
            }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
            if (renameValue.trim()) {
              pushHistory();
              setSheets(prev => prev.map(x => x.id === renameSheetId ? {
                ...x,
                name: renameValue.trim()
              } : x));
              queueSave();
            }
            setRenameSheetId(null);
          }}>
                  <LinearGradient colors={theme.sheetGradient} start={{
              x: 0,
              y: 0
            }} end={{
              x: 1,
              y: 1
            }} style={styles.findBtnPrimary}>
                    <Text style={{
                color: '#fff',
                fontWeight: '700'
              }}>Rename</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View> : null}

          <ShareDocumentPopup visible={showShare} onClose={() => setShowShare(false)} trainerId={trainerId} documentId={docId} initialSharedWith={sharedWith} isDark={isSheetDark} onSaved={() => {
        onSaved?.();
        if (trainerId && docId) {
          getTrainerDocument(trainerId, docId).then(d => {
            if (d && mounted.current) setSharedWith(Array.isArray(d.sharedWith) ? d.sharedWith : []);
          });
        }
      }} />

          {trainerNavChrome && !keyboardVisible ? <ShellBottomNavAnchor>
              <BottomMenuBar appearanceIsDark={isSheetDark} activeTabKey={trainerNavChrome.activeTabKey || 'files'} onHomePress={trainerNavChrome.onHomePress} onPlusPress={trainerNavChrome.onPlusPress} onVoicePress={trainerNavChrome.onVoicePress} onNutritionPress={trainerNavChrome.onNutritionPress} onWorkoutPress={trainerNavChrome.onWorkoutPress} onMessagesPress={trainerNavChrome.onMessagesPress} />
            </ShellBottomNavAnchor> : null}
        </SafeAreaView>
    </Modal>;
}
const styles = StyleSheet.create({
  backRow: {
    paddingHorizontal: 6,
    paddingTop: 4
  },
  titleSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4
  },
  headerBtn: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuBtn: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolbar: {
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  toolbarRow: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 2
  },
  toolBtn: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolBtnActive: {},
  divider: {
    width: 1,
    height: 22,
    marginHorizontal: 4
  },
  formulaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: TOUCH_MIN + 8
  },
  refPill: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center'
  },
  formulaInput: {
    flex: 1,
    minHeight: TOUCH_MIN,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined
  },
  statsChip: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  statLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11
  },
  statVal: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined
  },
  sheetTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TOUCH_MIN,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    gap: 6
  },
  addSheetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sheetTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999
  },
  sheetTabActive: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999
  },
  sheetTabActiveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  toast: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999
  },
  toastText: {
    color: '#fff',
    fontSize: 13
  },
  menuSection: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    textTransform: 'uppercase'
  },
  findModal: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    zIndex: 100
  },
  findHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  findInput: {
    height: TOUCH_MIN,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    fontSize: 14
  },
  findActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4
  },
  findBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1
  },
  findBtnPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999
  }
});