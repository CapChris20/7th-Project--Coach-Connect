import React, { memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLS, DEFAULT_ROW_HEIGHT, HEADER_W, keyOf } from './types';
import { lookupDisplay } from './buildDisplayCache';

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
  const rh = rowHeight;
  const rowActive = rowIndex >= sel.r1 && rowIndex <= sel.r2;

  return (
    <View style={[styles.row, { height: rh, borderBottomColor: theme.gridLine }]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onRowHeaderPress(rowIndex)}
        onLongPress={() => onRowHeaderLongPress(rowIndex)}
        delayLongPress={500}
        style={{ width: HEADER_W, height: rh }}
      >
        <GradientHeader
          active={rowActive}
          theme={theme}
          style={{ width: HEADER_W, height: rh, borderRightColor: theme.gridLine }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: rowActive ? '#fff' : theme.textMuted }}>
            {rowIndex + 1}
          </Text>
        </GradientHeader>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row' }}>
        {Array.from({ length: COLS }, (_, c) => {
          const cell = cells[keyOf(rowIndex, c)];
          const d = lookupDisplay(displayCache, rowIndex, c);
          const inSel = rowIndex >= sel.r1 && rowIndex <= sel.r2 && c >= sel.c1 && c <= sel.c2;
          const isFocus = rowIndex === focusR && c === focusC;
          const isEditing = rowIndex === editingR && c === editingC && editVia === 'cell';
          const isNum = typeof d.rawValue === 'number';
          const align = cell?.style?.align ?? (isNum ? 'right' : cell?.format === 'checkbox' ? 'center' : 'left');
          const justify = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
          const vAlign = rh > DEFAULT_ROW_HEIGHT ? 'flex-start' : 'center';
          const textDec = [cell?.style?.underline && 'underline', cell?.style?.strike && 'line-through'].filter(Boolean);
          const cellStyle = [
            styles.cell,
            {
              width: colW(c),
              height: rh,
              borderRightColor: theme.gridLine,
              borderBottomColor: theme.gridLine,
              backgroundColor:
                isEditing
                  ? theme.pageBg
                  : cell?.style?.fill || (inSel && !isFocus ? theme.selectionFill : theme.pageBg),
            },
          ];
          const inputStyle = {
            color: String(editSeed).startsWith('=') ? theme.formulaGreen : (cell?.style?.color || theme.text),
            fontWeight: cell?.style?.bold ? '700' : '400',
            fontStyle: cell?.style?.italic ? 'italic' : 'normal',
            textDecorationLine: textDec.join(' ') || 'none',
            textAlign: align,
          };

          if (isEditing) {
            return (
              <View key={c} style={cellStyle}>
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

          return (
            <TouchableOpacity
              key={c}
              activeOpacity={1}
              onPress={() => onCellPress(rowIndex, c)}
              onLongPress={() => onCellLongPress(rowIndex, c)}
              delayLongPress={500}
              style={cellStyle}
            >
              <View
                style={{
                  flex: 1,
                  justifyContent: vAlign,
                  alignItems: justify,
                  paddingHorizontal: 8,
                  paddingTop: rh > DEFAULT_ROW_HEIGHT ? 3 : 0,
                }}
              >
                <Text
                  numberOfLines={rh > DEFAULT_ROW_HEIGHT ? undefined : 1}
                  style={{
                    fontSize: 13,
                    color: d.error
                      ? theme.warning
                      : cell?.style?.color ||
                        (String(cell?.raw || '').startsWith('=') ? theme.formulaGreen : theme.text),
                    fontWeight: cell?.style?.bold ? '700' : '400',
                    fontStyle: cell?.style?.italic ? 'italic' : 'normal',
                    textDecorationLine: textDec.join(' ') || 'none',
                    textAlign: align,
                    width: '100%',
                  }}
                >
                  {d.error ? '#ERR' : d.text}
                </Text>
              </View>
              {isFocus ? (
                <View pointerEvents="none" style={[styles.focusRing, { borderColor: theme.selectionBorder }]} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default memo(SpreadsheetGridRow);

const styles = StyleSheet.create({
  headerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  row: { flexDirection: 'row', borderBottomWidth: 1 },
  cell: { overflow: 'hidden', borderRightWidth: 1, borderBottomWidth: 1 },
  cellInput: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined,
  },
  focusRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderRadius: 2,
  },
});
