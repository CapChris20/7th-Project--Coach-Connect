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
} from './types';
import SpreadsheetGridRow from './SpreadsheetGridRow';

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

const SpreadsheetGrid = memo(
  forwardRef(function SpreadsheetGrid(
    {
      theme,
      cells,
      displayCache,
      colWidths,
      rowHeights,
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
    const sel = normalizeSel(selection);
    const listRef = useRef(null);
    const rowHeightsRef = useRef({});

    const colW = useCallback((c) => colWidths?.[c] ?? DEFAULT_COL_WIDTH, [colWidths]);
    const rowH = useCallback((r) => rowHeights?.[r] ?? DEFAULT_ROW_HEIGHT, [rowHeights]);

    rowHeightsRef.current = useMemo(() => {
      const map = {};
      for (let i = 0; i < ROWS; i++) map[i] = rowH(i);
      return map;
    }, [rowH]);

    const gridWidth = useMemo(
      () => HEADER_W + Array.from({ length: COLS }, (_, c) => colW(c)).reduce((a, b) => a + b, 0),
      [colW],
    );

    useImperativeHandle(ref, () => ({
      scrollToRow(rowIndex, animated = true) {
        if (rowIndex < 0 || rowIndex >= ROWS) return;
        listRef.current?.scrollToIndex({
          index: rowIndex,
          animated,
          viewPosition: 0.2,
        });
      },
    }));

    const onScrollToIndexFailed = useCallback((info) => {
      let offset = 0;
      for (let i = 0; i < info.index; i++) {
        offset += rowHeightsRef.current[i] ?? DEFAULT_ROW_HEIGHT;
      }
      listRef.current?.scrollToOffset({ offset, animated: true });
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.2,
        });
      }, 80);
    }, []);

    const renderRow = useCallback(
      ({ item: r }) => (
        <SpreadsheetGridRow
          rowIndex={r}
          rowHeight={rowH(r)}
          theme={theme}
          cells={cells}
          displayCache={displayCache}
          colW={colW}
          sel={sel}
          focusR={selection.focus.r}
          focusC={selection.focus.c}
          editingR={editing?.r ?? -1}
          editingC={editing?.c ?? -1}
          editVia={editVia}
          editSeed={editing?.r === r && editVia === 'cell' ? editSeed : ''}
          cellEditRef={editing?.r === r && editVia === 'cell' ? cellEditRef : undefined}
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
        sel,
        selection.focus.c,
        selection.focus.r,
        theme,
      ],
    );

    const rowData = useMemo(() => Array.from({ length: ROWS }, (_, i) => i), []);

    const listExtra = useMemo(
      () =>
        `${selection.focus.r},${selection.focus.c},${editing?.r ?? ''},${editing?.c ?? ''},${editVia ?? ''},${editSeed ?? ''}`,
      [editSeed, editVia, editing?.c, editing?.r, selection.focus.c, selection.focus.r],
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
          <View style={[styles.colHeaderRow, { height: HEADER_H, borderBottomColor: theme.gridLine }]}>
            <View
              style={[
                styles.corner,
                { width: HEADER_W, height: HEADER_H, backgroundColor: theme.cornerBg, borderRightColor: theme.gridLine },
              ]}
            />
            {Array.from({ length: COLS }, (_, c) => {
              const colActive = c >= sel.c1 && c <= sel.c2;
              return (
                <TouchableOpacity
                  key={c}
                  activeOpacity={0.7}
                  onPress={() => onColHeaderPress(c)}
                  onLongPress={() => onColHeaderLongPress(c)}
                  delayLongPress={500}
                  style={{ width: colW(c), height: HEADER_H }}
                >
                  <GradientHeader
                    active={colActive}
                    theme={theme}
                    style={{ width: colW(c), height: HEADER_H, borderRightColor: theme.gridLine }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colActive ? '#fff' : theme.textMuted }}>
                      {colLabel(c)}
                    </Text>
                  </GradientHeader>
                </TouchableOpacity>
              );
            })}
          </View>
          <FlatList
            ref={listRef}
            data={rowData}
            extraData={listExtra}
            keyExtractor={(r) => `row-${r}`}
            renderItem={renderRow}
            initialNumToRender={14}
            maxToRenderPerBatch={8}
            windowSize={6}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
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
