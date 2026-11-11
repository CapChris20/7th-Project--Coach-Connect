// Quick actions row: messages, photo gallery and workout plans, each with an icon chip and an optional badge.
// Flow: build the three tiles from the screen's handlers → draw them side by side → show a count badge when there is news.
// Used by NewHomeLayout directly under the workout section.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Dumbbell, Image as ImageIcon, MessageSquare } from 'lucide-react-native';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { NbIconChip } from '../../../look-and-feel/nb/NbAccentPieces';
import { NbSurface } from '../../../look-and-feel/nb/NbSurface';
import {
  NB_RADIUS,
  NB_SPACING,
  NB_TEXT_ON_ACCENT,
  getNbAccent,
  getNbColors,
} from '../../../look-and-feel/nb/nbTokens';

// ===== NAMED CONSTANTS =====

const BADGE_COUNT_CAP = 99;
const ICON_SIZE = 20;
const ACCENT_STEP = 3;
const FIRST_ACCENT_POSITION = 1;
const BADGE_SIZE = 24;

// ===== HELPER FUNCTIONS =====

/**
 * @param {number} count
 * @returns {string} The count, or 99+ for large counts.
 */
function badgeText(count) {
  if (count > BADGE_COUNT_CAP) return `${BADGE_COUNT_CAP}+`;
  return String(count);
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {number} props.unreadMessageCount
 * @param {number} props.photoGalleryBadgeCount
 * @param {number} props.aiWorkoutsBadgeCount
 * @param {Function} props.onPressMessage
 * @param {Function} [props.onOpenPhotoGallery] Called with { id, name }.
 * @param {Function} [props.onOpenAIWorkouts] Called with { id, name }.
 * @param {string} [props.trainerClientId]
 * @param {string} [props.trainerClientName]
 * @returns {JSX.Element}
 */
export function NewHomeQuickActions({
  unreadMessageCount,
  photoGalleryBadgeCount,
  aiWorkoutsBadgeCount,
  onPressMessage,
  onOpenPhotoGallery,
  onOpenAIWorkouts,
  trainerClientId,
  trainerClientName,
}) {
  // 1. Colors for the current theme, and the person the gallery and plans open for.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  const client = { id: trainerClientId, name: trainerClientName };

  // 2. One entry per tile.
  const tiles = [
    { label: 'Messages', Icon: MessageSquare, badge: Number(unreadMessageCount) || 0, onPress: onPressMessage },
    { label: 'Photos', Icon: ImageIcon, badge: Number(photoGalleryBadgeCount) || 0, onPress: () => onOpenPhotoGallery?.(client) },
    { label: 'Plans', Icon: Dumbbell, badge: Number(aiWorkoutsBadgeCount) || 0, onPress: () => onOpenAIWorkouts?.(client) },
  ];

  // 3. Tiles side by side.
  return (
    <View style={styles.row}>
      {tiles.map((tile, position) => (
        <View key={tile.label} style={styles.slot}>
          <Pressable
            onPress={tile.onPress || (() => {})}
            accessibilityRole="button"
            accessibilityLabel={tile.badge ? `${tile.label}, ${tile.badge} new` : tile.label}
          >
            <NbSurface radius={NB_RADIUS.card} innerStyle={styles.tileInner}>
              <NbIconChip accent={getNbAccent(FIRST_ACCENT_POSITION + position * ACCENT_STEP)}>
                <tile.Icon color={NB_TEXT_ON_ACCENT} size={ICON_SIZE} />
              </NbIconChip>
              <Text numberOfLines={1} style={[styles.label, { color: colors.ink }]}>
                {tile.label}
              </Text>
            </NbSurface>
          </Pressable>
          {tile.badge > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.ink }]}>
              <Text style={[styles.badgeText, { color: colors.onInk }]}>{badgeText(tile.badge)}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default NewHomeQuickActions;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: NB_SPACING.medium },
  slot: { flex: 1 },
  tileInner: { alignItems: 'center', gap: NB_SPACING.small, paddingVertical: NB_SPACING.medium, paddingHorizontal: NB_SPACING.small },
  label: { fontSize: 13, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -8,
    right: 0,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
});
