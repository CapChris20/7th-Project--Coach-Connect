// Design Law food row card: HardShadow shell → compact macros → optional expand → actions.
// Flow: press → expand NutritionFactsPanel / add / favorite. Used by search + food lists.
// vocab: HardShadow = solid offset shadow (no blur)

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Pencil,
  Trash2,
  ChevronDown,
  Bookmark,
  Plus,
  Heart,
} from 'lucide-react-native';
import ColorText from './ColorText';
import NutritionFactsPanel from './NutritionFactsPanel';
import { gradients, fonts, pillBackgroundGradient, getFoodCardPalette } from './foodCardColors';
import HardShadow from '../../look-and-feel/HardShadow';
import {
  nb,
  borderRadius,
  gradients as nbGradients,
  lightColors,
  darkColors,
} from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function IconAction({ onPress, children, accessibilityLabel, palette }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconAction,
        pressed && { backgroundColor: palette.iconPressBg },
      ]}
    >
      {({ pressed }) =>
        typeof children === 'function' ? children(pressed) : children
      }
    </Pressable>
  );
}

function MacroPill({ label, grams, gradientStops, palette }) {
  const pillBackground = pillBackgroundGradient(gradientStops);
  const display = Math.round(Number(grams) || 0);

  return (
    <View style={[styles.macroPillOuter, { borderColor: palette.borderStrong }]}>
      <LinearGradient colors={pillBackground} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.macroPillBg}>
        <ColorText
          colors={gradientStops}
          style={styles.macroPillLabel}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {label}
        </ColorText>
        <View style={styles.macroPillValueRow}>
          <Text style={[styles.macroPillValue, { color: palette.foreground }]}>{display}</Text>
          <Text style={[styles.macroPillUnit, { color: palette.mutedForeground }]}>g</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Premium expandable food logging card.
 */
export default function FoodCard({
  food,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onBookmark,
  /** Search / add-to-log — shows a plus in the action row. */
  onAdd,
  /** Optional favorite toggle for search results. */
  onFavorite,
  isFavorite = false,
  isDark = true,
  embedded = false,
  palette: paletteProp,
  /** When true, card stays expanded and the chevron toggle is hidden (confirm/verify screens). */
  permanentlyExpanded = false,
}) {
  const isExpanded = permanentlyExpanded ? true : expanded;
  const palette = useMemo(
    () => paletteProp ?? getFoodCardPalette(isDark, { embedded }),
    [paletteProp, isDark, embedded],
  );

  const scale = useSharedValue(1);
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const subtitle = food?.subtitle || [food?.brand, food?.serving, food?.weightG ? `${food.weightG}g` : null]
    .filter(Boolean)
    .join(' · ');

  const micros = food?.micronutrients || {};
  const pct = food?.macroPercents || { carbs: 0, protein: 0, fat: 0 };

  const handleToggle = () => {
    if (permanentlyExpanded) return;
    if (!isExpanded) {
      Haptics.selectionAsync().catch(() => {});
    }
    onToggle?.();
  };

  const handleAdd = () => {
    Haptics.selectionAsync().catch(() => {});
    onAdd?.();
  };

  // Manipulate here: soft wash in light embedded cards; flat nbSurface otherwise
  const frameFill = isDark
    ? darkColors.nbSurface
    : (embedded ? nbGradients.soft.colors[0] : lightColors.nbSurface);
  const frameBorder = isDark ? darkColors.nbBorder : lightColors.nbBorder;

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withTiming(0.985, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
      style={[styles.cardPressable, animatedCardStyle]}
    >
      <HardShadow
        radius={borderRadius.nbCard}
        offset={embedded ? 0 : nb.shadowOffsetCard}
        style={styles.cardFrame}
      >
        <View
          style={{
            backgroundColor: frameFill,
            borderWidth: nb.borderWidth,
            borderColor: frameBorder,
            borderRadius: borderRadius.nbCard,
            overflow: onAdd || embedded ? 'visible' : 'hidden',
          }}
        >

      <View
        style={[styles.innerHighlight, { backgroundColor: palette.innerHighlight }]}
        pointerEvents="none"
      />

      <View style={styles.compactBody}>
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.foodName, { color: palette.foreground }]}
                numberOfLines={3}
              >
                {food?.name || 'Food'}
              </Text>
            </View>
            {subtitle ? (
              <Text
                style={[styles.subtitle, { color: palette.mutedForeground }]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.topRight}>
            <View style={styles.iconRow}>
              {onFavorite ? (
                <IconAction
                  onPress={onFavorite}
                  accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  palette={palette}
                >
                  {(pressed) => (
                    <Heart
                      size={15}
                      color={isFavorite || pressed ? nbGradients.brand.colors[0] : palette.subtle}
                      fill={isFavorite ? nbGradients.brand.colors[0] : 'transparent'}
                      strokeWidth={2}
                    />
                  )}
                </IconAction>
              ) : null}
              {onEdit ? (
                <IconAction onPress={onEdit} accessibilityLabel="Edit food" palette={palette}>
                  {(pressed) => (
                    <Pencil
                      size={15}
                      color={pressed ? palette.foreground : palette.subtle}
                      strokeWidth={2}
                    />
                  )}
                </IconAction>
              ) : null}
              {onDelete ? (
                <IconAction onPress={onDelete} accessibilityLabel="Delete food" palette={palette}>
                  {(pressed) => (
                    <Trash2
                      size={15}
                      color={pressed ? palette.foreground : palette.subtle}
                      strokeWidth={2}
                    />
                  )}
                </IconAction>
              ) : null}
              {!permanentlyExpanded && onToggle ? (
                <IconAction onPress={handleToggle} accessibilityLabel={isExpanded ? 'Collapse' : 'Expand'} palette={palette}>
                  {(pressed) => (
                    <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                      <ChevronDown
                        size={16}
                        color={pressed ? palette.foreground : palette.subtle}
                        strokeWidth={2}
                      />
                    </View>
                  )}
                </IconAction>
              ) : null}
            </View>
            <View style={styles.calRow}>
              <ColorText colors={gradients.calories} style={styles.calValue}>
                {Math.round(Number(food?.calories) || 0)}
              </ColorText>
              <Text style={[styles.calSuffix, { color: palette.subtle }]}> kcal</Text>
            </View>
          </View>
        </View>

        <View style={[styles.pillsRow, onAdd ? styles.pillsRowWithAdd : null]}>
          <MacroPill label="CARBS" grams={food?.carbs} gradientStops={gradients.carbs} palette={palette} />
          <MacroPill label="PROTEIN" grams={food?.protein} gradientStops={gradients.protein} palette={palette} />
          <MacroPill label="FAT" grams={food?.fat} gradientStops={gradients.fat} palette={palette} />
        </View>
      </View>

      {onAdd ? (
        <Pressable
          onPress={handleAdd}
          accessibilityRole="button"
          accessibilityLabel="Add food to log"
          style={({ pressed }) => [styles.addFab, pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }]}
          hitSlop={4}
        >
          <LinearGradient
            colors={nbGradients.brand.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addFabInner}
          >
            <Plus size={26} color="#FFFFFF" strokeWidth={2.75} />
          </LinearGradient>
        </Pressable>
      ) : null}

      {isExpanded ? (
        <Animated.View
          entering={permanentlyExpanded ? undefined : FadeIn.duration(220)}
          layout={permanentlyExpanded ? undefined : Layout.duration(220)}
          style={[styles.expandedSection, { borderTopColor: palette.border }]}
        >
          <NutritionFactsPanel
            carbs={food?.carbs}
            protein={food?.protein}
            fat={food?.fat}
            macroPercents={pct}
            micronutrients={micros}
            serving={food?.serving}
            isDark={isDark}
            embedded={embedded}
          />

          <View style={styles.footer}>
            <View style={styles.sourceRow}>
              <View style={styles.sourceDotWrap}>
                <LinearGradient
                  colors={gradients.protein}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sourceDot}
                />
              </View>
              <Text style={[styles.sourceText, { color: palette.mutedForeground }]} numberOfLines={2}>
                {food?.source || 'CoachConnect'}
              </Text>
            </View>
            <Pressable
              onPress={onBookmark}
              style={({ pressed }) => [
                styles.bookmarkBtn,
                {
                  backgroundColor: palette.surfaceElevated,
                  borderColor: palette.border,
                },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Bookmark food"
            >
              <Bookmark size={14} color={palette.foreground} strokeWidth={2} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
            </View>
    </HardShadow>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  cardPressable: {
    position: 'relative',
  },
  cardFrame: {
    position: 'relative',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    zIndex: 2,
  },
  compactBody: {
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  topLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  foodName: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.semiBold,
    lineHeight: 22,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12.5,
    fontFamily: fonts.regular,
    lineHeight: 17,
  },
  topRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 88,
    maxWidth: 108,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconAction: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  calValue: {
    fontSize: 26,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  calSuffix: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  pillsRowWithAdd: {
    paddingRight: 52,
  },
  addFab: {
    position: 'absolute',
    right: 12,
    bottom: 14,
    borderRadius: 22,
    zIndex: 4,
    // Neobrutalist hard shadow for FAB
    ...Platform.select({
      ios: {
        shadowColor: nbGradients.brand.colors[0],
        shadowOpacity: 1,
        shadowRadius: 0,
        shadowOffset: { width: nb.shadowOffset, height: nb.shadowOffset },
      },
      android: { elevation: 0 },
      default: {},
    }),
  },
  addFabInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroPillOuter: {
    flex: 1,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  macroPillBg: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  macroPillLabel: {
    fontSize: 9,
    fontFamily: fonts.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  macroPillValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  macroPillValue: {
    fontSize: 18,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  macroPillUnit: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    marginLeft: 1,
  },
  expandedSection: {
    borderTopWidth: nb.borderWidth,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  sourceDotWrap: {
    marginRight: 8,
    flexShrink: 0,
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourceText: {
    flex: 1,
    fontSize: 10,
    fontFamily: fonts.regular,
  },
  bookmarkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
