/**
 * Full-screen list of trainer-shared files (same grid chrome as home preview).
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FileGalleryGrid from './FileGalleryGrid';

export default function TrainerSharedFilesModal({
  visible,
  onClose,
  title = 'Trainer shared files',
  subtitle = 'Everything your coach has shared with you.',
  isDark,
  files,
  onPressItem,
}) {
  const insets = useSafeAreaInsets();
  const bg = isDark ? '#0A0A0F' : '#F7F7FA';
  const fg = isDark ? '#FFFFFF' : '#0B0B12';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: bg, paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={14} style={styles.backBtn} accessibilityRole="button">
            <Ionicons name="close" size={26} color={fg} />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={[styles.title, { color: fg }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24 + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FileGalleryGrid isDark={isDark} files={files || []} onPressItem={onPressItem} dense />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
});
