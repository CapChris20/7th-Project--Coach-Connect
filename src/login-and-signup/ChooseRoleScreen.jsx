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

// Manipulate here: pressed feedback on role tiles (opacity + hard-shadow nudge)
const PRESSED_OPACITY = 0.94;
const PRESSED_TILE_NUDGE = 2;
const SCROLL_BOTTOM_PAD_MIN = 16;
const SCROLL_BOTTOM_PAD_EXTRA = 24;

// ===== HELPER FUNCTIONS =====

/** Map a prop default into a frozen role id string. */
function normalizeInitialRole(initialRole) {
  if (initialRole === ROLE_TRAINER) return ROLE_TRAINER;
  return ROLE_CLIENT;
}

/** Keep scroll content clear of the home indicator. */
function scrollBottomPadding(safeBottom) {
  return Math.max(safeBottom, SCROLL_BOTTOM_PAD_MIN) + SCROLL_BOTTOM_PAD_EXTRA;
}

/**
 * Selected tiles use fill/onFill so the whole card reads as “chosen.”
 * Unselected tiles stay surface/ink (Design Law black/white, never purple borders).
 */
function colorsForRoleTile(isSelected, colors) {
  if (isSelected) {
    return {
      backgroundColor: colors.nbFill,
      titleColor: colors.nbOnFill,
      mutedColor: colors.nbOnFill,
      bulletColor: colors.nbOnFill,
    };
  }

  return {
    backgroundColor: colors.nbSurface,
    titleColor: colors.nbInk,
    mutedColor: colors.nbMuted,
    bulletColor: colors.nbInk,
  };
}

/** Pressed style for a role tile — opacity + 2px nudge mimics hard-shadow press. */
function pressedTileStyle(isPressed) {
  if (!isPressed) {
    return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] };
  }
  return {
    opacity: PRESSED_OPACITY,
    transform: [
      { translateX: PRESSED_TILE_NUDGE },
      { translateY: PRESSED_TILE_NUDGE },
    ],
  };
}

/**
 * One Design Law role tile — icon chip, title, bullet list.
 * vocab: Pressable = touchable that reports pressed for style feedback
 */
function RoleTile({ tile, selected, colors, onPress }) {
  const tileColors = colorsForRoleTile(selected, colors);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => {
        const pressLook = pressedTileStyle(pressed);
        return [
          styles.tile,
          {
            backgroundColor: tileColors.backgroundColor,
            borderColor: colors.nbBorder,
            shadowColor: colors.nbShadow,
            opacity: pressLook.opacity,
            transform: pressLook.transform,
          },
        ];
      }}
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
        <Text style={[styles.tileTitle, { color: tileColors.titleColor }]}>{tile.title}</Text>
      </View>
      {tile.bullets.map((bulletLine) => (
        <View key={bulletLine} style={styles.bulletRow}>
          <View style={[styles.bulletSq, { backgroundColor: tileColors.bulletColor }]} />
          <Text style={[styles.bulletText, { color: tileColors.mutedColor }]}>{bulletLine}</Text>
        </View>
      ))}
    </Pressable>
  );
}

/**
 * Pure layout — header, headline, tiles, Continue.
 * No hooks here so the default export can keep hook order frozen.
 */
function ChooseRoleScreenLayout({
  colors,
  bottomPad,
  selectedRole,
  onPickRole,
  onContinuePress,
  onBack,
}) {
  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <NbPageHeader title="Choose role" onBack={onBack} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: colors.nbInk }]}>
          How will you use Coach Connect?
        </Text>
        <Text style={[styles.caption, { color: colors.nbMuted }]}>
          You can switch later from Settings.
        </Text>

        <View style={styles.tileStack}>
          {ROLE_TILES.map((tile) => {
            const tileIsSelected = selectedRole === tile.id;
            return (
              <RoleTile
                key={tile.id}
                tile={tile}
                selected={tileIsSelected}
                colors={colors}
                onPress={() => onPickRole(tile.id)}
              />
            );
          })}
        </View>

        <NbButton
          variant="fill"
          onPress={onContinuePress}
          style={{ marginTop: spacing.lg }}
        >
          Continue ›
        </NbButton>
      </ScrollView>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Design Law role picker before signup — client vs trainer tiles and Continue.
 * Flow: 1. theme/insets  2. selected role state  3. paint layout
 * @param {{ initialRole?: string, onBack?: Function, onContinue?: Function }} props
 */
export default function ChooseRoleScreen({
  initialRole = ROLE_CLIENT,
  onBack,
  onContinue,
}) {
  // 1. Theme tokens + safe-area bottom for scroll padding
  // vocab: useTheme = Design Law light/dark color bag (nbBackground, nbInk, …)
  const { colors } = useTheme();
  // vocab: useSafeAreaInsets = device notches / home-indicator padding
  const insets = useSafeAreaInsets();

  // 2. Role ids stay 'client' | 'trainer' — same strings LoginScreen / cachePendingSignupProfile use
  const [selectedRole, setSelectedRole] = useState(normalizeInitialRole(initialRole));

  const bottomPad = scrollBottomPadding(insets.bottom);

  // 3. Handlers — pick tile, then Continue hands role to parent
  const handlePickRole = (roleId) => {
    setSelectedRole(roleId);
  };

  const handleContinuePress = () => {
    // vocab/symbol: ?. = call only if onContinue was passed
    onContinue?.(selectedRole);
  };

  // 4. Paint
  return (
    <ChooseRoleScreenLayout
      colors={colors}
      bottomPad={bottomPad}
      selectedRole={selectedRole}
      onPickRole={handlePickRole}
      onContinuePress={handleContinuePress}
      onBack={onBack}
    />
  );
}

// ===== PLUMBING — skip unless debugging =====

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
