// Design Law spreadsheet viewer — NbPageHeader + HardShadow table (no green spinner).
// Flow: parent passes url or inline rows → fetch/parse → scrollable table → copy / share CSV.
// Used by client and trainer Notes & Files. Firebase storage URLs unchanged.

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NbPageHeader from '../../../look-and-feel/NbPageHeader';
import NbButton from '../../../look-and-feel/NbButton';
import HardShadow from '../../../look-and-feel/HardShadow';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { borderRadius, nb, spacing } from '../../../look-and-feel/colorPalette';
import XLSX from '../../../spreadsheet-support/spreadsheetReader';

// ===== NAMED CONSTANTS =====

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_PADDING = 10;
const MIN_CELL_WIDTH = 80;
const TABLE_SIDE_INSET = 32;
const LOAD_FAILED_MESSAGE = 'Could not load spreadsheet';
const DEFAULT_SHEET_TITLE = 'Spreadsheet';

// ===== HELPER FUNCTIONS =====

function emptyCsvParseState() {
  return { rows: [], row: [], cell: '', inQuotes: false };
}

function pushFinishedCell(state) {
  state.row.push(state.cell.trim());
  state.cell = '';
}

function rowHasAnyText(row) {
  return row.some((cellText) => cellText !== '');
}

function pushFinishedRowIfNotBlank(state) {
  if (rowHasAnyText(state.row)) state.rows.push(state.row);
  state.row = [];
}

function applyQuotedCsvChar(state, text, i) {
  const character = text[i];
  if (character !== '"') {
    state.cell += character;
    return i;
  }
  if (text[i + 1] === '"') {
    state.cell += '"';
    return i + 1;
  }
  state.inQuotes = false;
  return i;
}

function applyUnquotedCsvChar(state, text, i) {
  const character = text[i];
  if (character === '"') {
    state.inQuotes = true;
    return i;
  }
  if (character === ',' || character === '\t') {
    pushFinishedCell(state);
    if (character === '\t' && state.row.length === 1 && !state.cell) return i;
    return i;
  }
  if (character === '\n' || character === '\r') {
    let nextIndex = i;
    if (character === '\r' && text[i + 1] === '\n') nextIndex = i + 1;
    pushFinishedCell(state);
    pushFinishedRowIfNotBlank(state);
    return nextIndex;
  }
  state.cell += character;
  return i;
}

function finishLastCsvRow(state) {
  if (state.cell === '' && state.row.length === 0) return state.rows;
  pushFinishedCell(state);
  state.rows.push(state.row);
  return state.rows;
}

/**
 * Turn raw CSV/TSV text into a 2D array of strings.
 * Handles quoted fields and escaped quotes ("" inside quotes).
 * @param {string} text
 * @returns {string[][]}
 */
function parseCSV(text) {
  const state = emptyCsvParseState();
  for (let i = 0; i < text.length; i++) {
    if (state.inQuotes) {
      i = applyQuotedCsvChar(state, text, i);
      continue;
    }
    i = applyUnquotedCsvChar(state, text, i);
  }
  return finishLastCsvRow(state);
}

function rowsFromXlsxBuffer(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  // vocab: header: 1 = array of rows, not array of objects.
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
}

/**
 * Download the file and return rows[][]. CSV → text. XLSX → SheetJS.
 * @param {string} url
 * @param {string} filename
 * @returns {Promise<unknown[][]>}
 */
async function fetchSpreadsheetData(url, filename) {
  const isCsv = (filename || '').toLowerCase().endsWith('.csv');
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to load file');
  if (isCsv) {
    const text = await res.text();
    return parseCSV(text);
  }
  const arrayBuffer = await res.arrayBuffer();
  return rowsFromXlsxBuffer(arrayBuffer);
}

function padRowToColumnCount(row, columnCount) {
  const cells = Array.isArray(row) ? [...row] : [row];
  while (cells.length < columnCount) cells.push('');
  return cells.slice(0, columnCount);
}

function normalizeRows(raw) {
  const list = Array.isArray(raw) && raw.length ? raw : [];
  const columnCount = Math.max(0, ...list.map((row) => (Array.isArray(row) ? row.length : 1)));
  return list.map((row) => padRowToColumnCount(row, columnCount));
}

