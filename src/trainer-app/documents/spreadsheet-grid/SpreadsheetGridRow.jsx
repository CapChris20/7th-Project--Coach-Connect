// One row of the spreadsheet grid: the row-number header plus all 26 cells.
// Flow: for each column, resolve cached display text + styling → TextInput if that cell is
// being edited, otherwise a tappable Text cell.
// Perf note: hottest component in the editor. Memoized. Formula eval happens upstream.
// Storage keys stay keyOf(row, col) → "r,c". Do not change that format.

import React, { memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLS, DEFAULT_ROW_HEIGHT, HEADER_W, keyOf } from './spreadsheetConstants';
import { lookupDisplay } from './prepareCellText';

// ===== NAMED CONSTANTS =====

const HEADER_LONG_PRESS_MS = 500;
const CELL_LONG_PRESS_MS = 500;
const ALIGN_RIGHT = 'right';
const ALIGN_CENTER = 'center';
const ALIGN_LEFT = 'left';
const FORMAT_CHECKBOX = 'checkbox';
const EDIT_VIA_CELL = 'cell';
const FORMULA_PREFIX = '=';
const ERROR_CELL_TEXT = '#ERR';
const BOLD_WEIGHT = '700';
const REGULAR_WEIGHT = '400';

// ===== HELPER FUNCTIONS =====

/**
 * Selected headers get the brand gradient. Idle ones stay a flat View so we do not mount
 * a LinearGradient on every row number of a 200-row sheet.
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

/**
 * Explicit stored align always wins.
 * vocab/symbol: ?? keeps a stored align of '' instead of falling through the way || would.
 * Numbers right (decimals line up). Checkboxes centered. Text left.
 * @param {object|undefined} cell
 * @param {boolean} isNumberValue
 * @returns {string}
 */
function cellTextAlign(cell, isNumberValue) {
  const storedAlign = cell?.style?.align;
  if (storedAlign != null) return storedAlign;
  if (isNumberValue) return ALIGN_RIGHT;
  if (cell?.format === FORMAT_CHECKBOX) return ALIGN_CENTER;
  return ALIGN_LEFT;
}

function flexJustifyForAlign(align) {
  if (align === ALIGN_RIGHT) return 'flex-end';
  if (align === ALIGN_CENTER) return 'center';
  return 'flex-start';
}

function cellTextDecoration(cell) {
  return [cell?.style?.underline && 'underline', cell?.style?.strike && 'line-through'].filter(Boolean);
}

/**
 * Background precedence, highest first: editing → user fill → selection tint (not on the focus cell) → page.
 * The focused cell stays untinted so its ring marks it instead.
 * @param {object} args
 * @returns {string}
 */
function cellBackgroundColor({ isEditing, isFocus, inSelection, cell, theme }) {
  if (isEditing) return theme.pageBg;
  if (cell?.style?.fill) return cell.style.fill;
  if (inSelection && !isFocus) return theme.selectionFill;
  return theme.pageBg;
}

function displayTextColor({ display, cell, theme }) {
  if (display.error) return theme.warning;
  if (cell?.style?.color) return cell.style.color;
  if (String(cell?.raw || '').startsWith(FORMULA_PREFIX)) return theme.formulaGreen;
  return theme.text;
}

function editorTextColor({ editSeed, cell, theme }) {
  if (String(editSeed).startsWith(FORMULA_PREFIX)) return theme.formulaGreen;
  return cell?.style?.color || theme.text;
}

function cellFontWeight(cell) {
  return cell?.style?.bold ? BOLD_WEIGHT : REGULAR_WEIGHT;
}

function cellFontStyle(cell) {
  return cell?.style?.italic ? 'italic' : 'normal';
}

function GridRowHeader({ rowIndex, rowHeight, rowActive, theme, onRowHeaderPress, onRowHeaderLongPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onRowHeaderPress(rowIndex)}
      onLongPress={() => onRowHeaderLongPress(rowIndex)}
      delayLongPress={HEADER_LONG_PRESS_MS}
      style={{ width: HEADER_W, height: rowHeight }}
    >
      <GradientHeader
        active={rowActive}
        theme={theme}
        style={{ width: HEADER_W, height: rowHeight, borderRightColor: theme.gridLine }}
      >
        <Text style={{ fontSize: 12, fontWeight: '800', color: rowActive ? '#fff' : theme.textMuted }}>
          {rowIndex + 1}
        </Text>
      </GradientHeader>
    </TouchableOpacity>
  );
}

