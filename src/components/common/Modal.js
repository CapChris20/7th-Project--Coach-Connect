import React from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

/**
 * Modal Component
 * @param {boolean} visible - Modal visibility
 * @param {function} onClose - Close handler
 * @param {ReactNode} children - Modal content
 * @param {string} title - Modal title
 */
export default function Modal({ visible, onClose, children, title }) {
  const { colors, spacing, borderRadius, fontSize, fontWeight } = useTheme();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: borderRadius.xl,
            padding: spacing.lg,
            width: width * 0.9,
            maxHeight: '80%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing.md,
            }}
          >
            {title && (
              <Text
                style={{
                  fontSize: fontSize.xl,
                  fontWeight: fontWeight.bold,
                  color: colors.text,
                  flex: 1,
                }}
              >
                {title}
              </Text>
            )}
            <TouchableOpacity
              onPress={onClose}
              style={{ padding: spacing.xs }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View>{children}</View>
        </View>
      </View>
    </RNModal>
  );
}

