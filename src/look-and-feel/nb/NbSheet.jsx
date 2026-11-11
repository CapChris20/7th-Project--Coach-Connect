// Bottom sheet: dimmed backdrop and one outlined card with a title and a close button.
// Flow: show a transparent Modal → tap the backdrop or the close button to ask the screen to close → render children inside.
// Used for quick logging (water, sleep, steps, weight), filters and short confirmations.

import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../lightDarkMode';
import { NbSurface } from './NbSurface';
import { MINIMUM_TOUCH_SIZE, NB_RADIUS, NB_SPACING, getNbColors } from './nbTokens';

// ===== NAMED CONSTANTS =====

const BACKDROP_COLOR = 'rgba(0,0,0,0.6)';
const TITLE_FONT_SIZE = 20;
const SHEET_SIDE_MARGIN = 12;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string} props.title
 * @param {Function} props.onClose
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function NbSheet({ visible, title, onClose, children }) {
  // 1. Colors for the current theme.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);

  // 2. Backdrop first, then the card at the bottom. The keyboard pushes the card up.
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.cardWrap}>
          <NbSurface radius={NB_RADIUS.sheet} innerStyle={styles.cardInner}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeHit}>
                <X color={colors.ink} size={22} />
              </Pressable>
            </View>
            {children}
          </NbSurface>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default NbSheet;

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: BACKDROP_COLOR },
  cardWrap: { paddingHorizontal: SHEET_SIDE_MARGIN, paddingBottom: SHEET_SIDE_MARGIN },
  cardInner: { padding: NB_SPACING.large, gap: NB_SPACING.large },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: TITLE_FONT_SIZE, fontWeight: '800' },
  closeHit: { width: MINIMUM_TOUCH_SIZE, height: MINIMUM_TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
});
