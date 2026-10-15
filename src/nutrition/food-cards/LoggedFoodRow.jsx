// One logged food inside a meal section, drawn as a transparent card on that section's background.
// Flow: turn the log into card text → decide if it is expanded → wire edit, delete, and bookmark.
// Used by the daily food log when it lists foods already saved to a meal.

import React, { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import FoodCard from './FoodCard';
import { foodCardText } from './foodCardText';

// ===== NAMED CONSTANTS =====

const ROW_BOTTOM_GAP = 10;

// ===== HELPER FUNCTIONS =====

/**
 * Confirm screens force the card open. Everywhere else the row remembers its own toggle.
 * @param {boolean} isPermanentlyExpanded
 * @param {boolean} isExpanded
 * @returns {boolean}
 */
function isRowExpanded(isPermanentlyExpanded, isExpanded) {
  if (isPermanentlyExpanded) return true;
  return isExpanded;
}

/**
 * Functional setState updater. React passes the previous flag so two fast taps cannot both read a stale value.
 * @param {boolean} isCurrentlyExpanded
 * @returns {boolean}
 */
function toggledExpansion(isCurrentlyExpanded) {
  return !isCurrentlyExpanded;
}

/**
 * Permanently expanded rows have no chevron, so they get no toggle handler.
 * @param {boolean} isPermanentlyExpanded
 * @param {Function} setIsExpanded
 * @returns {Function|undefined}
 */
function expansionToggleHandler(isPermanentlyExpanded, setIsExpanded) {
  if (isPermanentlyExpanded) return undefined;
  return () => setIsExpanded(toggledExpansion);
}

/**
 * Edit is omitted when the parent did not pass a handler or the log is missing.
 * @param {Function|undefined} onEdit
 * @param {object|undefined} log
 * @returns {Function|undefined}
 */
function editHandlerForLoggedFood(onEdit, log) {
  if (!onEdit || !log) return undefined;
  return () => onEdit(log);
}

/**
 * Delete needs both a handler and a saved id. Unsaved rows cannot be removed by id.
 * @param {Function|undefined} onRemove
 * @param {object|undefined} log
 * @returns {Function|undefined}
 */
function deleteHandlerForLoggedFood(onRemove, log) {
  if (!onRemove || !log?.id) return undefined;
  return () => onRemove(log.id);
}

/**
 * Build the FoodCard prop bag so the main component stays a short checklist.
 * @param {object} options
 * @returns {object}
 */
function buildLoggedFoodCardProps({
  food,
  permanentlyExpanded,
  isExpanded,
  isDark,
  log,
  onEdit,
  onRemove,
  onBookmark,
  setIsExpanded,
}) {
  return {
    food,
    expanded: isRowExpanded(permanentlyExpanded, isExpanded),
    permanentlyExpanded,
    embedded: true,
    isDark,
    onToggle: expansionToggleHandler(permanentlyExpanded, setIsExpanded),
    onEdit: editHandlerForLoggedFood(onEdit, log),
    onDelete: deleteHandlerForLoggedFood(onRemove, log),
    onBookmark,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Transparent food card for one food that is already logged on a meal.
 * @param {object} props
 * @param {object} props.log Saved food record for this row.
 * @param {*} props.amount Serving amount shown on the card.
 * @param {Function} [props.onRemove] Called with the log id when the row is deleted.
 * @param {Function} [props.onEdit] Called with the log when the row is edited.
 * @param {Function} [props.onBookmark]
 * @param {boolean} [props.isDark]
 * @param {object} [props.style]
 * @param {boolean} [props.permanentlyExpanded] Confirm screens open fully and hide the chevron.
 * @returns {JSX.Element}
 */
export default function LoggedFoodRow({
  log,
  amount,
  onRemove,
  onEdit,
  onBookmark,
  isDark = true,
  style,
  permanentlyExpanded = false,
}) {
  // 1. Remember expand/collapse unless the parent forces it open.
  const [isExpanded, setIsExpanded] = useState(permanentlyExpanded);

  // 2. vocab: useMemo = reuse card text until log or amount changes.
  const food = useMemo(() => foodCardText(log, amount), [log, amount]);

  // 3. Wire handlers once, then paint the embedded card.
  const cardProps = buildLoggedFoodCardProps({
    food,
    permanentlyExpanded,
    isExpanded,
    isDark,
    log,
    onEdit,
    onRemove,
    onBookmark,
    setIsExpanded,
  });

  return (
    <View style={[styles.wrap, style]}>
      {/* embedded asks FoodCard for the in-section palette. The meal section already paints the background. */}
      <FoodCard {...cardProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: ROW_BOTTOM_GAP,
  },
});
