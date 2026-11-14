// Spreadsheet viewer — NbPageHeader + HardShadow table (no green spinner).
// Flow: parent passes url or inline rows → fetch/parse → scrollable table → copy / share CSV.
// Used by client and trainer Notes & Files. Firebase storage URLs unchanged.
// Read order: constants → layout pieces → SpreadsheetViewer → styles → PLUMBING (CSV/XLSX).

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
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NbPageHeader from '../../../look-and-feel/NbPageHeader';
import NbButton from '../../../look-and-feel/NbButton';
import NbNoticeSheet from '../../../look-and-feel/NbNoticeSheet';
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
const HINT_LINE =
  'Viewing in-app · tap a header cell to sort · copy or share as CSV';

// ===== HELPER FUNCTIONS =====

function SpreadsheetLoadingBlock({ inkColor, mutedColor }) {
  return (
    <View style={styles.loadingBlock}>
      <ActivityIndicator size="large" color={inkColor} />
      <Text style={[styles.loadingText, { color: mutedColor }]}>Loading…</Text>
    </View>
  );
}

function SpreadsheetMessageShell({
  messageTitle,
  messageHint,
  colors,
  dashedBorder,
  children,
}) {
  let borderStyle = 'solid';
  if (dashedBorder) {
    borderStyle = 'dashed';
  }

  const shellStyle = [
    styles.emptyShell,
    {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder,
      borderStyle,
    },
  ];

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View style={shellStyle}>
        <Text style={[styles.errorText, { color: colors.nbInk }]}>{messageTitle}</Text>
        <Text style={[styles.emptyHint, { color: colors.nbMuted }]}>{messageHint}</Text>
        {children}
      </View>
    </HardShadow>
  );
}

function sortArrowForHeaderCell(isHeaderRow, sortCol, columnIndex, sortAsc) {
  if (!isHeaderRow) {
    return '';
  }
  if (sortCol !== columnIndex) {
    return '';
  }
  if (sortAsc) {
    return ' ▲';
  }
  return ' ▼';
}

function cellDisplayText(cell) {
  if (cell == null) {
    return '';
  }
  const asText = String(cell);
  if (asText.trim() === '') {
    return '';
  }
  return asText;
}

function backgroundColorForTableRow(isHeaderRow, isEvenBodyRow, softColor) {
  if (isHeaderRow) {
    return softColor;
  }
  if (isEvenBodyRow) {
    return softColor;
  }
  return undefined;
}

function textColorForTableCell(isHeaderRow, colors) {
  if (isHeaderRow) {
    return colors.nbInk;
  }
  return colors.nbMuted;
}

function SpreadsheetHeaderOrBodyCell({
  cell,
  columnIndex,
  isHeaderRow,
  colors,
  sortCol,
  sortAsc,
  onHeaderPress,
}) {
  const cellText = cellDisplayText(cell);
  const sortArrow = sortArrowForHeaderCell(isHeaderRow, sortCol, columnIndex, sortAsc);
  const textColor = textColorForTableCell(isHeaderRow, colors);
  const cellTextStyle = [
    styles.cellText,
    { color: textColor },
    isHeaderRow ? styles.headerText : null,
  ];

  return (
    <TouchableOpacity
      key={columnIndex}
      disabled={!isHeaderRow}
      onPress={() => onHeaderPress(columnIndex)}
      style={[styles.cell, { borderColor: colors.nbBorder }]}
    >
      <Text style={cellTextStyle} numberOfLines={2}>
        {cellText}
        {sortArrow}
      </Text>
    </TouchableOpacity>
  );
}

function cellsListFromRow(row) {
  if (Array.isArray(row)) {
    return row;
  }
  return [row];
}

function SpreadsheetTableRow({
  row,
  rowIndex,
  colors,
  sortCol,
  sortAsc,
  onHeaderPress,
}) {
  const isHeaderRow = rowIndex === 0;
  const isEvenBodyRow = rowIndex > 0 && rowIndex % 2 === 0;
  const rowCells = cellsListFromRow(row);
  const rowBackgroundColor = backgroundColorForTableRow(
    isHeaderRow,
    isEvenBodyRow,
    colors.nbSoft,
  );

  const rowStyle = [
    styles.row,
    { borderBottomColor: colors.nbBorder },
  ];
  if (rowBackgroundColor) {
    rowStyle.push({ backgroundColor: rowBackgroundColor });
  }

  return (
    <View style={rowStyle}>
      {rowCells.map((cell, columnIndex) => (
        <SpreadsheetHeaderOrBodyCell
          key={columnIndex}
          cell={cell}
          columnIndex={columnIndex}
          isHeaderRow={isHeaderRow}
          colors={colors}
          sortCol={sortCol}
          sortAsc={sortAsc}
          onHeaderPress={onHeaderPress}
        />
      ))}
    </View>
  );
}

