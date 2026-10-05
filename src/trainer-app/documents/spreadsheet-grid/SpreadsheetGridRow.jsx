// One row of the spreadsheet grid: the row-number header plus all 26 cells.
// Flow: for each column, resolve its cached display text + styling → render either a TextInput (that
// one cell being edited) or a tappable Text cell.
// Perf note: this is the hottest component in the editor — one instance per visible row, each
// rendering COLS cells. It's memoized, and all expensive work (formula evaluation, text measuring)
// happens upstream so this file only reads precomputed values.
import React, { memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLS, DEFAULT_ROW_HEIGHT, HEADER_W, keyOf } from './spreadsheetConstants';
import { lookupDisplay } from './prepareCellText';

// Row/column header background. Selected headers get the brand gradient; unselected ones get a flat
// color. Two separate branches (rather than a gradient with flat colors) because mounting a
// LinearGradient for every idle header would be wasted native views on a 200-row sheet.
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
  // `sel` arrives pre-normalized (r1 <= r2), so a plain range check is enough — no min/max needed.
  // This highlights the row number whenever any cell in the row is selected.
  const rowActive = rowIndex >= sel.r1 && rowIndex <= sel.r2;

  return (
    <View style={[styles.row, { height: rh, borderBottomColor: theme.gridLine }]}>
      {/* ROW HEADER — tap selects the whole row, long-press opens the row context menu (insert,
          delete, resize). Manipulate here: delayLongPress 500ms is the hold time before that menu
          appears; shorter makes it easier to trigger accidentally while scrolling. */}
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
          {/* +1 converts the 0-based array index into the 1-based row number users expect.
              White text when active because it sits on the gradient. */}
          <Text style={{ fontSize: 12, fontWeight: '800', color: rowActive ? '#fff' : theme.textMuted }}>
            {rowIndex + 1}
          </Text>
        </GradientHeader>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row' }}>
        {/* CELLS. vocab: Array.from({ length: COLS }, (_, c) => …) = build an array of COLS items,
            using only the index — the idiomatic way to render a fixed-size range in JSX. */}
        {Array.from({ length: COLS }, (_, c) => {
          // `cell` is the stored data (may be undefined for a blank cell); `d` is the precomputed
          // display text from the cache. Both are needed: styling comes from the cell, text from
          // the cache (which already resolved formulas and number formats).
          const cell = cells[keyOf(rowIndex, c)];
          const d = lookupDisplay(displayCache, rowIndex, c);
          // Three related but distinct states, and each drives different visuals:
          //   inSel     — inside the selection rectangle → tinted background
          //   isFocus   — THE one active cell within that selection → border ring, no tint
          //   isEditing — actively being typed into, and only via the cell (not the formula bar)
          const inSel = rowIndex >= sel.r1 && rowIndex <= sel.r2 && c >= sel.c1 && c <= sel.c2;
          const isFocus = rowIndex === focusR && c === focusC;
          const isEditing = rowIndex === editingR && c === editingC && editVia === 'cell';
          const isNum = typeof d.rawValue === 'number';
          // Alignment: an explicit style always wins, otherwise follow spreadsheet convention —
          // numbers right (so decimal points line up down a column), checkboxes centered, text left.
          // vocab/symbol: ?? means a stored align of '' would be respected, unlike || which would
          // fall through to the default.
          const align = cell?.style?.align ?? (isNum ? 'right' : cell?.format === 'checkbox' ? 'center' : 'left');
          // Translate the text alignment into the flexbox equivalent for the wrapper View.
          const justify = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
          // Taller-than-default rows hold multi-line content, so text starts at the TOP; standard
          // single-line rows center it vertically.
          const vAlign = rh > DEFAULT_ROW_HEIGHT ? 'flex-start' : 'center';
          // Underline and strikethrough can both apply, so they're collected and space-joined —
          // textDecorationLine accepts "underline line-through". filter(Boolean) drops the falses.
          const textDec = [cell?.style?.underline && 'underline', cell?.style?.strike && 'line-through'].filter(Boolean);
          const cellStyle = [
            styles.cell,
            {
              width: colW(c),
              height: rh,
              borderRightColor: theme.gridLine,
              borderBottomColor: theme.gridLine,
              // Background precedence, highest first:
              //   editing        → plain page background, so the caret and text are unobstructed
              //   the cell's own fill (a highlight the user applied) beats the selection tint
              //   in-selection but NOT focused → selection tint
              //   otherwise      → page background
              // The `!isFocus` is why the focused cell stays untinted inside a selection — its ring
              // marks it instead.
              backgroundColor:
                isEditing
                  ? theme.pageBg
                  : cell?.style?.fill || (inSel && !isFocus ? theme.selectionFill : theme.pageBg),
            },
          ];
          // Text styling for the EDIT input. It reads from `editSeed` (the in-progress text) rather
          // than the stored cell, so typing "=" turns the text green immediately.
          const inputStyle = {
            color: String(editSeed).startsWith('=') ? theme.formulaGreen : (cell?.style?.color || theme.text),
            fontWeight: cell?.style?.bold ? '700' : '400',
            fontStyle: cell?.style?.italic ? 'italic' : 'normal',
            textDecorationLine: textDec.join(' ') || 'none',
            textAlign: align,
          };

          // EDIT MODE — swap this one cell for a live TextInput.
          if (isEditing) {
            return (
              <View key={c} style={cellStyle}>
                {/* The key includes the cell address so moving to another cell REMOUNTS the input.
                    That remount is what resets defaultValue and re-triggers autoFocus — without it
                    the previous cell's text would linger.
                    defaultValue (not value) makes this uncontrolled, so each keystroke doesn't have
                    to round-trip through parent state — that's what keeps typing responsive.
                    multiline + scrollEnabled={false} lets the text wrap to the row's height without
                    the cell becoming its own tiny scroll area.
                    Commit directions: blur commits in place (0,0); submit commits and moves down
                    one row (1,0). blurOnSubmit={false} keeps the keyboard up for the next cell. */}
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
                {/* The focus ring is an absolutely-positioned overlay, not a border on the cell —
                    a real border would shift the text inside by its width. pointerEvents="none" is
                    essential so it doesn't intercept taps meant for the input beneath it. */}
                <View pointerEvents="none" style={[styles.focusRing, { borderColor: theme.selectionBorder }]} />
              </View>
            );
          }

          // DISPLAY MODE — the normal case for every cell that isn't being edited.
          // activeOpacity={1} disables the press-fade: a spreadsheet cell shouldn't dim on tap, it
          // should just become selected.
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
                {/* numberOfLines: undefined (unlimited) on tall rows so multi-line content shows;
                    clamped to 1 on standard rows so long text can't overflow into the row below.
                    Text color precedence: a formula error wins (warning color), then the user's own
                    color, then green for formula source text, then normal. */}
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
  // Only right + bottom borders per cell. Drawing all four would double every interior gridline,
  // making them look twice as thick as intended.
  // overflow hidden is what keeps long text from bleeding into the neighboring cell.
  cell: { overflow: 'hidden', borderRightWidth: 1, borderBottomWidth: 1 },
  cellInput: {
    // absoluteFillObject makes the input cover the whole cell, so tapping anywhere in the cell hits
    // the text field rather than dead space around it.
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    // Manipulate here: lineHeight 22 must stay in step with the 22 used by measureRowHeight, or
    // auto-sized tall rows won't match the text they were sized for.
    lineHeight: 22,
    // Monospace on iOS so formulas and numbers align; undefined on Android because 'Menlo' doesn't
    // exist there and naming a missing font can break text rendering.
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined,
  },
  focusRing: {
    // Overlaid rather than applied as a border, so showing it never reflows the cell's contents.
    ...StyleSheet.absoluteFillObject,
    // Manipulate here: 2px is the ring thickness; the slight radius softens the corners.
    borderWidth: 2,
    borderRadius: 2,
  },
});
