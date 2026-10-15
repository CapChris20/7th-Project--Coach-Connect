// Spreadsheet canvas: sticky column letters on top, virtualized rows underneath.
// Flow: measure column widths → paint A–Z headers → FlatList each row through SpreadsheetGridRow.
// Used by SpreadsheetEditor. Cell storage keys stay "row,col" (see keyOf). Do not reorder the hooks.

import React, { memo, useCallback, useImperativeHandle, useMemo, useRef, forwardRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ROWS,
  COLS,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  HEADER_W,
  HEADER_H,
  colLabel,
  normalizeSel,
} from './spreadsheetConstants';
import SpreadsheetGridRow from './SpreadsheetGridRow';

// ===== NAMED CONSTANTS =====

const SCROLL_FAILED_RETRY_MS = 80;
const SCROLL_VIEW_POSITION = 0.2;
const HEADER_LONG_PRESS_MS = 500;
const INITIAL_ROWS_TO_RENDER = 14;
const ROWS_PER_RENDER_BATCH = 12;
const ROW_WINDOW_SIZE = 8;
const CELL_BATCH_PERIOD_MS = 16;

// ===== HELPER FUNCTIONS =====

/**
 * Selected headers get the brand gradient. Idle headers stay a cheap flat View so a 200-row
 * sheet does not mount 26 LinearGradients that never animate.
 * @param {object} props
 */
function GradientHeader({ active, children, theme, style }) {
  if (active) {
    return (
      <LinearGradient
        colors={theme.sheetGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerCell, style]}
      >
        {children}
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.headerCell, { backgroundColor: theme.gridHeaderBg }, style]}>
      {children}
    </View>
  );
}

function widthForColumn(colWidths, columnIndex) {
  return colWidths?.[columnIndex] ?? DEFAULT_COL_WIDTH;
}

function heightForRow(rowHeights, rowIndex) {
  return rowHeights?.[rowIndex] ?? DEFAULT_ROW_HEIGHT;
}

function sumColumnWidths(columnWidthForIndex) {
  let total = HEADER_W;
  for (let columnIndex = 0; columnIndex < COLS; columnIndex += 1) {
    total += columnWidthForIndex(columnIndex);
  }
  return total;
}

function buildRowHeightMap(rowHeightForIndex) {
  const map = {};
  for (let rowIndex = 0; rowIndex < ROWS; rowIndex += 1) {
    map[rowIndex] = rowHeightForIndex(rowIndex);
  }
  return map;
}

function offsetBeforeRow(rowHeightsMap, rowIndex) {
  let offset = 0;
  for (let rowIndexCursor = 0; rowIndexCursor < rowIndex; rowIndexCursor += 1) {
    offset += rowHeightsMap[rowIndexCursor] ?? DEFAULT_ROW_HEIGHT;
  }
  return offset;
}

function rowIndexList() {
  return Array.from({ length: ROWS }, (_, rowIndex) => rowIndex);
}

/**
 * FlatList extraData is a cheap string. Changing it is what re-renders visible rows when
 * focus / edit / column width changes without cloning the whole `data` array.
 * @param {object} args
 * @returns {string}
 */
function listExtraKey({
  selection,
  editing,
  editVia,
  editSeed,
  dimRevision,
  rowHeights,
  colWidths,
}) {
  const editingRow = editing?.r ?? -1;
  const editingCol = editing?.c ?? -1;
  const editingRowHeight = rowHeights?.[editingRow] ?? DEFAULT_ROW_HEIGHT;
  const editingColWidth = colWidths?.[editingCol] ?? DEFAULT_COL_WIDTH;
  return [
    selection.focus.r,
    selection.focus.c,
    editingRow,
    editingCol,
    editVia ?? '',
    editSeed ?? '',
    dimRevision,
    editingRowHeight,
    editingColWidth,
    JSON.stringify(rowHeights?.[editingRow]),
    JSON.stringify(colWidths?.[editingCol]),
  ].join('|');
}

function ColumnLetterHeaders({
  theme,
  selectionRange,
  columnWidthForIndex,
  onColHeaderPress,
  onColHeaderLongPress,
}) {
  const letters = [];
  for (let columnIndex = 0; columnIndex < COLS; columnIndex += 1) {
    const colActive = columnIndex >= selectionRange.c1 && columnIndex <= selectionRange.c2;
    const columnWidth = columnWidthForIndex(columnIndex);
    letters.push(
      <TouchableOpacity
        key={columnIndex}
        activeOpacity={0.7}
        onPress={() => onColHeaderPress(columnIndex)}
        onLongPress={() => onColHeaderLongPress(columnIndex)}
        delayLongPress={HEADER_LONG_PRESS_MS}
        style={{ width: columnWidth, height: HEADER_H }}
      >
        <GradientHeader
          active={colActive}
          theme={theme}
          style={{ width: columnWidth, height: HEADER_H, borderRightColor: theme.gridLine }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: colActive ? '#fff' : theme.textMuted }}>
            {colLabel(columnIndex)}
          </Text>
        </GradientHeader>
      </TouchableOpacity>,
    );
  }
  return (
    <View style={[styles.colHeaderRow, { height: HEADER_H, borderBottomColor: theme.gridLine }]}>
      <View
        style={[
          styles.corner,
          { width: HEADER_W, height: HEADER_H, backgroundColor: theme.cornerBg, borderRightColor: theme.gridLine },
        ]}
      />
      {letters}
    </View>
  );
}

