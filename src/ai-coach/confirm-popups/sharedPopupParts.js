// Shared Design Law chrome for AI-coach confirm popups.
// Flow: CoachWantsBadge → title → editable chips/slider/fields → Not now / confirm.
// Used by every confirm-popup in this folder. Visual law: screens/ai-coach-popups/*.png

import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbButton from '../../look-and-feel/NbButton';
import NbSlider from '../../look-and-feel/NbSlider';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import {
  lightColors,
  darkColors,
  spacing,
  borderRadius,
  nb,
  navAccentGradient,
  accentGradients,
} from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_CONFIRM_LABEL = 'Confirm';
const CANCEL_LABEL = 'Not now';
const TODAY_DATE_LABEL = 'Today';

// Manipulate here: Coach-wants pill uses brand pink→orange (accentGradients[0]), not nav gold
const COACH_WANTS_GRADIENT = accentGradients[0] || navAccentGradient;

const FILL_CHIP_PRESSED_OPACITY = 0.92;
const FILL_CHIP_PRESS_NUDGE_X = 2;
const FILL_CHIP_PRESS_NUDGE_Y = 2;

const TABLE_ROW_DIVIDER_WIDTH = 2;
const EMPTY_MACRO_PLACEHOLDER = '—';

const MACRO_CELL_PROTEIN = { key: 'p', label: 'Protein' };
const MACRO_CELL_CARBS = { key: 'c', label: 'Carbs' };
const MACRO_CELL_FATS = { key: 'f', label: 'Fats' };

// ===== HELPER FUNCTIONS =====

/**
 * Returns light or dark theme color definitions for confirmation popups.
 * @returns {object}
 */
export function usePopupColors() {
  const { isDark } = useTheme();
  if (isDark) {
    return darkColors;
  }
  return lightColors;
}

/**
 * Returns a readable date label for the action, defaulting to today.
 * @param {object} params
 * @returns {string}
 */
export function logDateLabel(params) {
  if (!params) {
    return TODAY_DATE_LABEL;
  }
  const dateFromTool = params.date;
  if (!dateFromTool) {
    return TODAY_DATE_LABEL;
  }
  return String(dateFromTool);
}

/**
 * Gradient pill badge indicating the AI coach requested this action.
 * @param {object} props
 * @returns {React.ReactElement|null}
 */
export function CoachWantsBadge({ text }) {
  const colors = usePopupColors();

  if (!text) {
    return null;
  }

  const badgeBorderStyle = { borderColor: colors.nbBorder };
  // Badge ink stays light-theme black so it reads on the pink→orange gradient in both themes
  const badgeInkStyle = { color: lightColors.nbInk };

  return (
    <View style={sharedStyles.badgeWrap}>
      <LinearGradient
        colors={COACH_WANTS_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[sharedStyles.badge, badgeBorderStyle]}
      >
        <Text style={[sharedStyles.badgeText, badgeInkStyle]} numberOfLines={1}>
          {text}
        </Text>
      </LinearGradient>
    </View>
  );
}

function ReasoningLine({ reasoning, mutedInkColor }) {
  if (!reasoning) {
    return null;
  }
  return (
    <Text style={[sharedStyles.reasoning, { color: mutedInkColor }]}>{reasoning}</Text>
  );
}

/**
 * Displays a single label and value row in a confirmation popup.
 * @param {object} props
 * @returns {React.ReactElement|null}
 */
export function DetailRow({ label, value }) {
  const colors = usePopupColors();
  const valueIsMissing = value == null || value === '';

  if (valueIsMissing) {
    return null;
  }

  let labelNode = null;
  if (label) {
    labelNode = (
      <Text style={[sharedStyles.label, { color: colors.nbMuted }]}>{label}</Text>
    );
  }

  return (
    <View style={sharedStyles.section}>
      {labelNode}
      <Text style={[sharedStyles.value, { color: colors.nbInk }]}>{String(value)}</Text>
    </View>
  );
}

/**
 * Form field label with muted styling.
 * @param {object} props
 * @returns {React.ReactElement|null}
 */
export function FieldLabel({ label }) {
  const colors = usePopupColors();

  if (!label) {
    return null;
  }

  return <Text style={[sharedStyles.label, { color: colors.nbMuted }]}>{label}</Text>;
}

