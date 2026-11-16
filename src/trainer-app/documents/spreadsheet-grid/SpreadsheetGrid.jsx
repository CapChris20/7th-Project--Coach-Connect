// Neobrutalist spreadsheet grid with sticky first column and inverted cell highlight.
// Flow: render sticky header and column → render scrollable columns → handle cell tap and edit.
// Used by: SpreadsheetEditor.

import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { calculateFormulaValue, isFormulaCell } from './formulaCalculator';
import { coordinateKey } from './spreadsheetConstants';

// ===== NAMED CONSTANTS =====

const STICKY_COLUMN_WIDTH = 120;
const SCROLLABLE_COLUMN_WIDTH = 110;
const CELL_ROW_HEIGHT = 44;
const HEADER_ROW_HEIGHT = 42;
const CORNER_LABEL_STANDARD = '';
const CORNER_LABEL_PROGRAM = 'EXERCISE';

// ===== HELPER FUNCTIONS =====

/**
 * Decide text color for a grid cell.
 */
function cellTextColor(isSelected, isDark) {
  if (isSelected) {
    return isDark ? '#000000' : '#FFFFFF';
  }
  return isDark ? '#FFFFFF' : '#000000';
}

/**
 * Decide background color for a grid cell.
 */
function cellBackgroundColor(isSelected, isDark) {
  if (isSelected) {
    return isDark ? '#FFFFFF' : '#000000';
  }
  return isDark ? '#141414' : '#FFFFFF';
}

/**
 * Compute display text for a cell, evaluating formulas if present.
 */
function displayValueForCell(rawValue, gridRows) {
  if (rawValue === null || rawValue === undefined) return '';
  const textString = String(rawValue);
  if (isFormulaCell(textString)) {
    return calculateFormulaValue(textString, gridRows);
  }
  return textString;
}

/**
 * Single cell element inside the grid.
 */
