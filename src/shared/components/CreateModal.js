import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Modal from './Modal';
import { useTheme } from '../ui/ThemeContext';

export default function CreateModal({ visible, onClose, userRole = 'trainer', onManageClients }) {
  const { colors, spacing, borderRadius, fontSize, fontWeight } = useTheme();

  return (
    <Modal visible={visible} onClose={onClose} title="Create">
      <View style={{ gap: spacing.sm }}>
        {userRole === 'trainer' && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              onClose?.();
              onManageClients?.();
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.card || 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: borderRadius.lg,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
            }}
          >
            <Ionicons name="people-outline" size={20} color={colors.text} />
            <Text
              style={{
                color: colors.text,
                fontSize: fontSize.md,
                fontWeight: fontWeight.semibold,
              }}
            >
              Manage Clients
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}