/**
 * Neobrutalist single or multiline text input for popups.
 * @param {object} props
 * @returns {React.ReactElement}
 */
export function PopupTextField({ value, onChangeText, placeholder, multiline = false }) {
  const colors = usePopupColors();

  const fieldThemeStyle = {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    color: colors.nbInk,
    shadowColor: colors.nbShadow,
  };

  let fieldStyle = [sharedStyles.textField, fieldThemeStyle];
  if (multiline) {
    fieldStyle = [sharedStyles.textField, sharedStyles.textFieldMulti, fieldThemeStyle];
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.nbMuted}
      multiline={multiline}
      style={fieldStyle}
    />
  );
}

function listVisibleInfoRows(rows) {
  const list = rows || [];
  const visible = [];

  for (let index = 0; index < list.length; index += 1) {
    const row = list[index];
    if (!row) {
      continue;
    }
    if (row.value == null || row.value === '') {
      continue;
    }
    visible.push(row);
  }

  return visible;
}

function tableRowStyle(isLastRow, borderColor) {
  if (isLastRow) {
    return [sharedStyles.tableRow];
  }
  return [
    sharedStyles.tableRow,
    { borderBottomWidth: TABLE_ROW_DIVIDER_WIDTH, borderBottomColor: borderColor },
  ];
}

/**
 * Table displaying key-value information rows.
 * @param {object} props
 * @returns {React.ReactElement|null}
 */
export function InfoTable({ rows }) {
  const colors = usePopupColors();
  const visible = listVisibleInfoRows(rows);

  if (!visible.length) {
    return null;
  }

  const rowViews = [];
  for (let index = 0; index < visible.length; index += 1) {
    const row = visible[index];
    const isLastRow = index === visible.length - 1;
    const rowStyle = tableRowStyle(isLastRow, colors.nbBorder);

    rowViews.push(
      <View key={`${row.label}-${index}`} style={rowStyle}>
        <Text style={[sharedStyles.tableLabel, { color: colors.nbMuted }]}>{row.label}</Text>
        <Text style={[sharedStyles.tableValue, { color: colors.nbInk }]}>{String(row.value)}</Text>
      </View>,
    );
  }

  const cardThemeStyle = {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    shadowColor: colors.nbShadow,
  };

  return (
    <View style={[sharedStyles.tableCard, cardThemeStyle]}>
      {rowViews}
    </View>
  );
}

function listVisibleDiffRows(rows) {
  const list = rows || [];
  const visible = [];

  for (let index = 0; index < list.length; index += 1) {
    const row = list[index];
    if (!row) {
      continue;
    }
    const hasBefore = row.before != null && row.before !== '';
    const hasAfter = row.after != null && row.after !== '';
    if (!hasBefore && !hasAfter) {
      continue;
    }
    visible.push(row);
  }

  return visible;
}

function diffAfterDisplayText(row, hasBefore, hasAfter) {
  if (hasAfter) {
    return String(row.after);
  }
  if (hasBefore) {
    return String(row.before);
  }
  return '';
}

function DiffTableRow({ row, index, isLastRow, colors }) {
  const hasBefore = row.before != null && row.before !== '';
  const hasAfter = row.after != null && row.after !== '';
  const beforeMatchesAfter =
    hasBefore && hasAfter && String(row.before) === String(row.after);

  const showStrikethroughBefore = hasBefore && !beforeMatchesAfter;
  const afterText = diffAfterDisplayText(row, hasBefore, hasAfter);
  const showAfter = afterText !== '';
  const rowStyle = tableRowStyle(isLastRow, colors.nbBorder);

  let beforeNode = null;
  if (showStrikethroughBefore) {
    beforeNode = (
      <Text style={[sharedStyles.diffBefore, { color: colors.nbMuted }]}>
        {String(row.before)}
      </Text>
    );
  }

  let afterNode = null;
  if (showAfter) {
    afterNode = (
      <Text style={[sharedStyles.diffAfter, { color: colors.nbInk }]}>{afterText}</Text>
    );
  }

  return (
    <View key={`${row.label}-${index}`} style={rowStyle}>
      <Text style={[sharedStyles.tableLabel, { color: colors.nbMuted }]}>{row.label}</Text>
      <View style={sharedStyles.diffValues}>
        {beforeNode}
        {afterNode}
      </View>
    </View>
  );
}