function EditingCell({
  cellStyle,
  editingR,
  editingC,
  cellEditRef,
  editSeed,
  onCellDraftChange,
  onCellEditCommit,
  inputStyle,
  theme,
}) {
  return (
    <View style={cellStyle}>
      {/*
        The key includes the cell address so moving to another cell REMOUNTS the input.
        defaultValue (not value) keeps typing off the React state round-trip.
        Commit: blur stays put (0,0); submit moves down one row (1,0).
      */}
      <TextInput
        key={`${editingR}-${editingC}`}
        ref={cellEditRef}
        defaultValue={editSeed}
        autoFocus
        multiline
        scrollEnabled={false}
        onChangeText={onCellDraftChange}
        onBlur={() => onCellEditCommit(0, 0)}
        onSubmitEditing={() => onCellEditCommit(1, 0)}
        style={[styles.cellInput, inputStyle]}
        autoCapitalize="none"
        autoCorrect={false}
        blurOnSubmit={false}
      />
      <View pointerEvents="none" style={[styles.focusRing, { borderColor: theme.selectionBorder }]} />
    </View>
  );
}

function DisplayCell({
  columnIndex,
  rowIndex,
  cellStyle,
  onCellPress,
  onCellLongPress,
  verticalAlign,
  justify,
  rowHeight,
  display,
  textStyle,
  isFocus,
  theme,
}) {
  const isTallRow = rowHeight > DEFAULT_ROW_HEIGHT;
  return (
    <TouchableOpacity
      key={columnIndex}
      activeOpacity={1}
      onPress={() => onCellPress(rowIndex, columnIndex)}
      onLongPress={() => onCellLongPress(rowIndex, columnIndex)}
      delayLongPress={CELL_LONG_PRESS_MS}
      style={cellStyle}
    >
      <View
        style={{
          flex: 1,
          justifyContent: verticalAlign,
          alignItems: justify,
          paddingHorizontal: 8,
          paddingTop: isTallRow ? 3 : 0,
        }}
      >
        <Text numberOfLines={isTallRow ? undefined : 1} style={textStyle}>
          {display.error ? ERROR_CELL_TEXT : display.text}
        </Text>
      </View>
      {isFocus ? (
        <View pointerEvents="none" style={[styles.focusRing, { borderColor: theme.selectionBorder }]} />
      ) : null}
    </TouchableOpacity>
  );
}

