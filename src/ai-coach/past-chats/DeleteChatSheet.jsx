// Design Law delete-chat confirm — “Cannot be undone” pill + Keep it / Delete chat.
// Flow: open with session title + count → Keep closes → Delete runs onConfirm then closes.
// Used by CoachConversationScreen and CoachHomeScreen (replaces Alert.alert).
// PNG: screens/ai-coach/15–16.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, spacing, borderRadius, nb } from '../../look-and-feel/colorPalette';
import { formatSessionDisplayTitle } from './chatHistoryList';

// ===== NAMED CONSTANTS =====

const WARN_GRADIENT = accentGradients[1] || ['#FB7185', '#EF4444'];

// ===== HELPER FUNCTIONS =====

function messageCountLabel(session) {
  const n = Number(session?.messageCount ?? session?.messages?.length ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 'its messages';
  return `${n} message${n === 1 ? '' : 's'}`;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ visible: boolean, session?: object|null, onClose: Function, onConfirm: Function }} props
 */
export default function DeleteChatSheet({ visible, session, onClose, onConfirm }) {
  const { colors } = useTheme();
  const title = formatSessionDisplayTitle(session?.title);
  const countCopy = messageCountLabel(session);

  return (
    <NbSheet visible={visible} onClose={onClose}>
      <View
        style={[
          styles.warnPill,
          { borderColor: colors.nbBorder },
        ]}
      >
        <LinearGradient
          colors={WARN_GRADIENT}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.warnFill}
        >
          <Text style={styles.warnText}>Cannot be undone</Text>
        </LinearGradient>
      </View>

      <Text style={[styles.title, { color: colors.nbInk }]}>Delete chat?</Text>
      <Text style={[styles.body, { color: colors.nbMuted }]}>
        {`“${title}” and ${countCopy} will be removed from this phone.`}
      </Text>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <NbButton variant="ghost" onPress={onClose}>
            Keep it
          </NbButton>
        </View>
        <View style={{ flex: 1 }}>
          <NbButton
            variant="fill"
            onPress={() => {
              onConfirm?.(session);
              onClose?.();
            }}
          >
            Delete chat
          </NbButton>
        </View>
      </View>
    </NbSheet>
  );
}

const styles = StyleSheet.create({
  warnPill: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  warnFill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  warnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0A0A',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
