// Design Law Choose role — two big tiles (client / trainer) + Continue (missing-screens 01/02).
// Flow: pick a tile → Continue calls onContinue(role) → LoginScreen advances to Create account.
// Used by LoginScreen when Get Started needs a role before signup fields.

import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import NbButton from '../look-and-feel/NbButton';
import { accentGradients, borderRadius, nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const ROLE_CLIENT = 'client';
const ROLE_TRAINER = 'trainer';

// Manipulate here: tile bullet copy must match missing-screens PNG 01/02
const ROLE_TILES = [
  {
    id: ROLE_CLIENT,
    title: 'I want a coach',
    icon: require('../assets/icons/handoff/people.png'),
    gradient: accentGradients[0],
    bullets: [
      'Find a trainer or join yours with a code',
      'Get a plan, log workouts and meals',
      'Message and book sessions',
    ],
  },
  {
    id: ROLE_TRAINER,
    title: 'I am a coach',
    icon: require('../assets/icons/handoff/dumbbell.png'),
    gradient: accentGradients[1],
    bullets: [
      'List yourself and take on clients',
      'Build plans, documents and sheets',
      'Track every client in one place',
    ],
  },
];

// ===== HELPERS =====

/**
 * Selected tile = filled (nbFill) with onFill text; unselected = surface + ink.
 * Dark mode flips the same way other Design Law fill cards do.
 * @param {boolean} selected
 * @param {object} colors
 */
function tileChrome(selected, colors) {
  if (selected) {
    return {
      bg: colors.nbFill,
      ink: colors.nbOnFill,
      muted: colors.nbOnFill,
      bullet: colors.nbOnFill,
    };
  }
  return {
    bg: colors.nbSurface,
    ink: colors.nbInk,
    muted: colors.nbMuted,
    bullet: colors.nbInk,
  };
}

// ===== UI PIECES =====

function RoleTile({ tile, selected, colors, onPress }) {
  const chrome = tileChrome(selected, colors);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: chrome.bg,
          borderColor: colors.nbBorder,
          shadowColor: colors.nbShadow,
          opacity: pressed ? 0.94 : 1,
          transform: [{ translateX: pressed ? 2 : 0 }, { translateY: pressed ? 2 : 0 }],
        },
      ]}
    >
      <View style={styles.tileHead}>
        <View style={[styles.iconWrap, { borderColor: colors.nbBorder }]}>
          <LinearGradient
            colors={tile.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Image source={tile.icon} style={styles.iconImg} resizeMode="contain" />
        </View>
        <Text style={[styles.tileTitle, { color: chrome.ink }]}>{tile.title}</Text>
      </View>
      {tile.bullets.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <View style={[styles.bulletSq, { backgroundColor: chrome.bullet }]} />
          <Text style={[styles.bulletText, { color: chrome.muted }]}>{line}</Text>
        </View>
      ))}
    </Pressable>
  );
}

// ===== MAIN =====

/**
 * @param {{ initialRole?: string, onBack?: Function, onContinue?: (role: string) => void }} props
 */
export default function ChooseRoleScreen({
  initialRole = ROLE_CLIENT,
  onBack,
  onContinue,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // vocab: role ids stay 'client' | 'trainer' — same strings LoginScreen / cachePendingSignupProfile use
  const [role, setRole] = useState(
    initialRole === ROLE_TRAINER ? ROLE_TRAINER : ROLE_CLIENT,
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <NbPageHeader title="Choose role" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: colors.nbInk }]}>
          How will you use Coach Connect?
        </Text>
        <Text style={[styles.caption, { color: colors.nbMuted }]}>
          You can switch later from Settings.
        </Text>

        <View style={styles.tileStack}>
          {ROLE_TILES.map((tile) => (
            <RoleTile
              key={tile.id}
              tile={tile}
              selected={role === tile.id}
              colors={colors}
              onPress={() => setRole(tile.id)}
            />
          ))}
        </View>

        <NbButton
          variant="fill"
          onPress={() => onContinue?.(role)}
          style={{ marginTop: spacing.lg }}
        >
          Continue ›
        </NbButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: nb.screenGutter,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  headline: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  tileStack: { gap: 14 },
  tile: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
    // Manipulate here: hard shadow offset for role tiles (Design Law card)
    shadowOffset: { width: nb.shadowOffsetCard, height: nb.shadowOffsetCard },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  tileHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImg: { width: 26, height: 26 },
  tileTitle: { fontSize: 18, fontWeight: '900', flex: 1 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  // Manipulate here: square bullet size from PNG
  bulletSq: { width: 8, height: 8, marginTop: 5, borderRadius: 1 },
  bulletText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