/**
 * Table displaying before and after comparison values.
 * @param {object} props
 * @returns {React.ReactElement|null}
 */
export function DiffTable({ rows }) {
  const colors = usePopupColors();
  const visible = listVisibleDiffRows(rows);

  if (!visible.length) {
    return null;
  }

  const rowViews = [];
  for (let index = 0; index < visible.length; index += 1) {
    const row = visible[index];
    const isLastRow = index === visible.length - 1;
    rowViews.push(
      <DiffTableRow
        key={`${row.label}-${index}`}
        row={row}
        index={index}
        isLastRow={isLastRow}
        colors={colors}
      />,
    );
  }

  const cardThemeStyle = {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    shadowColor: colors.nbShadow,
  };

  return (
    <View style={[sharedStyles.tableCard, cardThemeStyle]}>
      {rowViews}
    </View>
  );
}

function fillChipBackgroundColor(selected, colors) {
  if (selected) {
    return colors.nbFill;
  }
  return colors.nbSurface;
}

function fillChipLabelColor(selected, colors) {
  if (selected) {
    return colors.nbOnFill;
  }
  return colors.nbInk;
}

function fillChipPressStyle(pressed, colors, chipBackgroundColor) {
  let opacity = 1;
  let translateX = 0;
  let translateY = 0;

  if (pressed) {
    opacity = FILL_CHIP_PRESSED_OPACITY;
    translateX = FILL_CHIP_PRESS_NUDGE_X;
    translateY = FILL_CHIP_PRESS_NUDGE_Y;
  }

  return [
    sharedStyles.fillChip,
    {
      borderColor: colors.nbBorder,
      backgroundColor: chipBackgroundColor,
      opacity,
      transform: [{ translateX }, { translateY }],
      shadowColor: colors.nbShadow,
    },
  ];
}

/**
 * Selectable pill chip with press feedback.
 * @param {object} props
 * @returns {React.ReactElement}
 */
export function FillChip({ label, selected = false, onPress }) {
  const colors = usePopupColors();
  const chipBackgroundColor = fillChipBackgroundColor(selected, colors);
  const chipLabelColor = fillChipLabelColor(selected, colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => fillChipPressStyle(pressed, colors, chipBackgroundColor)}
    >
      <Text style={[sharedStyles.fillChipText, { color: chipLabelColor }]}>{label}</Text>
    </Pressable>
  );
}

function buildFillChipElements(options, value, onChange) {
  const list = options || [];
  const chips = [];

  for (let index = 0; index < list.length; index += 1) {
    const option = list[index];
    const isSelected = value === option.id;

    chips.push(
      <FillChip
        key={option.id}
        label={option.label}
        selected={isSelected}
        onPress={() => {
          if (typeof onChange === 'function') {
            onChange(option.id);
          }
        }}
      />,
    );
  }

  return chips;
}

/**
 * Row of selectable fill chips.
 * @param {object} props
 * @returns {React.ReactElement}
 */
export function FillChipRow({ options, value, onChange }) {
  const chips = buildFillChipElements(options, value, onChange);
  return <View style={sharedStyles.chipWrap}>{chips}</View>;
}

function macroCellDisplayValue(value) {
  if (value == null || value === '') {
    return EMPTY_MACRO_PLACEHOLDER;
  }
  return String(value);
}

function buildMacroStatCardElements(protein, carbs, fats, colors) {
  const cells = [
    { key: MACRO_CELL_PROTEIN.key, label: MACRO_CELL_PROTEIN.label, value: protein },
    { key: MACRO_CELL_CARBS.key, label: MACRO_CELL_CARBS.label, value: carbs },
    { key: MACRO_CELL_FATS.key, label: MACRO_CELL_FATS.label, value: fats },
  ];

  const cards = [];
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    const displayValue = macroCellDisplayValue(cell.value);
    const cardThemeStyle = {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface,
      shadowColor: colors.nbShadow,
    };

    cards.push(
      <View key={cell.key} style={[sharedStyles.macroCard, cardThemeStyle]}>
        <Text style={[sharedStyles.macroValue, { color: colors.nbInk }]}>{displayValue}</Text>
        <Text style={[sharedStyles.macroLabel, { color: colors.nbMuted }]}>{cell.label}</Text>
      </View>,
    );
  }

  return cards;
}

/**
 * Three stat cards displaying protein, carbs, and fats.
 * @param {object} props
 * @returns {React.ReactElement}
 */
