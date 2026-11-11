// Neobrutalist bottom sheet with rounded top corners
// Flow: renders modal bottom sheet with thick border and optional soft gradient background
// Where used: modals, pickers, action sheets, forms
//
// vocab: bottom sheet = modal that slides up from bottom

import React from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, nb, gradients, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Bottom sheet modal with neobrutalist styling.
 * 
 * @param {object} props
 * @param {boolean} props.visible - modal visibility
 * @param {Function} props.onClose - close handler
 * @param {string} [props.title] - sheet title
 * @param {React.ReactNode} props.children - sheet content
 * @param {boolean} [props.gradient] - apply soft gradient background
 * @param {object} [props.style] - additional content styles
 */
export default function NbSheet({ visible, onClose, title, children, gradient = false, style }) {
  const { colors } = useTheme();
  
  const sheetContent = (
    <>
      <View style={styles.handle}>
        <View
          style={[
            styles.handleBar,
            { backgroundColor: colors.nbBorder },
          ]}
        />
      </View>
      
      {title && (
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: colors.nbInk },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
      
      <ScrollView style={styles.content}>
        <View style={style}>
          {children}
        </View>
      </ScrollView>
    </>
  );
  
  const sheetInner = gradient ? (
    <LinearGradient
      colors={gradients.soft.colors}
      start={gradients.soft.start}
      end={gradients.soft.end}
      style={[
        styles.sheet,
        {
          borderColor: colors.nbBorder,
        },
      ]}
    >
      {sheetContent}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
        },
      ]}
    >
      {sheetContent}
    </View>
  );
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
        />
        {sheetInner}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    maxHeight: '80%',
    paddingBottom: spacing.lg,
  },
  handle: {
    alignItems: 'center',
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
});
