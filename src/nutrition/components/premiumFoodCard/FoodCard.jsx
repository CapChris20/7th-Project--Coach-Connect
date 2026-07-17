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
  Check,
  Bookmark,
} from 'lucide-react-native';
import GradientText from './GradientText';
import NutritionFactsSection from './NutritionFactsSection';
import { gradients, radii, fonts, pillBackgroundGradient, getFoodCardPalette } from './theme';

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
  const bg = pillBackgroundGradient(gradientStops);
  const display = Math.round(Number(grams) || 0);

  return (
    <View style={[styles.macroPillOuter, { borderColor: palette.borderStrong }]}>
      <LinearGradient
        colors={gradientStops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.macroPillTopAccent}
      />
      <LinearGradient colors={bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.macroPillBg}>
        <GradientText
          colors={gradientStops}
          style={styles.macroPillLabel}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {label}
        </GradientText>
        <View style={styles.macroPillValueRow}>
          <Text style={[styles.macroPillValue, { color: palette.foreground }]}>{display}</Text>
          <Text style={[styles.macroPillUnit, { color: palette.mutedForeground }]}>g</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

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

  const cardShadow =
    isExpanded && !embedded
      ? Platform.select({
          ios: {
            shadowColor: '#000000',
            shadowOpacity: 0.5,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 18 },
          },
          android: { elevation: 12 },
          default: {},
        })
      : isExpanded && embedded
        ? Platform.select({
            ios: {
              shadowColor: '#000000',
              shadowOpacity: 0.12,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: 3 },
            default: {},
          })
        : null;

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withTiming(0.985, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
      style={[
        styles.card,
        {
          backgroundColor: isExpanded ? palette.expandedSurface : palette.background,
          borderColor: isExpanded ? palette.borderStrong : palette.border,
          borderWidth: embedded ? StyleSheet.hairlineWidth : 1,
          overflow: embedded ? 'visible' : 'hidden',
        },
        cardShadow,
        animatedCardStyle,
      ]}
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
              {food?.verified ? (
                <Check size={14} color={palette.subtle} strokeWidth={2.5} style={styles.checkIcon} />
              ) : null}
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
              {!permanentlyExpanded ? (
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
              <GradientText colors={gradients.calories} style={styles.calValue}>
                {Math.round(Number(food?.calories) || 0)}
              </GradientText>
              <Text style={[styles.calSuffix, { color: palette.subtle }]}> kcal</Text>
            </View>
          </View>
        </View>

        <View style={styles.pillsRow}>
          <MacroPill label="CARBS" grams={food?.carbs} gradientStops={gradients.carbs} palette={palette} />
          <MacroPill label="PROTEIN" grams={food?.protein} gradientStops={gradients.protein} palette={palette} />
          <MacroPill label="FAT" grams={food?.fat} gradientStops={gradients.fat} palette={palette} />
        </View>
      </View>

      {isExpanded ? (
        <Animated.View
          entering={permanentlyExpanded ? undefined : FadeIn.duration(220)}
          layout={permanentlyExpanded ? undefined : Layout.duration(220)}
          style={[styles.expandedSection, { borderTopColor: palette.border }]}
        >
          <NutritionFactsSection
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
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
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
  checkIcon: {
    marginTop: 3,
    flexShrink: 0,
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
  macroPillOuter: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  macroPillTopAccent: {
    height: 1,
    width: '100%',
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
    borderTopWidth: StyleSheet.hairlineWidth,
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