export function MacroStatCards({ protein, carbs, fats }) {
  const colors = usePopupColors();
  const cards = buildMacroStatCardElements(protein, carbs, fats, colors);
  return <View style={sharedStyles.macroRow}>{cards}</View>;
}

/**
 * Hero block displaying a large value and subtitle with children.
 * @param {object} props
 * @returns {React.ReactElement}
 */
export function BigValueBlock({ label, valueLabel, children }) {
  const colors = usePopupColors();
  const inkColor = colors.nbInk;

  let labelNode = null;
  if (label) {
    labelNode = (
      <Text style={[sharedStyles.heroLabel, { color: inkColor }]}>{label}</Text>
    );
  }

  return (
    <View style={{ marginBottom: spacing.md }}>
      {labelNode}
      <Text style={[sharedStyles.heroValue, { color: inkColor }]}>{valueLabel}</Text>
      {children}
    </View>
  );
}

/**
 * Slider component wrapped with themed gradient accents.
 * @param {object} props
 * @returns {React.ReactElement}
 */
export function PopupSlider(props) {
  let sliderColors = accentGradients[0];
  if (props.colors) {
    sliderColors = props.colors;
  }
  return <NbSlider colors={sliderColors} {...props} />;
}

// ===== MAIN FUNCTION =====

/**
 * Title, optional Coach-wants badge, optional reasoning, then popup fields.
 * Flow: 1. theme  2. optional badge  3. title  4. reasoning  5. children
 */
export function ToolModalBody({ title, badge, children, reasoning }) {
  // 1. Theme tokens for title + reasoning ink.
  const colors = usePopupColors();
  const titleInkStyle = { color: colors.nbInk };
  const mutedInkColor = colors.nbMuted;

  let badgeNode = null;
  if (badge) {
    badgeNode = <CoachWantsBadge text={badge} />;
  }

  // 2–5. Badge (if any) → title → reasoning → body fields from the caller.
  return (
    <View>
      {badgeNode}
      <Text style={[sharedStyles.title, titleInkStyle]}>{title}</Text>
      <ReasoningLine reasoning={reasoning} mutedInkColor={mutedInkColor} />
      {children}
    </View>
  );
}

function confirmButtonContent(loading, confirmLabel, onFillColor) {
  if (!loading) {
    return confirmLabel;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <ActivityIndicator color={onFillColor} size="small" />
      <Text style={{ color: onFillColor, fontWeight: '800' }}>{confirmLabel}</Text>
    </View>
  );
}

/**
 * Not now (ghost) + Confirm (fill). Confirm shows a spinner while the action runs.
 * Flow: 1. theme  2. pick confirm content  3. render both buttons
 */
export function ConfirmCancelRow({
  onConfirm,
  onCancel,
  loading,
  confirmLabel = DEFAULT_CONFIRM_LABEL,
  cancelLabel = CANCEL_LABEL,
}) {
  // 1. Theme tokens for the fill spinner / label.
  const colors = usePopupColors();

  // 2. Spinner + label while the tool promise is in flight.
  const confirmContent = confirmButtonContent(loading, confirmLabel, colors.nbOnFill);

  // 3. Ghost cancel on the left, fill confirm on the right.
  return (
    <View style={sharedStyles.buttons}>
      <View style={{ flex: 1 }}>
        <NbButton
          variant="ghost"
          onPress={onCancel}
          disabled={loading}
          accessibilityLabel={cancelLabel}
        >
          {cancelLabel}
        </NbButton>
      </View>
      <View style={{ flex: 1 }}>
        <NbButton
          variant="fill"
          onPress={onConfirm}
          disabled={loading}
          accessibilityLabel={confirmLabel}
        >
          {confirmContent}
        </NbButton>
      </View>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const sharedStyles = StyleSheet.create({
  badgeWrap: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm + 2,
  },
  badge: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: spacing.sm,
  },
  reasoning: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.sm + 2 },
  label: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  textField: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.md,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  textFieldMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  tableCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
    marginBottom: spacing.md,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tableRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tableLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tableValue: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  diffValues: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  diffBefore: {
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  diffAfter: {
    fontSize: 15,
    fontWeight: '900',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  fillChip: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  fillChipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  macroCard: {
    flex: 1,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  macroLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.md + 4,
    width: '100%',
  },
});
