import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/ThemeContext';

/**
 * Input Component
 * @param {string} label - Label text above input
 * @param {string} value - Input value
 * @param {function} onChangeText - Text change handler
 * @param {string} placeholder - Placeholder text
 * @param {boolean} secureTextEntry - Hide text (password)
 * @param {string} error - Error message to display
 * @param {string} keyboardType - Keyboard type
 */
export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  error,
  keyboardType = 'default',
  ...props
}) {
  const { colors, spacing, borderRadius, fontSize, fontWeight } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && (
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: colors.textSecondary,
            marginBottom: spacing.sm,
          }}
        >
          {label}
        </Text>
      )}
      <View style={{ position: 'relative' }}>
        <TextInput
          style={{
            height: 48,
            borderWidth: 1,
            borderColor: error ? colors.error : colors.border,
            borderRadius: borderRadius.md,
            paddingHorizontal: spacing.md,
            paddingRight: secureTextEntry ? 40 : spacing.md,
            fontSize: fontSize.md,
            color: colors.text,
            backgroundColor: colors.surface,
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              right: spacing.md,
              top: 14,
              padding: spacing.xs,
            }}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text
          style={{
            fontSize: fontSize.sm,
            color: colors.error,
            marginTop: spacing.xs,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

