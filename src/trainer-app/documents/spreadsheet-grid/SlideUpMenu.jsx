// Swipe-to-dismiss bottom sheet + its row component, used for the spreadsheet's action menus.
// Flow: tap outside OR drag down past a threshold → onClose; children scroll inside the sheet.
// Also exports SheetMenuItem, the standard icon + label + shortcut row placed inside it.

import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
  PanResponder,
} from 'react-native';

// ===== NAMED CONSTANTS =====

const PAN_CAPTURE_SLOP_DY = 4;
const DISMISS_DRAG_THRESHOLD_DY = 80;
const DEFAULT_SHEET_BACKGROUND = '#fff';
const DEFAULT_HANDLE_COLOR = '#ccc';
const ITEM_MIN_HEIGHT = 44;
const ITEM_ACTIVE_OPACITY = 0.7;

// ===== HELPER FUNCTIONS =====

/**
 * Only claim the gesture once the finger has clearly moved DOWN.
 * Manipulate here: 4px is the slop that lets a tap stay a tap, and (because it requires dy > 0)
 * lets an upward swipe pass through to the ScrollView inside.
 * @param {*} _event
 * @param {{ dy: number }} gestureState
 * @returns {boolean}
 */
function didFingerMoveDown(_event, gestureState) {
  return gestureState.dy > PAN_CAPTURE_SLOP_DY;
}

function shouldDismissSheet(gestureState) {
  return gestureState.dy > DISMISS_DRAG_THRESHOLD_DY;
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet. Unmounts entirely when hidden so an in-progress drag is discarded.
 * @param {{ visible: boolean, onClose: Function, title?: string, children: *, theme?: object }} props
 */
export default function SlideUpMenu({ visible, onClose, title, children, theme }) {
  // vocab: Animated.Value = a number the native animation system can drive without JS involvement.
  const dragY = useRef(new Animated.Value(0)).current;
  const [dragOffset, setDragOffset] = useState(0);

  // vocab: PanResponder = React Native's raw touch/gesture handler. gestureState.dy is how far
  // the finger has moved vertically since touch-down (positive = downward).
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: didFingerMoveDown,
      onPanResponderMove: (_event, gestureState) => {
        if (gestureState.dy > 0) {
          setDragOffset(gestureState.dy);
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_event, gestureState) => {
        if (shouldDismissSheet(gestureState)) onClose?.();
        setDragOffset(0);
        dragY.setValue(0);
      },
    }),
  ).current;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.backdropInner} />
      </Pressable>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.sheet,
          {
            backgroundColor: theme?.headerBg || DEFAULT_SHEET_BACKGROUND,
            borderTopColor: theme?.border,
            transform: [{ translateY: dragOffset }],
          },
        ]}
      >
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: theme?.divider || DEFAULT_HANDLE_COLOR }]} />
        </View>
        {title ? (
          <Text style={[styles.title, { color: theme?.text }]}>{title}</Text>
        ) : null}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

/**
 * One row in the sheet: optional icon tile, label, optional keyboard-shortcut hint.
 * @param {{ icon?: *, label: string, shortcut?: string, onPress: Function, theme?: object }} props
 */
export function SheetMenuItem({ icon, label, shortcut, onPress, theme }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={ITEM_ACTIVE_OPACITY}
      style={[styles.item, { minHeight: ITEM_MIN_HEIGHT }]}
    >
      {icon ? <View style={[styles.iconWrap, { backgroundColor: theme?.inputBg }]}>{icon}</View> : null}
      <Text style={[styles.itemLabel, { color: theme?.text, flex: 1 }]}>{label}</Text>
      {shortcut ? <Text style={[styles.shortcut, { color: theme?.textMuted }]}>{shortcut}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdropInner: { flex: 1 },
  sheet: {
    maxHeight: '80%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleRow: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 40, height: 5, borderRadius: 3 },
  title: { fontSize: 15, fontWeight: '700', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  scroll: { maxHeight: 480 },
  scrollContent: { paddingBottom: 28 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { fontSize: 15 },
  shortcut: { fontSize: 12 },
});
