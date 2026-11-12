// Design Law attach sheet — Choose an option (camera / library / analyze / paste).
// Flow: open from + → pick a row → close → parent runs the matching callback after a short delay.
// Used by CoachConversationScreen (and home if wired). PNG: screens/ai-coach/07–08.

import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NbSheet from '../../look-and-feel/NbSheet';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const OPTIONS = [
  {
    id: 'camera',
    title: 'Take a photo',
    subtitle: 'Use the camera',
    icon: require('../../assets/icons/handoff/picture.png'),
    gradient: accentGradients[0],
  },
  {
    id: 'library',
    title: 'Choose from library',
    subtitle: 'Pick up to 4 photos',
    icon: require('../../assets/icons/handoff/progress.png'),
    gradient: accentGradients[3],
  },
  {
    id: 'analyze',
    title: 'Analyze a progress photo',
    subtitle: 'Physique feedback',
    icon: require('../../assets/icons/handoff/scales.png'),
    gradient: accentGradients[2],
  },
  {
    id: 'paste',
    title: 'Paste text',
    subtitle: 'A workout, a label, a message',
    icon: require('../../assets/icons/handoff/week.png'),
    gradient: accentGradients[4],
  },
];

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   onCamera?: Function,
 *   onLibrary?: Function,
 *   onAnalyze?: Function,
 *   onPaste?: Function,
 * }} props
 */
export default function CoachAttachSheet({
  visible,
  onClose,
  onCamera,
  onLibrary,
  onAnalyze,
  onPaste,
}) {
  const { colors } = useTheme();

  const run = (id) => {
    onClose?.();
    // Short delay so NbSheet can dismiss before ImagePicker / paste sheet opens
    setTimeout(() => {
      if (id === 'camera') onCamera?.();
      else if (id === 'library') onLibrary?.();
      else if (id === 'analyze') onAnalyze?.();
      else if (id === 'paste') onPaste?.();
    }, 120);
  };

  return (
    <NbSheet visible={visible} onClose={onClose} title="Choose an option">
      {/* PNG 07: rows sit on the sheet — no second bordered frame around the list */}
      <View style={styles.list}>
        {OPTIONS.map((opt, index) => (
          <Pressable
            key={opt.id}
            onPress={() => run(opt.id)}
            style={({ pressed }) => [
              styles.row,
              {
                borderBottomWidth: index < OPTIONS.length - 1 ? 2 : 0,
                borderBottomColor: colors.nbBorder,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={opt.title}
          >
            <View style={[styles.iconChip, { borderColor: colors.nbBorder }]}>
              <LinearGradient
                colors={opt.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconFill}
              >
                <Image source={opt.icon} style={{ width: 26, height: 26 }} resizeMode="contain" />
              </LinearGradient>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.rowTitle, { color: colors.nbInk }]}>{opt.title}</Text>
              <Text style={[styles.rowSub, { color: colors.nbMuted }]}>{opt.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
          </Pressable>
        ))}
      </View>
    </NbSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    minHeight: 64,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.nbIconChip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  iconFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  rowSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
});
