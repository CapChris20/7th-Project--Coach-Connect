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
  const dragY = useRef(new Animated.Value(0)).current;
  const [drag, setDrag] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          setDrag(g.dy);
          dragY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) onClose?.();
        setDrag(0);
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
            backgroundColor: theme?.headerBg || '#fff',
            borderTopColor: theme?.border,
            transform: [{ translateY: drag }],
          },
        ]}
      >
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: theme?.divider || '#ccc' }]} />
        </View>
        {title ? (
          <Text style={[styles.title, { color: theme?.text }]}>{title}</Text>
        ) : null}
        <ScrollView style={styles.scroll} bounces={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

export function SheetMenuItem({ icon, label, shortcut, onPress, theme }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.item, { minHeight: 44 }]}
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
    paddingBottom: 24,
  },
  handleRow: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 40, height: 5, borderRadius: 3 },
  title: { fontSize: 15, fontWeight: '700', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  scroll: { maxHeight: 480 },
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