function renderRowCell({
  rowIndex,
  columnIndex,
  rowHeight,
  theme,
  cells,
  displayCache,
  colW,
  sel,
  focusR,
  focusC,
  editingR,
  editingC,
  editSeed,
  editVia,
  cellEditRef,
  onCellPress,
  onCellLongPress,
  onCellDraftChange,
  onCellEditCommit,
}) {
  const cell = cells[keyOf(rowIndex, columnIndex)];
  const display = lookupDisplay(displayCache, rowIndex, columnIndex);
  const inSelection =
    rowIndex >= sel.r1 && rowIndex <= sel.r2 && columnIndex >= sel.c1 && columnIndex <= sel.c2;
  const isFocus = rowIndex === focusR && columnIndex === focusC;
  const isEditing = rowIndex === editingR && columnIndex === editingC && editVia === EDIT_VIA_CELL;
  const isNumberValue = typeof display.rawValue === 'number';
  const align = cellTextAlign(cell, isNumberValue);
  const justify = flexJustifyForAlign(align);
  const verticalAlign = rowHeight > DEFAULT_ROW_HEIGHT ? 'flex-start' : 'center';
  const textDec = cellTextDecoration(cell);
  const cellStyle = [
    styles.cell,
    {
      width: colW(columnIndex),
      height: rowHeight,
      borderRightColor: theme.gridLine,
      borderBottomColor: theme.gridLine,
      backgroundColor: cellBackgroundColor({
        isEditing,
        isFocus,
        inSelection,
        cell,
        theme,
      }),
    },
  ];

  if (isEditing) {
    const inputStyle = {
      color: editorTextColor({ editSeed, cell, theme }),
      fontWeight: cellFontWeight(cell),
      fontStyle: cellFontStyle(cell),
      textDecorationLine: textDec.join(' ') || 'none',
      textAlign: align,
    };
    return (
      <EditingCell
        key={columnIndex}
        cellStyle={cellStyle}
        editingR={editingR}
        editingC={editingC}
        cellEditRef={cellEditRef}
        editSeed={editSeed}
        onCellDraftChange={onCellDraftChange}
        onCellEditCommit={onCellEditCommit}
        inputStyle={inputStyle}
        theme={theme}
      />
    );
  }

  const textStyle = {
    fontSize: 13,
    color: displayTextColor({ display, cell, theme }),
    fontWeight: cellFontWeight(cell),
    fontStyle: cellFontStyle(cell),
    textDecorationLine: textDec.join(' ') || 'none',
    textAlign: align,
    width: '100%',
  };

  return (
    <DisplayCell
      key={columnIndex}
      columnIndex={columnIndex}
      rowIndex={rowIndex}
      cellStyle={cellStyle}
      onCellPress={onCellPress}
      onCellLongPress={onCellLongPress}
      verticalAlign={verticalAlign}
      justify={justify}
      rowHeight={rowHeight}
      display={display}
      textStyle={textStyle}
      isFocus={isFocus}
      theme={theme}
    />
  );
}

function cellsInRow(props) {
  const columns = [];
  for (let columnIndex = 0; columnIndex < COLS; columnIndex += 1) {
    columns.push(renderRowCell({ ...props, columnIndex }));
  }
  return columns;
}

// ===== MAIN FUNCTION =====

function SpreadsheetGridRow({
  rowIndex,
  rowHeight,
  theme,
  cells,
  displayCache,
  colW,
  sel,
  focusR,
  focusC,
  editingR,
  editingC,
  editSeed,
  editVia,
  cellEditRef,
  onCellPress,
  onCellLongPress,
  onCellDraftChange,
  onCellEditCommit,
  onRowHeaderPress,
  onRowHeaderLongPress,
}) {
  // `sel` arrives pre-normalized (r1 <= r2), so a plain range check is enough.
  const rowActive = rowIndex >= sel.r1 && rowIndex <= sel.r2;

  return (
    <View style={[styles.row, { height: rowHeight, borderBottomColor: theme.gridLine }]}>
      <GridRowHeader
        rowIndex={rowIndex}
        rowHeight={rowHeight}
        rowActive={rowActive}
        theme={theme}
        onRowHeaderPress={onRowHeaderPress}
        onRowHeaderLongPress={onRowHeaderLongPress}
      />
      <View style={{ flexDirection: 'row' }}>
        {cellsInRow({
          rowIndex,
          rowHeight,
          theme,
          cells,
          displayCache,
          colW,
          sel,
          focusR,
          focusC,
          editingR,
          editingC,
          editSeed,
          editVia,
          cellEditRef,
          onCellPress,
          onCellLongPress,
          onCellDraftChange,
          onCellEditCommit,
        })}
      </View>
    </View>
  );
}

// vocab: memo = skip re-rendering when props are shallow-equal. Critical here: without it, every
// grid scroll or selection change would re-render all 26 cells of all visible rows.
export default memo(SpreadsheetGridRow);

const styles = StyleSheet.create({
  headerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  row: { flexDirection: 'row', borderBottomWidth: 1 },
  // Only right + bottom borders per cell. Drawing all four would double every interior gridline.
  cell: { overflow: 'hidden', borderRightWidth: 1, borderBottomWidth: 1 },
  cellInput: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    // Manipulate here: lineHeight 22 must stay in step with measureRowHeight.
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined,
  },
  focusRing: {
    ...StyleSheet.absoluteFillObject,
    // Manipulate here: 2px is the ring thickness; the slight radius softens the corners.
    borderWidth: 2,
    borderRadius: 2,
  },
});
