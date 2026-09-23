import React, { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import FoodCard from './FoodCard';
import { foodCardText } from './foodCardText';

/**
 * Logged meal food row — transparent card that sits on meal section backgrounds.
 */
export default function LoggedFoodRow({
  log,
  amount,
  onRemove,
  onEdit,
  onBookmark,
  isDark = true,
  style,
  /** Confirm/verify surfaces should open fully expanded with no chevron. */
  permanentlyExpanded = false,
}) {
  const [expanded, setExpanded] = useState(permanentlyExpanded);
  const food = useMemo(() => foodCardText(log, amount), [log, amount]);

  return (
    <View style={[styles.wrap, style]}>
      <FoodCard
        food={food}
        expanded={permanentlyExpanded ? true : expanded}
        permanentlyExpanded={permanentlyExpanded}
        embedded
        isDark={isDark}
        onToggle={permanentlyExpanded ? undefined : () => setExpanded((v) => !v)}
        onEdit={onEdit && log ? () => onEdit(log) : undefined}
        onDelete={onRemove && log?.id ? () => onRemove(log.id) : undefined}
        onBookmark={onBookmark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
});