function GridCell({
  rowIndex,
  columnIndex,
  rawValue,
  gridRows,
  isSelected,
  isDark,
  themeColors,
  isCellBold,
  isCellItalic,
  onPressCell,
  onDoublePressCell,
}) {
  const lastPressRef = useRef(0);
  const displayText = displayValueForCell(rawValue, gridRows);

  const cellBg = cellBackgroundColor(isSelected, isDark);
  const textColor = cellTextColor(isSelected, isDark);
  const fontStyle = isCellItalic ? 'italic' : 'normal';
  const fontWeight = isSelected || isCellBold ? '800' : '500';

  const handleCellPress = () => {
    const currentTime = Date.now();
    const timeDelta = currentTime - lastPressRef.current;
    lastPressRef.current = currentTime;

    // Double tap within 300ms opens cell editor immediately
    if (timeDelta < 300) {
      onDoublePressCell(rowIndex, columnIndex);
      return;
    }

    onPressCell(rowIndex, columnIndex);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleCellPress}
      style={[
        styles.standardCell,
        {
          backgroundColor: cellBg,
          borderColor: themeColors.cellBorder,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.cellText,
          {
            color: textColor,
            fontWeight,
            fontStyle,
          },
        ]}
      >
        {displayText}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Single cell for the sticky left column (Row number or Exercise name).
 */
function StickyColumnCell({
  rowIndex,
  rawValue,
  isSelected,
  isDark,
  themeColors,
  onPressCell,
}) {
  const cellBg = isSelected ? (isDark ? '#FFFFFF' : '#000000') : (isDark ? '#1C1C1E' : '#FFFFFF');
  const textColor = isSelected ? (isDark ? '#000000' : '#FFFFFF') : (isDark ? '#FFFFFF' : '#000000');
  const fontWeight = isSelected ? '900' : '700';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPressCell(rowIndex, 0)}
      style={[
        styles.stickyCell,
        {
          backgroundColor: cellBg,
          borderColor: themeColors.cellBorder,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.stickyCellText,
          {
            color: textColor,
            fontWeight,
          },
        ]}
      >
        {String(rawValue || '')}
      </Text>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Spreadsheet grid table with sticky first column and scrollable data area.
 * Flow: 1. setup color tokens  2. render corner and sticky column  3. render scrollable grid
 * @param {{
 *   gridRows: string[][],
 *   selectedRowIndex: number,
 *   selectedColumnIndex: number,
 *   isDark: boolean,
 *   isProgramMode: boolean,
 *   cellStylesMap: object,
 *   onSelectCell: Function,
 *   onEditCell: Function,
 * }} props
 */
export default function SpreadsheetGrid({
  gridRows,
  selectedRowIndex,
  selectedColumnIndex,
  isDark,
  isProgramMode,
  cellStylesMap = {},
  onSelectCell,
  onEditCell,
}) {
  const safeRows = Array.isArray(gridRows) && gridRows.length > 0 ? gridRows : [['']];
  const headerRow = safeRows[0] || [];
  const bodyRows = safeRows.slice(1);

  const themeColors = {
    outerBorder: isDark ? '#FFFFFF' : '#000000',
    cellBorder: isDark ? '#333333' : '#000000',
    headerBg: isDark ? '#262626' : '#E5E2DC',
    headerText: isDark ? '#FFFFFF' : '#000000',
    gridBg: isDark ? '#121212' : '#FFFFFF',
  };

  const cornerLabel = isProgramMode ? CORNER_LABEL_PROGRAM : (headerRow[0] || CORNER_LABEL_STANDARD);
  const scrollableColumnLabels = headerRow.slice(1);

  // Render row in the scrollable body
  const renderScrollableBodyRow = (rowItems, zeroBasedBodyIndex) => {
    const actualRowIndex = zeroBasedBodyIndex + 1;
    const rowCells = rowItems.slice(1);

    return (
      <View key={`scroll-row-${actualRowIndex}`} style={styles.gridRowContainer}>
        {rowCells.map((cellValue, relativeColumnIndex) => {
          const actualColumnIndex = relativeColumnIndex + 1;
          const isSelected = selectedRowIndex === actualRowIndex && selectedColumnIndex === actualColumnIndex;
          const cellKey = coordinateKey(actualRowIndex, actualColumnIndex);
          const cellStyleInfo = cellStylesMap[cellKey] || {};

          return (
            <GridCell
              key={`cell-${actualRowIndex}-${actualColumnIndex}`}
              rowIndex={actualRowIndex}
              columnIndex={actualColumnIndex}
              rawValue={cellValue}
              gridRows={safeRows}
              isSelected={isSelected}
              isDark={isDark}
              themeColors={themeColors}
              isCellBold={Boolean(cellStyleInfo.bold)}
              isCellItalic={Boolean(cellStyleInfo.italic)}
              onPressCell={onSelectCell}
              onDoublePressCell={onEditCell}
            />
          );
        })}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.tableFrame,
        {
          borderColor: themeColors.outerBorder,
          backgroundColor: themeColors.gridBg,
        },
      ]}
    >
      {/* 1. Table Header Row (Corner Cell + Scrollable Column Headers) */}
      <View style={[styles.headerRowWrapper, { borderBottomColor: themeColors.outerBorder }]}>
        {/* Fixed top-left corner */}
        <View
          style={[
            styles.cornerHeaderCell,
            {
              backgroundColor: themeColors.headerBg,
              borderColor: themeColors.cellBorder,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.headerCellText, { color: themeColors.headerText }]}
          >
            {cornerLabel}
          </Text>
        </View>

        {/* Scrollable column headers (locked horizontally with body) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={styles.headerColumnsScrollView}
        >
          <View style={styles.gridRowContainer}>
            {scrollableColumnLabels.map((colName, index) => (
              <View
                key={`col-header-${index}`}
                style={[
                  styles.headerCell,
                  {
                    backgroundColor: themeColors.headerBg,
                    borderColor: themeColors.cellBorder,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.headerCellText, { color: themeColors.headerText }]}
                >
                  {colName}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 2. Table Body (Sticky Left Column + Horizontally Scrollable Cells) */}
      <ScrollView
        style={styles.verticalScrollContainer}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        <View style={styles.bodyRowWrapper}>
          {/* Sticky left column body */}
          <View style={styles.stickyColumnBody}>
            {bodyRows.map((rowItems, bodyRowIndex) => {
              const actualRowIndex = bodyRowIndex + 1;
              const stickyLabel = rowItems[0] || '';
              const isSelected = selectedRowIndex === actualRowIndex && selectedColumnIndex === 0;

              return (
                <StickyColumnCell
                  key={`sticky-cell-${actualRowIndex}`}
                  rowIndex={actualRowIndex}
                  rawValue={stickyLabel}
                  isSelected={isSelected}
                  isDark={isDark}
                  themeColors={themeColors}
                  onPressCell={onSelectCell}
                />
              );
            })}
          </View>

          {/* Horizontally scrollable data cells */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <View>
              {bodyRows.map((rowItems, bodyRowIndex) =>
                renderScrollableBodyRow(rowItems, bodyRowIndex),
              )}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  tableFrame: {
    borderWidth: 2.5,
    borderRadius: 14,
    overflow: 'hidden',
    maxHeight: 380,
  },
  headerRowWrapper: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    height: HEADER_ROW_HEIGHT,
  },
  cornerHeaderCell: {
    width: STICKY_COLUMN_WIDTH,
    height: HEADER_ROW_HEIGHT,
    borderRightWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerColumnsScrollView: {
    flex: 1,
  },
  headerCell: {
    width: SCROLLABLE_COLUMN_WIDTH,
    height: HEADER_ROW_HEIGHT,
    borderRightWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerCellText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  verticalScrollContainer: {
    maxHeight: 338,
  },
  bodyRowWrapper: {
    flexDirection: 'row',
  },
  stickyColumnBody: {
    width: STICKY_COLUMN_WIDTH,
  },
  stickyCell: {
    height: CELL_ROW_HEIGHT,
    borderRightWidth: 2,
    borderBottomWidth: 1.5,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  stickyCellText: {
    fontSize: 14,
  },
  gridRowContainer: {
    flexDirection: 'row',
  },
  standardCell: {
    width: SCROLLABLE_COLUMN_WIDTH,
    height: CELL_ROW_HEIGHT,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  cellText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
