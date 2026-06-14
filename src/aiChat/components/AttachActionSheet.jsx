import React from 'react';
import { InteractionManager, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OPTIONS = [
  { label: 'Photo Library', icon: 'image-outline', key: 'library' },
  { label: 'Camera', icon: 'camera-outline', key: 'camera' },
  { label: 'File', icon: 'document-outline', key: 'file' },
];

export default function AttachActionSheet({
  visible,
  onClose,
  onPhotoLibrary,
  onCamera,
  onFile,
  t,
}) {
  const insets = useSafeAreaInsets();
  const actions = {
    library: onPhotoLibrary,
    camera: onCamera,
    file: onFile,
  };

  const runAction = (key) => {
    const action = actions[key];
    if (typeof action !== 'function') return;
    onClose();
    // Dismiss modal before native picker (iOS fails if modal + picker stack).
    InteractionManager.runAfterInteractions(() => {
      setTimeout(async () => {
        try {
          await action();
        } catch (e) {
          console.warn('[AttachActionSheet] action failed:', e?.message || e);
        }
      }, 400);
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: t.cardBg === '#FFFFFF' ? '#FFFFFF' : 'rgba(20,20,30,0.98)',
              borderColor: t.cardBorder,
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: t.textMuted }]} />
          </View>

          {OPTIONS.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => runAction(item.key)}
              activeOpacity={0.7}
              style={[styles.row, { borderBottomColor: t.divider }]}
            >
              <Ionicons name={item.icon} size={22} color={t.textSecondary} />
              <Text style={[styles.rowLabel, { color: t.textPrimary }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.cancelRow}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 24,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelRow: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
