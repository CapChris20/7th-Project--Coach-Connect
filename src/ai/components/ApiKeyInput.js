import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';
import { saveApiKey } from '../services/apiKeyService';

export default function ApiKeyInput({ onSave }) {
  const { colors, spacing, isDark } = useTheme();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);

  const styles = StyleSheet.create({
    container: {
      width: '100%',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 8,
      elevation: 5,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
    },
    label: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    input: {
      width: '100%',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.3)' : colors.border,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 14,
      marginBottom: spacing.sm,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    buttonText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 16,
      textAlign: 'center',
    },
  });

  const handleSave = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      await saveApiKey(trimmed);
      setApiKeyInput('');
      if (onSave) onSave();
    } catch (e) {
      console.error('Error saving API key:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label} selectable={true}>
          Paste your OpenAI API key (stored securely)
        </Text>
        <TextInput
          value={apiKeyInput}
          onChangeText={setApiKeyInput}
          placeholder="sk-... (or project key)"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
        />
        <TouchableOpacity
          onPress={handleSave}
          style={styles.button}
          disabled={saving || !apiKeyInput.trim()}
        >
          <Text style={styles.buttonText} selectable={true}>
            {saving ? 'Saving...' : 'Save API Key'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

