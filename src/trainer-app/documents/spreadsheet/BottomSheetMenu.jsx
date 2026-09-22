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

export default function BottomSheetMenu({ visible, onClose, title, children, theme }) {
  // vocab: Animated.Value = a number the native animation system can drive without JS involvement.
  // useRef(...).current is the standard way to create it exactly once per mount — a bare
  // `new Animated.Value(0)` in the body would be rebuilt every render, resetting the drag.
  const dragY = useRef(new Animated.Value(0)).current;
  // The same offset is ALSO kept in state because the transform below reads the plain number.
  // dragY is retained so this can be upgraded to a native-driven animation without rework.
  const [drag, setDrag] = useState(0);

  // vocab: PanResponder = React Native's raw touch/gesture handler. `g` is the gesture state;
  // g.dy is how far the finger has moved vertically since touch-down (positive = downward).
  // Built inside useRef so the responder is created once — recreating it mid-drag would drop the
  // gesture halfway through.
  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once the finger has clearly moved DOWN. Manipulate here: 4px is the
      // slop that lets a tap stay a tap, and (because it requires dy > 0) lets an upward swipe pass
      // through to the ScrollView inside instead of being stolen by the sheet.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
      onPanResponderMove: (_, g) => {
        // Track downward movement only. Ignoring negative dy is what prevents the user from
        // dragging the sheet UP past its resting position.
        if (g.dy > 0) {
          setDrag(g.dy);
          dragY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        // Manipulate here: 80px is the dismiss threshold — drag further than this and the sheet
        // closes; anything less snaps back. Lower it for a twitchier dismiss.
        if (g.dy > 80) onClose?.();
        // Reset either way: on dismiss so the sheet isn't offset next time it opens, and on
        // snap-back so it returns to its resting place.
        setDrag(0);
        dragY.setValue(0);
      },
    }),
  ).current;

  // Unmount entirely when hidden. This is on top of Modal's own `visible` so the sheet's state
  // (including any in-progress drag) is discarded rather than lingering off-screen.
  if (!visible) return null;

  return (
    // transparent is what lets the dim backdrop below show the screen behind it — without it the
    // modal would paint an opaque background over everything.
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* Tap-outside-to-close. Pressable fills the space ABOVE the sheet (justifyContent flex-end
          in styles.backdrop pushes the sheet to the bottom), so a tap up there dismisses. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.backdropInner} />
      </Pressable>
      {/* The sheet itself. panHandlers wires the gesture recognizer above onto this view, so
          dragging anywhere on the sheet (handle, title, padding) can dismiss it. */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.sheet,
          {
            // vocab/symbol: theme?.headerBg || '#fff' = fall back to white if no theme was passed,
            // so the sheet is never transparent-on-transparent.
            backgroundColor: theme?.headerBg || '#fff',
            borderTopColor: theme?.border,
            // translateY follows the finger — this is what makes the sheet physically track the drag.
            transform: [{ translateY: drag }],
          },
        ]}
      >
        {/* The grab handle: purely an affordance. It has no gesture of its own — the whole sheet is
            draggable — it just tells the user that dragging is possible. */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: theme?.divider || '#ccc' }]} />
        </View>
        {/* Title is optional; render nothing (not an empty Text) so its padding doesn't reserve space. */}
        {title ? (
          <Text style={[styles.title, { color: theme?.text }]}>{title}</Text>
        ) : null}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          // bounces={false} matters here: the iOS rubber-band at the top of the list would fight
          // the drag-to-dismiss gesture, making dismissal feel unreliable.
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// One row in the sheet: optional icon tile, label, optional keyboard-shortcut hint.
// Kept in this file because it's meaningless outside a BottomSheetMenu, and pairing them here
// keeps the row's padding consistent with the sheet's.
export function SheetMenuItem({ icon, label, shortcut, onPress, theme }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      // Manipulate here: activeOpacity 0.7 is the press feedback; minHeight 44 is the standard
      // minimum tap target, which matters most for rows without an icon.
      activeOpacity={0.7}
      style={[styles.item, { minHeight: 44 }]}
    >
      {icon ? <View style={[styles.iconWrap, { backgroundColor: theme?.inputBg }]}>{icon}</View> : null}
      {/* flex: 1 on the label is what pushes the shortcut text to the far right edge. */}
      <Text style={[styles.itemLabel, { color: theme?.text, flex: 1 }]}>{label}</Text>
      {shortcut ? <Text style={[styles.shortcut, { color: theme?.textMuted }]}>{shortcut}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Manipulate here: 0.4 black is the dim behind the sheet — raise it to focus attention harder
    // on the sheet, lower it to keep more context visible.
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdropInner: { flex: 1 },
  sheet: {
    // Manipulate here: 80% max height keeps the sheet from becoming a full-screen takeover; the
    // top corner radii give it the standard sheet silhouette (bottom corners stay square since
    // they're off-screen).
    maxHeight: '80%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleRow: { alignItems: 'center', paddingTop: 10 },
  // Manipulate here: 40×5 with radius 3 is the familiar pill-shaped grab handle.
  handle: { width: 40, height: 5, borderRadius: 3 },
  title: { fontSize: 15, fontWeight: '700', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  // Manipulate here: 480 caps the scroll area independently of the sheet's 80% — that's what makes
  // long menus scroll rather than stretching the sheet to fill the screen.
  scroll: { maxHeight: 480 },
  // Extra bottom padding so the last row clears the home indicator.
  scrollContent: { paddingBottom: 28 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconWrap: {
    // Manipulate here: 36×36 rounded tile behind each icon, which is what visually aligns rows
    // whose icons have different intrinsic widths.
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: { fontSize: 15 },
  shortcut: { fontSize: 12 },
});