function SpreadsheetDataTable({
  displayRows,
  tableWidth,
  colors,
  sortCol,
  sortAsc,
  onHeaderPress,
}) {
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={{ flex: 1 }}>
      <View
        style={[
          styles.tableShell,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
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
            <View style={[styles.table, { borderColor: colors.nbBorder }]}>
              {displayRows.map((row, rowIndex) => (
                <SpreadsheetTableRow
                  key={rowIndex}
                  row={row}
                  rowIndex={rowIndex}
                  colors={colors}
                  sortCol={sortCol}
                  sortAsc={sortAsc}
                  onHeaderPress={onHeaderPress}
                />
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>
    </HardShadow>
  );
}

function SpreadsheetViewerBody({
  loading,
  error,
  showEmptyTable,
  showTable,
  displayRows,
  tableWidth,
  colors,
  sortCol,
  sortAsc,
  onHeaderPress,
  onClose,
}) {
  if (loading) {
    return <SpreadsheetLoadingBlock inkColor={colors.nbInk} mutedColor={colors.nbMuted} />;
  }

  if (error) {
    return (
      <SpreadsheetMessageShell
        messageTitle={error}
        messageHint="Open a CSV or spreadsheet from Notes & Files, or ask your trainer to reshare it."
        colors={colors}
      >
        {typeof onClose === 'function' ? (
          <NbButton variant="fill" onPress={onClose} style={{ alignSelf: 'stretch' }}>
            Close
          </NbButton>
        ) : null}
      </SpreadsheetMessageShell>
    );
  }

  if (showEmptyTable) {
    return (
      <SpreadsheetMessageShell
        messageTitle="No rows to show"
        messageHint="This spreadsheet is empty. Add data in the editor and open it again."
        colors={colors}
        dashedBorder
      />
    );
  }

  if (showTable) {
    return (
      <SpreadsheetDataTable
        displayRows={displayRows}
        tableWidth={tableWidth}
        colors={colors}
        sortCol={sortCol}
        sortAsc={sortAsc}
        onHeaderPress={onHeaderPress}
      />
    );
  }

  return null;
}

function resetClosedViewerState(setRows, setError, setLoading, setSortCol) {
  setRows([]);
  setError(null);
  setLoading(true);
  setSortCol(null);
}

function applyInlineRowsOnly(hasInlineRows, inlineRows, setRows, setError, setLoading) {
  if (hasInlineRows) {
    setRows(inlineRows);
    setError(null);
  } else {
    setRows([]);
    setError(LOAD_FAILED_MESSAGE);
  }
  setLoading(false);
}

function shareErrorLooksLikeUserCancel(caughtError) {
  if (!caughtError?.message) {
    return false;
  }
  return /User did not share/i.test(caughtError.message);
}

function columnCountFromDisplayRows(displayRows) {
  const firstRow = displayRows[0] || [];
  if (firstRow.length) {
    return firstRow.length;
  }
  return 1;
}

function SpreadsheetHintLine({ mutedColor }) {
  return (
    <Text
      style={{
        paddingHorizontal: nb.screenGutter,
        paddingBottom: 8,
        color: mutedColor,
        fontSize: 12,
        fontWeight: '600',
      }}
    >
      {HINT_LINE}
    </Text>
  );
}

function SpreadsheetCopyShareBar({
  borderTopColor,
  paddingBottom,
  onCopy,
  onShare,
}) {
  return (
    <View
      style={[
        styles.actions,
        {
          borderTopColor,
          paddingBottom,
        },
      ]}
    >
      <NbButton variant="plain" onPress={onCopy} style={styles.half}>
        Copy CSV
      </NbButton>
      <NbButton variant="plain" onPress={onShare} style={styles.half}>
        Share
      </NbButton>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Design Law spreadsheet viewer.
 * Hook order frozen. Fetch/parse lives under PLUMBING.
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
  const { colors } = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  // vocab: notice = NbNoticeSheet payload — Design Law instead of Alert.alert
  const [notice, setNotice] = useState(null);

  // Load when the modal opens: prefer remote url, fall back to inline rowsProp.
  useEffect(() => {
    if (!visible) {
      resetClosedViewerState(setRows, setError, setLoading, setSortCol);
      return;
    }

    const inlineRows = normalizeRows(rowsProp);
    const hasInlineRows = inlineRows.some(rowHasVisibleText);

    if (!url) {
      applyInlineRowsOnly(hasInlineRows, inlineRows, setRows, setError, setLoading);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    const setters = { setRows, setError, setLoading };

    fetchSpreadsheetData(url, name)
      .then((data) => {
        if (cancelled) {
          return;
        }
        applyFetchedSpreadsheet(data, hasInlineRows, inlineRows, rowsProp, setters);
      })
      .catch((caughtError) => {
        if (cancelled) {
          return;
        }
        applyFetchFailure(caughtError, hasInlineRows, inlineRows, setters);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, url, name, rowsProp]);

  const displayRows = useMemo(
    () => sortedSpreadsheetRows(rows, sortCol, sortAsc),
    [rows, sortCol, sortAsc],
  );

  // 1. Copy the visible (sorted) table as CSV onto the clipboard.
  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(rowsToCsv(displayRows));
      setNotice({ title: 'Copied', message: 'Table copied to clipboard as CSV.' });
    } catch (caughtError) {
      const failMessage = caughtError?.message || 'Could not copy';
      setNotice({ title: 'Copy failed', message: failMessage });
    }
  };

  // 2. Share CSV through the OS share sheet (ignore user-cancel).
  const handleShareCsv = async () => {
    try {
      const csvText = rowsToCsv(displayRows);
      const shareTitle = name || DEFAULT_SHEET_TITLE;
      await Share.share({
        message: csvText,
        title: shareTitle,
      });
    } catch (caughtError) {
      if (shareErrorLooksLikeUserCancel(caughtError)) {
        return;
      }
      setNotice({ title: 'Share failed', message: caughtError.message });
    }
  };

  // 3. Tap header: same column flips asc/desc; new column starts ascending.
  const handleHeaderSort = (columnIndex) => {
    if (sortCol === columnIndex) {
      setSortAsc((wasAscending) => !wasAscending);
      return;
    }
    setSortCol(columnIndex);
    setSortAsc(true);
  };

  const columnCount = columnCountFromDisplayRows(displayRows);
  const tableWidth = Math.max(SCREEN_WIDTH - TABLE_SIDE_INSET, columnCount * MIN_CELL_WIDTH);
  const showTable = !loading && !error && displayRows.length > 0;
  const showEmptyTable = !loading && !error && displayRows.length === 0;
  const showHintLine = showTable;
  const actionBarPaddingBottom = Math.max(safeAreaInsets.bottom, spacing.md);
  const sheetTitle = name || DEFAULT_SHEET_TITLE;
  const noticeIsVisible = !!notice;
  const noticeTitle = notice?.title || '';
  const noticeMessage = notice?.message;
  const screenStyle = [styles.container, { backgroundColor: colors.nbBackground }];

  // 4. Paint header → body → copy/share when there are rows.
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={screenStyle}>
        <NbPageHeader title={sheetTitle} subtitle="Spreadsheet" onBack={onClose} />

        {showHintLine ? <SpreadsheetHintLine mutedColor={colors.nbMuted} /> : null}

        <View style={styles.content}>
          <SpreadsheetViewerBody
            loading={loading}
            error={error}
            showEmptyTable={showEmptyTable}
            showTable={showTable}
            displayRows={displayRows}
            tableWidth={tableWidth}
            colors={colors}
            sortCol={sortCol}
            sortAsc={sortAsc}
            onHeaderPress={handleHeaderSort}
            onClose={onClose}
          />
        </View>

        {showTable ? (
          <SpreadsheetCopyShareBar
            borderTopColor={colors.nbBorder}
            paddingBottom={actionBarPaddingBottom}
            onCopy={handleCopy}
            onShare={handleShareCsv}
          />
        ) : null}

        <NbNoticeSheet
          visible={noticeIsVisible}
          onClose={() => setNotice(null)}
          title={noticeTitle}
          message={noticeMessage}
          confirmLabel="OK"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: nb.screenGutter },
  loadingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15, fontWeight: '600' },
  emptyShell: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 20,
    gap: 12,
    alignItems: 'stretch',
  },
  errorText: { fontSize: 17, textAlign: 'left', fontWeight: '900' },
  emptyHint: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
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

// ===== PLUMBING — skip unless debugging =====
// CSV / XLSX parse, normalize, sort, and fetch. Screen above calls these by name.

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
  if (rowHasAnyText(state.row)) {
    state.rows.push(state.row);
  }
  state.row = [];
}

function applyQuotedCsvChar(state, text, index) {
  const character = text[index];
  if (character !== '"') {
    state.cell += character;
    return index;
  }
  // Doubled quote inside quotes → one literal quote
  if (text[index + 1] === '"') {
    state.cell += '"';
    return index + 1;
  }
  state.inQuotes = false;
  return index;
}

function applyUnquotedCsvChar(state, text, index) {
  const character = text[index];
  if (character === '"') {
    state.inQuotes = true;
    return index;
  }
  if (character === ',' || character === '\t') {
    pushFinishedCell(state);
    // Odd TSV edge: lone tab after first empty cell — leave state as-is
    if (character === '\t' && state.row.length === 1 && !state.cell) {
      return index;
    }
    return index;
  }
  if (character === '\n' || character === '\r') {
    let nextIndex = index;
    if (character === '\r' && text[index + 1] === '\n') {
      nextIndex = index + 1;
    }
    pushFinishedCell(state);
    pushFinishedRowIfNotBlank(state);
    return nextIndex;
  }
  state.cell += character;
  return index;
}

function finishLastCsvRow(state) {
  if (state.cell === '' && state.row.length === 0) {
    return state.rows;
  }
  pushFinishedCell(state);
  state.rows.push(state.row);
  return state.rows;
}

function parseCsvText(text) {
  const state = emptyCsvParseState();
  for (let index = 0; index < text.length; index++) {
    if (state.inQuotes) {
      index = applyQuotedCsvChar(state, text, index);
      continue;
    }
    index = applyUnquotedCsvChar(state, text, index);
  }
  return finishLastCsvRow(state);
}

function rowsFromXlsxBuffer(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }
  const worksheet = workbook.Sheets[firstSheetName];
  // vocab: header: 1 = array of rows, not array of objects.
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
}

async function fetchSpreadsheetData(url, filename) {
  const filenameLooksCsv = (filename || '').toLowerCase().endsWith('.csv');
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error('Failed to load file');
  }
  if (filenameLooksCsv) {
    const text = await response.text();
    return parseCsvText(text);
  }
  const arrayBuffer = await response.arrayBuffer();
  return rowsFromXlsxBuffer(arrayBuffer);
}

function padRowToColumnCount(row, columnCount) {
  const cells = Array.isArray(row) ? [...row] : [row];
  while (cells.length < columnCount) {
    cells.push('');
  }
  return cells.slice(0, columnCount);
}

function normalizeRows(rawRows) {
  const rowList = Array.isArray(rawRows) && rawRows.length ? rawRows : [];
  const columnCount = Math.max(
    0,
    ...rowList.map((row) => (Array.isArray(row) ? row.length : 1)),
  );
  return rowList.map((row) => padRowToColumnCount(row, columnCount));
}

function rowHasVisibleText(row) {
  return row.some((cell) => String(cell ?? '').trim() !== '');
}

function csvCellText(cell) {
  const cellText = String(cell ?? '');
  if (/[",\n]/.test(cellText)) {
    return `"${cellText.replace(/"/g, '""')}"`;
  }
  return cellText;
}

function csvLineFromRow(row) {
  const cells = Array.isArray(row) ? row : [row];
  return cells.map(csvCellText).join(',');
}

function rowsToCsv(dataRows) {
  return (dataRows || []).map(csvLineFromRow).join('\n');
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
  if (bothAreNumbers) {
    return leftNumber - rightNumber;
  }
  return leftText.localeCompare(rightText, undefined, { sensitivity: 'base' });
}

function sortedSpreadsheetRows(rows, sortCol, sortAsc) {
  if (!rows.length || sortCol == null || sortCol < 0) {
    return rows;
  }
  const header = rows[0];
  const body = rows.slice(1);
  const sortedBody = [...body].sort((leftRow, rightRow) => {
    const comparison = compareSortValues(leftRow[sortCol], rightRow[sortCol]);
    if (sortAsc) {
      return comparison;
    }
    return -comparison;
  });
  return [header, ...sortedBody];
}

function applyFetchedSpreadsheet(data, hasInlineRows, inlineRows, rowsProp, setters) {
  let rawRows = Array.isArray(data) && data.length ? data : [];
  if (!rawRows.length && hasInlineRows) {
    rawRows = rowsProp;
  }
  const normalized = normalizeRows(rawRows);
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