// ===== MAIN FUNCTION =====

const SpreadsheetGrid = memo(
  forwardRef(function SpreadsheetGrid(
    {
      theme,
      cells,
      displayCache,
      colWidths,
      rowHeights,
      dimRevision = 0,
      selection,
      editing,
      editSeed,
      editVia,
      cellEditRef,
      onCellPress,
      onCellLongPress,
      onCellDraftChange,
      onCellEditCommit,
      onColHeaderPress,
      onColHeaderLongPress,
      onRowHeaderPress,
      onRowHeaderLongPress,
    },
    ref,
  ) {
    const selectionRange = normalizeSel(selection);
    const listRef = useRef(null);
    const rowHeightsRef = useRef({});

    const colW = useCallback(
      (columnIndex) => widthForColumn(colWidths, columnIndex),
      [colWidths],
    );
    const rowH = useCallback(
      (rowIndex) => heightForRow(rowHeights, rowIndex),
      [rowHeights],
    );

    // Same assignment as before: the memo fills the ref so onScrollToIndexFailed can read heights
    // without adding them to that callback's dependency list (which would rebuild it every resize).
    rowHeightsRef.current = useMemo(() => buildRowHeightMap(rowH), [rowH]);

    const gridWidth = useMemo(() => sumColumnWidths(colW), [colW]);

    useImperativeHandle(ref, () => ({
      scrollToRow(rowIndex, animated = true) {
        if (rowIndex < 0 || rowIndex >= ROWS) return;
        listRef.current?.scrollToIndex({
          index: rowIndex,
          animated,
          viewPosition: SCROLL_VIEW_POSITION,
        });
      },
    }));

    const onScrollToIndexFailed = useCallback((info) => {
      const offset = offsetBeforeRow(rowHeightsRef.current, info.index);
      listRef.current?.scrollToOffset({ offset, animated: true });
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: SCROLL_VIEW_POSITION,
        });
      }, SCROLL_FAILED_RETRY_MS);
    }, []);

    const renderRow = useCallback(
      ({ item: rowIndex }) => (
        <SpreadsheetGridRow
          rowIndex={rowIndex}
          rowHeight={rowH(rowIndex)}
          theme={theme}
          cells={cells}
          displayCache={displayCache}
          colW={colW}
          sel={selectionRange}
          focusR={selection.focus.r}
          focusC={selection.focus.c}
          editingR={editing?.r ?? -1}
          editingC={editing?.c ?? -1}
          editVia={editVia}
          editSeed={editing?.r === rowIndex && editVia === 'cell' ? editSeed : ''}
          cellEditRef={editing?.r === rowIndex && editVia === 'cell' ? cellEditRef : undefined}
          onCellPress={onCellPress}
          onCellLongPress={onCellLongPress}
          onCellDraftChange={onCellDraftChange}
          onCellEditCommit={onCellEditCommit}
          onRowHeaderPress={onRowHeaderPress}
          onRowHeaderLongPress={onRowHeaderLongPress}
        />
      ),
      [
        cells,
        colW,
        displayCache,
        cellEditRef,
        editVia,
        editSeed,
        editing?.c,
        editing?.r,
        onCellDraftChange,
        onCellEditCommit,
        onCellLongPress,
        onCellPress,
        onRowHeaderLongPress,
        onRowHeaderPress,
        rowH,
        selectionRange,
        selection.focus.c,
        selection.focus.r,
        theme,
      ],
    );

    const rowData = useMemo(() => rowIndexList(), []);

    const listExtra = useMemo(
      () =>
        listExtraKey({
          selection,
          editing,
          editVia,
          editSeed,
          dimRevision,
          rowHeights,
          colWidths,
        }),
      [
        colWidths,
        dimRevision,
        editSeed,
        editVia,
        editing?.c,
        editing?.r,
        rowHeights,
        selection.focus.c,
        selection.focus.r,
      ],
    );

    return (
      <ScrollView
        horizontal
        style={{ flex: 1 }}
        contentContainerStyle={{ minWidth: '100%' }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        nestedScrollEnabled
        showsHorizontalScrollIndicator
      >
        <View style={{ width: gridWidth }}>
          <ColumnLetterHeaders
            theme={theme}
            selectionRange={selectionRange}
            columnWidthForIndex={colW}
            onColHeaderPress={onColHeaderPress}
            onColHeaderLongPress={onColHeaderLongPress}
          />
          <FlatList
            ref={listRef}
            data={rowData}
            extraData={listExtra}
            keyExtractor={(rowIndex) => `row-${rowIndex}`}
            renderItem={renderRow}
            initialNumToRender={INITIAL_ROWS_TO_RENDER}
            maxToRenderPerBatch={ROWS_PER_RENDER_BATCH}
            windowSize={ROW_WINDOW_SIZE}
            updateCellsBatchingPeriod={CELL_BATCH_PERIOD_MS}
            removeClippedSubviews={!editing}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
            onScrollToIndexFailed={onScrollToIndexFailed}
            showsVerticalScrollIndicator
          />
        </View>
      </ScrollView>
    );
  }),
);

export default SpreadsheetGrid;

const styles = StyleSheet.create({
  colHeaderRow: { flexDirection: 'row', borderBottomWidth: 1 },
  corner: { borderRightWidth: 1 },
  headerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
});
