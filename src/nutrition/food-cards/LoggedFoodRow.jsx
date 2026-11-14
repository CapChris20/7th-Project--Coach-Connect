// One food already on a meal — wraps FoodCard with embedded palette and local expand state.
// Flow: log row + amount string → foodCardText → wire edit/delete/bookmark → transparent FoodCard.
// Used by DailyFoodLogScreen meal sections.

import React, { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import FoodCard from './FoodCard';
import { foodCardText } from './foodCardText';

// ===== NAMED CONSTANTS =====

// Manipulate here: space under each logged row inside a meal section
const ROW_BOTTOM_GAP = 10;

// ===== HELPER FUNCTIONS =====

/**
 * Confirm screens force the card open. Everywhere else the row remembers its own chevron.
 * @param {boolean} permanentlyExpanded
 * @param {boolean} userToggledExpanded
 * @returns {boolean}
 */
function shouldShowCardExpanded(permanentlyExpanded, userToggledExpanded) {
  if (permanentlyExpanded) return true;
  return userToggledExpanded;
}

/**
 * Flip expand/collapse. React passes the previous flag so two fast taps cannot both read stale state.
 * vocab: functional updater = setState(fn) where fn receives the previous value
 * @param {boolean} wasExpanded
 * @returns {boolean}
 */
function flippedExpandFlag(wasExpanded) {
  return !wasExpanded;
}

/**
 * Permanently expanded rows hide the chevron, so they get no toggle handler.
 * @param {boolean} permanentlyExpanded
 * @param {Function} setUserToggledExpanded
 * @returns {Function|undefined}
 */
function buildToggleHandler(permanentlyExpanded, setUserToggledExpanded) {
  if (permanentlyExpanded) return undefined;
  return () => setUserToggledExpanded(flippedExpandFlag);
}

/**
 * Edit is omitted when the parent did not pass a handler or the log row is missing.
 * @param {Function|undefined} onEdit
 * @param {object|undefined} logRow
 * @returns {Function|undefined}
 */
function buildEditHandler(onEdit, logRow) {
  if (!onEdit || !logRow) return undefined;
  return () => onEdit(logRow);
}

/**
 * Delete needs both a handler and a saved Firestore id. Unsaved rows cannot be removed by id.
 * @param {Function|undefined} onRemove
 * @param {object|undefined} logRow
 * @returns {Function|undefined}
 */
function buildDeleteHandler(onRemove, logRow) {
  const logHasSavedId = Boolean(logRow?.id);
  if (!onRemove || !logHasSavedId) return undefined;
  return () => onRemove(logRow.id);
}

/**
 * Build the FoodCard prop bag so the main component stays a short checklist.
 * Key letters on `food` stay whatever foodCardText produced (name / calories / … frozen upstream).
 * @param {object} options
 * @returns {object}
 */
function buildEmbeddedFoodCardProps({
  food,
  permanentlyExpanded,
  userToggledExpanded,
  isDark,
  logRow,
  onEdit,
  onRemove,
  onBookmark,
  setUserToggledExpanded,
}) {
  const cardIsExpanded = shouldShowCardExpanded(permanentlyExpanded, userToggledExpanded);

  return {
    food,
    expanded: cardIsExpanded,
    permanentlyExpanded,
    embedded: true,
    isDark,
    onToggle: buildToggleHandler(permanentlyExpanded, setUserToggledExpanded),
    onEdit: buildEditHandler(onEdit, logRow),
    onDelete: buildDeleteHandler(onRemove, logRow),
    onBookmark,
  };
}

// ===== MAIN FUNCTION =====

/**
 * One logged meal row drawn as an embedded FoodCard on the meal section background.
 * @param {{ log: object, amount?: string, onRemove?: Function, onEdit?: Function, onBookmark?: Function, isDark?: boolean, style?: object, permanentlyExpanded?: boolean }} props
 */
export default function LoggedFoodRow({
  log,
  amount,
  onRemove,
  onEdit,
  onBookmark,
  isDark = true,
  style: rowStyle,
  permanentlyExpanded = false,
}) {
  // 1. Chevron expand state — skipped when confirm screens pass permanentlyExpanded.
  // vocab: useState = React state hook; initial value mirrors permanentlyExpanded so confirm opens expanded
  const [userToggledExpanded, setUserToggledExpanded] = useState(permanentlyExpanded);

  // 2. Turn the Firestore log + amount label into the card text FoodCard already understands.
  // vocab: useMemo = rebuild only when log or amount changes (not on every parent paint)
  // Hook order frozen: useState then useMemo — do not reorder.
  const food = useMemo(() => foodCardText(log, amount), [log, amount]);

  // 3. Map parent callbacks into FoodCard props, then render embedded on the meal background.
  const cardProps = buildEmbeddedFoodCardProps({
    food,
    permanentlyExpanded,
    userToggledExpanded,
    isDark,
    logRow: log,
    onEdit,
    onRemove,
    onBookmark,
    setUserToggledExpanded,
  });

  return (
    <View style={[styles.wrap, rowStyle]}>
      <FoodCard {...cardProps} />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  wrap: {
    marginBottom: ROW_BOTTOM_GAP,
  },
});