function rowHasVisibleText(row) {
  return row.some((cell) => String(cell ?? '').trim() !== '');
}

function csvCellText(cell) {
  const cellText = String(cell ?? '');
  if (/[",\n]/.test(cellText)) return `"${cellText.replace(/"/g, '""')}"`;
  return cellText;
}

function csvLineFromRow(row) {
  const cells = Array.isArray(row) ? row : [row];
  return cells.map(csvCellText).join(',');
}

function rowsToCsv(data) {
  return (data || []).map(csvLineFromRow).join('\n');
}

function compareSortValues(leftCell, rightCell) {
  const leftText = String(leftCell ?? '');
  const rightText = String(rightCell ?? '');
  const leftNumber = Number(leftText);
  const rightNumber = Number(rightText);
  const bothAreNumbers =
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    leftText.trim() !== '' &&
    rightText.trim() !== '';
  if (bothAreNumbers) return leftNumber - rightNumber;
  return leftText.localeCompare(rightText, undefined, { sensitivity: 'base' });
}

function sortedSpreadsheetRows(rows, sortCol, sortAsc) {
  if (!rows.length || sortCol == null || sortCol < 0) return rows;
  const header = rows[0];
  const body = rows.slice(1);
  const sorted = [...body].sort((leftRow, rightRow) => {
    const comparison = compareSortValues(leftRow[sortCol], rightRow[sortCol]);
    return sortAsc ? comparison : -comparison;
  });
  return [header, ...sorted];
}

function applyFetchedSpreadsheet(data, hasInlineRows, inlineRows, rowsProp, setters) {
  let raw = Array.isArray(data) && data.length ? data : [];
  if (!raw.length && hasInlineRows) {
    raw = rowsProp;
  }
  const normalized = normalizeRows(raw);
  if (!normalized.length) {
    setters.setError(LOAD_FAILED_MESSAGE);
  }
  setters.setRows(normalized);
  setters.setLoading(false);
}

function applyFetchFailure(error, hasInlineRows, inlineRows, setters) {
  if (hasInlineRows) {
    setters.setRows(inlineRows);
    setters.setError(null);
  } else {
    setters.setError(error?.message || LOAD_FAILED_MESSAGE);
    setters.setRows([]);
  }
  setters.setLoading(false);
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen read-only table for a CSV/XLSX url or inline rows.
 * Hooks stay in this order: rows, loading, error, sort column, sort direction, then the load effect.
 * @param {object} props
 */
export default function SpreadsheetViewer({
  visible,
  url,
  name,
  rows: rowsProp = null,
  isDark: _isDarkIgnored = true,
  onClose,
}) {
  const { colors: theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    if (!visible) {
      setRows([]);
      setError(null);
      setLoading(true);
      setSortCol(null);
      return;
    }

    const inlineRows = normalizeRows(rowsProp);
    const hasInlineRows = inlineRows.some(rowHasVisibleText);

    if (!url) {
      setRows(hasInlineRows ? inlineRows : []);
      setError(hasInlineRows ? null : LOAD_FAILED_MESSAGE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const setters = { setRows, setError, setLoading };

    fetchSpreadsheetData(url, name)
      .then((data) => {
        if (cancelled) return;
        applyFetchedSpreadsheet(data, hasInlineRows, inlineRows, rowsProp, setters);
      })
      .catch((caughtError) => {
        if (cancelled) return;
        applyFetchFailure(caughtError, hasInlineRows, inlineRows, setters);
      });

    return () => { cancelled = true; };
  }, [visible, url, name, rowsProp]);

  const displayRows = useMemo(
    () => sortedSpreadsheetRows(rows, sortCol, sortAsc),
    [rows, sortCol, sortAsc],
  );

  const handleCopy = async () => {
    // 1. Copy the visible table as CSV text.
    try {
      await Clipboard.setStringAsync(rowsToCsv(displayRows));
      Alert.alert('Copied', 'Table copied to clipboard as CSV.');
    } catch (caughtError) {
      Alert.alert('Copy failed', caughtError?.message || 'Could not copy');
    }
  };

  const handleShareCsv = async () => {
    // 1. Hand the CSV to the OS share sheet. Ignore a user-cancelled share.
    try {
      const csv = rowsToCsv(displayRows);
      await Share.share({
        message: csv,
        title: name || DEFAULT_SHEET_TITLE,
      });
    } catch (caughtError) {
      if (caughtError?.message && !/User did not share/i.test(caughtError.message)) {
        Alert.alert('Share failed', caughtError.message);
      }
    }
  };

  const handleHeaderSort = (columnIndex) => {
    if (sortCol === columnIndex) {
      setSortAsc((wasAscending) => !wasAscending);
      return;
    }
    setSortCol(columnIndex);
    setSortAsc(true);
  };

  const colCount = (displayRows[0] || []).length || 1;
  const tableWidth = Math.max(SCREEN_WIDTH - TABLE_SIDE_INSET, colCount * MIN_CELL_WIDTH);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.nbBackground }]}>
        <NbPageHeader title={name || DEFAULT_SHEET_TITLE} subtitle="Spreadsheet" onBack={onClose} />

        {!loading && !error && displayRows.length > 0 ? (
          <Text style={{ paddingHorizontal: nb.screenGutter, paddingBottom: 8, color: theme.nbMuted, fontSize: 12, fontWeight: '600' }}>
            Viewing in-app · tap a header cell to sort · copy or share as CSV
          </Text>
        ) : null}

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={theme.nbInk} />
              <Text style={[styles.loadingText, { color: theme.nbMuted }]}>Loading…</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.errorBlock}>
              <Text style={[styles.errorText, { color: theme.nbInk }]}>{error}</Text>
            </View>
          ) : null}
          {!loading && !error && displayRows.length > 0 ? (
            <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={{ flex: 1 }}>
              <View
                style={[
                  styles.tableShell,
                  { backgroundColor: theme.nbSurface, borderColor: theme.nbBorder },
                ]}
              >
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  horizontal
                  showsHorizontalScrollIndicator
                >
                  <ScrollView
                    style={styles.scrollVertical}
                    contentContainerStyle={[styles.scrollContentVertical, { width: tableWidth }]}
                    showsVerticalScrollIndicator
                  >
                    <View style={[styles.table, { borderColor: theme.nbBorder }]}>
                      {displayRows.map((row, rIndex) => (
                        <View
                          key={rIndex}
                          style={[
                            styles.row,
                            { borderBottomColor: theme.nbBorder },
                            rIndex === 0 && { backgroundColor: theme.nbSoft },
                            rIndex > 0 && rIndex % 2 === 0 && { backgroundColor: theme.nbSoft },
                          ]}
                        >
                          {(Array.isArray(row) ? row : [row]).map((cell, cIndex) => (
                            <TouchableOpacity
                              key={cIndex}
                              disabled={rIndex !== 0}
                              onPress={() => handleHeaderSort(cIndex)}
                              style={[styles.cell, { borderColor: theme.nbBorder }]}
                            >
                              <Text
                                style={[
                                  styles.cellText,
                                  { color: rIndex === 0 ? theme.nbInk : theme.nbMuted },
                                  rIndex === 0 && styles.headerText,
                                ]}
                                numberOfLines={2}
                              >
                                {cell != null && String(cell).trim() !== '' ? String(cell) : ''}
                                {rIndex === 0 && sortCol === cIndex ? (sortAsc ? ' ▲' : ' ▼') : ''}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </ScrollView>
              </View>
            </HardShadow>
          ) : null}
        </View>

        {!loading && !error && displayRows.length > 0 ? (
          <View
            style={[
              styles.actions,
              {
                borderTopColor: theme.nbBorder,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <NbButton variant="plain" onPress={handleCopy} style={styles.half}>
              Copy CSV
            </NbButton>
            <NbButton variant="plain" onPress={handleShareCsv} style={styles.half}>
              Share
            </NbButton>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: nb.screenGutter },
  loadingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15, fontWeight: '600' },
  errorBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 15, textAlign: 'center', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  scrollVertical: { flex: 1 },
  scrollContentVertical: { paddingBottom: 24 },
  tableShell: {
    flex: 1,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  table: {
    borderWidth: 0,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    minWidth: MIN_CELL_WIDTH,
    width: MIN_CELL_WIDTH,
    padding: CELL_PADDING,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cellText: { fontSize: 12, fontWeight: '500' },
  headerText: { fontWeight: '800' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: nb.screenGutter,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  half: { flex: 1 },
});
