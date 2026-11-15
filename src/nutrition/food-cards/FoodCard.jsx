// Premium food row — compact macros, optional expand into NutritionFactsPanel, action icons.
// Flow: tap → chevron expand / edit / delete / favorite / add-to-log FAB → haptics on key actions.
// Used by food search results and LoggedFoodRow (embedded).

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, Layout, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Pencil, Trash2, ChevronDown, Bookmark, Plus, Heart } from 'lucide-react-native';
import ColorText from './ColorText';
import NutritionFactsPanel from './NutritionFactsPanel';
import { gradients, fonts, pillBackgroundGradient, getFoodCardPalette } from './foodCardColors';
import HardShadow from '../../look-and-feel/HardShadow';
import { nb, borderRadius, gradients as nbGradients, lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: how far the card squeezes on press (1 = none)
const CARD_PRESS_SCALE = 0.985;
// Manipulate here: press-in / press-out timing in ms
const CARD_PRESS_MS = 120;
// Manipulate here: expand panel fade / layout duration
const EXPAND_FADE_MS = 220;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ===== HELPER FUNCTIONS =====

/**
 * Read a string/number field from food when the card object exists.
 * @param {object|undefined|null} food
 * @param {string} fieldName
 * @returns {*}
 */
function readFoodField(food, fieldName) {
  if (!food) return undefined;
  return food[fieldName];
}

/**
 * Subtitle under the food name: brand · serving · weight.
 * Prefers an explicit subtitle when the card already has one.
 * @param {object|undefined} food
 * @returns {string}
 */
function subtitleLineFromFood(food) {
  const explicitSubtitle = readFoodField(food, 'subtitle');
  if (explicitSubtitle) return explicitSubtitle;

  const brand = readFoodField(food, 'brand');
  const serving = readFoodField(food, 'serving');
  const weightG = readFoodField(food, 'weightG');
  let weightLabel = null;
  if (weightG) {
    weightLabel = `${weightG}g`;
  }

  const subtitleParts = [];
  if (brand) subtitleParts.push(brand);
  if (serving) subtitleParts.push(serving);
  if (weightLabel) subtitleParts.push(weightLabel);
  return subtitleParts.join(' · ');
}

/**
 * Shell fill + border for light / dark / embedded meal rows.
 * Manipulate here: embedded light cards use soft wash; dark/standalone use nbSurface.
 * @param {boolean} isDark
 * @param {boolean} embedded
 * @returns {{ fill: string, border: string }}
 */
function foodCardShellColors(isDark, embedded) {
  let shellFill = lightColors.nbSurface;
  if (isDark) {
    shellFill = darkColors.nbSurface;
  } else if (embedded) {
    shellFill = nbGradients.soft.colors[0];
  }
  let shellBorder;
  if (isDark) {
    shellBorder = darkColors.nbBorder;
  } else {
    shellBorder = lightColors.nbBorder;
  }
  return {
    fill: shellFill,
    border: shellBorder
  };
}

/**
 * Tiny icon button used for favorite / edit / delete / chevron.
 * Children may be a render function that receives the pressed flag.
 */
function FoodCardIconButton({
  onPress,
  children,
  accessibilityLabel,
  palette
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.iconAction,
        pressed && { backgroundColor: palette.iconPressBg }
      ]}
    >
      {({ pressed }) => {
        const childrenIsRenderFn = typeof children === 'function';
        if (childrenIsRenderFn) {
          return children(pressed);
        }
        return children;
      }}
    </Pressable>
  );
}

/**
 * One macro pill (CARBS / PROTEIN / FAT) with gradient label + gram value.
 */
function MacroPill({
  label,
  grams,
  gradientStops,
  palette
}) {
  const pillBackground = pillBackgroundGradient(gradientStops);
  const roundedGrams = Math.round(Number(grams) || 0);
  return (
    <View style={[styles.macroPillOuter, { borderColor: palette.borderStrong }]}>
      <LinearGradient
        colors={pillBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.macroPillBg}
      >
        <ColorText
          colors={gradientStops}
          style={styles.macroPillLabel}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          {label}
        </ColorText>
        <View style={styles.macroPillValueRow}>
          <Text style={[styles.macroPillValue, { color: palette.foreground }]}>
            {roundedGrams}
          </Text>
          <Text style={[styles.macroPillUnit, { color: palette.mutedForeground }]}>g</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

/**
 * Heart / pencil / trash / chevron cluster on the top-right of the card.
 */
function FoodCardActionIcons({
  onFavorite,
  onEdit,
  onDelete,
  onToggle,
  permanentlyExpanded,
  isFavorite,
  isExpanded,
  palette,
  brandAccentColor,
  onToggleExpand,
  favoriteAccessibilityLabel,
  chevronAccessibilityLabel
}) {
  let chevronRotation;
  if (isExpanded) {
    chevronRotation = '180deg';
  } else {
    chevronRotation = '0deg';
  }

  const showFavorite = Boolean(onFavorite);
  const showEdit = Boolean(onEdit);
  const showDelete = Boolean(onDelete);
  const showChevron = !permanentlyExpanded && Boolean(onToggle);

  return (
    <View style={styles.iconRow}>
      {showFavorite ? (
        <FoodCardIconButton
          onPress={onFavorite}
          accessibilityLabel={favoriteAccessibilityLabel}
          palette={palette}
        >
          {(pressed) => {
            let heartColor = palette.subtle;
            if (isFavorite || pressed) {
              heartColor = brandAccentColor;
            }
            let heartFill = 'transparent';
            if (isFavorite) {
              heartFill = brandAccentColor;
            }
            return (
              <Heart
                size={15}
                color={heartColor}
                fill={heartFill}
                strokeWidth={2}
              />
            );
          }}
        </FoodCardIconButton>
      ) : null}

      {showEdit ? (
        <FoodCardIconButton onPress={onEdit} accessibilityLabel="Edit food" palette={palette}>
          {(pressed) => {
            let pencilColor = palette.subtle;
            if (pressed) {
              pencilColor = palette.foreground;
            }
            return <Pencil size={15} color={pencilColor} strokeWidth={2} />;
          }}
        </FoodCardIconButton>
      ) : null}

      {showDelete ? (
        <FoodCardIconButton onPress={onDelete} accessibilityLabel="Delete food" palette={palette}>
          {(pressed) => {
            let trashColor = palette.subtle;
            if (pressed) {
              trashColor = palette.foreground;
            }
            return <Trash2 size={15} color={trashColor} strokeWidth={2} />;
          }}
        </FoodCardIconButton>
      ) : null}

      {showChevron ? (
        <FoodCardIconButton
          onPress={onToggleExpand}
          accessibilityLabel={chevronAccessibilityLabel}
          palette={palette}
        >
          {(pressed) => {
            let chevronColor = palette.subtle;
            if (pressed) {
              chevronColor = palette.foreground;
            }
            return (
              <View style={{ transform: [{ rotate: chevronRotation }] }}>
                <ChevronDown size={16} color={chevronColor} strokeWidth={2} />
              </View>
            );
          }}
        </FoodCardIconButton>
      ) : null}
    </View>
  );
}

/**
 * Expanded nutrition facts + source line + bookmark.
 */
function FoodCardExpandedSection({
  food,
  macroPercentBreakdown,
  micronutrientMap,
  isDark,
  embedded,
  palette,
  skipExpandAnimation,
  onBookmark
}) {
  let sourceLabel = 'CoachConnect';
  const foodSource = readFoodField(food, 'source');
  if (foodSource) {
    sourceLabel = foodSource;
  }

  const carbsGrams = readFoodField(food, 'carbs');
  const proteinGrams = readFoodField(food, 'protein');
  const fatGrams = readFoodField(food, 'fat');
  const servingLabel = readFoodField(food, 'serving');

  let enteringAnimation = FadeIn.duration(EXPAND_FADE_MS);
  let layoutAnimation = Layout.duration(EXPAND_FADE_MS);
  if (skipExpandAnimation) {
    enteringAnimation = undefined;
    layoutAnimation = undefined;
  }

  return (
    <Animated.View
      entering={enteringAnimation}
      layout={layoutAnimation}
      style={[styles.expandedSection, { borderTopColor: palette.border }]}
    >
      <NutritionFactsPanel
        carbs={carbsGrams}
        protein={proteinGrams}
        fat={fatGrams}
        macroPercents={macroPercentBreakdown}
        micronutrients={micronutrientMap}
        serving={servingLabel}
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
          <Text
            style={[styles.sourceText, { color: palette.mutedForeground }]}
            numberOfLines={2}
          >
            {sourceLabel}
          </Text>
        </View>
        <Pressable
          onPress={onBookmark}
          style={({ pressed }) => [
            styles.bookmarkBtn,
            {
              backgroundColor: palette.surfaceElevated,
              borderColor: palette.border
            },
            pressed && { opacity: 0.85 }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Bookmark food"
        >
          <Bookmark size={14} color={palette.foreground} strokeWidth={2} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Search / meal food card. Same food key letters (name, calories, carbs, protein, fat, …).
 * Hook order frozen: useMemo → useSharedValue → useAnimatedStyle.
 */
export default function FoodCard({
  food,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onBookmark,
  onAdd,
  onFavorite,
  isFavorite = false,
  isDark = true,
  embedded = false,
  palette: paletteProp,
  permanentlyExpanded = false
}) {
  // 1. Expand state — confirm screens force open and hide the chevron.
  let isExpanded;
  if (permanentlyExpanded) {
    isExpanded = true;
  } else {
    isExpanded = expanded;
  }

  // 2. Theme palette (memoized so embedded meal rows do not re-tint every parent render).
  // vocab: useMemo = cache until paletteProp / isDark / embedded change
  const palette = useMemo(() => {
    if (paletteProp != null) {
      return paletteProp;
    }
    return getFoodCardPalette(isDark, { embedded });
  }, [paletteProp, isDark, embedded]);

  // 3. vocab: Reanimated shared value — quick squeeze on press in/out.
  // vocab: useSharedValue / useAnimatedStyle / withTiming = Reanimated press scale
  const pressScale = useSharedValue(1);
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }]
  }));

  // 4. Name display decisions before JSX (food key letters stay frozen).
  const subtitle = subtitleLineFromFood(food);

  let micronutrientMap = {};
  const foodMicronutrients = readFoodField(food, 'micronutrients');
  if (foodMicronutrients) {
    micronutrientMap = foodMicronutrients;
  }

  let macroPercentBreakdown = { carbs: 0, protein: 0, fat: 0 };
  const foodMacroPercents = readFoodField(food, 'macroPercents');
  if (foodMacroPercents) {
    macroPercentBreakdown = foodMacroPercents;
  }

  const caloriesRaw = readFoodField(food, 'calories');
  const roundedCalories = Math.round(Number(caloriesRaw) || 0);

  let foodDisplayName = 'Food';
  const foodName = readFoodField(food, 'name');
  if (foodName) {
    foodDisplayName = foodName;
  }

  const carbsGrams = readFoodField(food, 'carbs');
  const proteinGrams = readFoodField(food, 'protein');
  const fatGrams = readFoodField(food, 'fat');

  const shellColors = foodCardShellColors(isDark, embedded);
  const cardOverflowVisible = Boolean(onAdd || embedded);
  const pillsRowNeedsFabGap = Boolean(onAdd);
  const skipExpandAnimation = permanentlyExpanded;

  let favoriteAccessibilityLabel;
  if (isFavorite) {
    favoriteAccessibilityLabel = 'Remove from favorites';
  } else {
    favoriteAccessibilityLabel = 'Add to favorites';
  }

  let chevronAccessibilityLabel;
  if (isExpanded) {
    chevronAccessibilityLabel = 'Collapse';
  } else {
    chevronAccessibilityLabel = 'Expand';
  }

  const brandAccentColor = nbGradients.brand.colors[0];

  let shadowOffset;
  if (embedded) {
    shadowOffset = 0;
  } else {
    shadowOffset = nb.shadowOffsetCard;
  }

  let overflowMode = 'hidden';
  if (cardOverflowVisible) {
    overflowMode = 'visible';
  }

  const innerFrameStyle = {
    backgroundColor: shellColors.fill,
    borderWidth: nb.borderWidth,
    borderColor: shellColors.border,
    borderRadius: borderRadius.nbCard,
    overflow: overflowMode
  };

  // 5. Handlers — haptics on expand-open and add-to-log; press scale for the card shell.
  const handleToggleExpand = () => {
    if (permanentlyExpanded) return;
    if (!isExpanded) {
      Haptics.selectionAsync().catch(() => {});
    }
    if (onToggle) {
      onToggle();
    }
  };
  const handleAddToLog = () => {
    Haptics.selectionAsync().catch(() => {});
    if (onAdd) {
      onAdd();
    }
  };
  const handlePressIn = () => {
    pressScale.value = withTiming(CARD_PRESS_SCALE, {
      duration: CARD_PRESS_MS
    });
  };
  const handlePressOut = () => {
    pressScale.value = withTiming(1, {
      duration: CARD_PRESS_MS
    });
  };

  // 6. Render: HardShadow shell → compact macros → optional FAB → optional expanded panel.
  // vocab: HardShadow = solid offset shadow (no blur)
  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.cardPressable, animatedCardStyle]}
    >
      <HardShadow radius={borderRadius.nbCard} offset={shadowOffset} style={styles.cardFrame}>
        <View style={innerFrameStyle}>
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
                    {foodDisplayName}
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
                <FoodCardActionIcons
                  onFavorite={onFavorite}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggle={onToggle}
                  permanentlyExpanded={permanentlyExpanded}
                  isFavorite={isFavorite}
                  isExpanded={isExpanded}
                  palette={palette}
                  brandAccentColor={brandAccentColor}
                  onToggleExpand={handleToggleExpand}
                  favoriteAccessibilityLabel={favoriteAccessibilityLabel}
                  chevronAccessibilityLabel={chevronAccessibilityLabel}
                />
                <View style={styles.calRow}>
                  <ColorText colors={gradients.calories} style={styles.calValue}>
                    {roundedCalories}
                  </ColorText>
                  <Text style={[styles.calSuffix, { color: palette.subtle }]}> kcal</Text>
                </View>
              </View>
            </View>

            <View style={[styles.pillsRow, pillsRowNeedsFabGap ? styles.pillsRowWithAdd : null]}>
              <MacroPill
                label="CARBS"
                grams={carbsGrams}
                gradientStops={gradients.carbs}
                palette={palette}
              />
              <MacroPill
                label="PROTEIN"
                grams={proteinGrams}
                gradientStops={gradients.protein}
                palette={palette}
              />
              <MacroPill
                label="FAT"
                grams={fatGrams}
                gradientStops={gradients.fat}
                palette={palette}
              />
            </View>
          </View>

          {onAdd ? (
            <Pressable
              onPress={handleAddToLog}
              accessibilityRole="button"
              accessibilityLabel="Add food to log"
              style={({ pressed }) => [
                styles.addFab,
                pressed && {
                  opacity: 0.9,
                  transform: [{ scale: 0.96 }]
                }
              ]}
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
            <FoodCardExpandedSection
              food={food}
              macroPercentBreakdown={macroPercentBreakdown}
              micronutrientMap={micronutrientMap}
              isDark={isDark}
              embedded={embedded}
              palette={palette}
              skipExpandAnimation={skipExpandAnimation}
              onBookmark={onBookmark}
            />
          ) : null}
        </View>
      </HardShadow>
    </AnimatedPressable>
  );
}

// PLUMBING — layout only
const styles = StyleSheet.create({
  cardPressable: {
    position: 'relative'
  },
  cardFrame: {
    position: 'relative'
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    zIndex: 2
  },
  compactBody: {
    padding: 16
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  topLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6
  },
  foodName: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.semiBold,
    lineHeight: 22
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12.5,
    fontFamily: fonts.regular,
    lineHeight: 17
  },
  topRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 88,
    maxWidth: 108
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  iconAction: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  calValue: {
    fontSize: 26,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums']
  },
  calSuffix: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14
  },
  pillsRowWithAdd: {
    paddingRight: 52
  },
  addFab: {
    position: 'absolute',
    right: 12,
    bottom: 14,
    borderRadius: 22,
    zIndex: 4,
    ...Platform.select({
      ios: {
        shadowColor: nbGradients.brand.colors[0],
        shadowOpacity: 1,
        shadowRadius: 0,
        shadowOffset: {
          width: nb.shadowOffset,
          height: nb.shadowOffset
        }
      },
      android: {
        elevation: 0
      },
      default: {}
    })
  },
  addFabInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  macroPillOuter: {
    flex: 1,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden'
  },
  macroPillBg: {
    paddingVertical: 12,
    paddingHorizontal: 10
  },
  macroPillLabel: {
    fontSize: 9,
    fontFamily: fonts.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase'
  },
  macroPillValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6
  },
  macroPillValue: {
    fontSize: 18,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums']
  },
  macroPillUnit: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    marginLeft: 1
  },
  expandedSection: {
    borderTopWidth: nb.borderWidth,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
    minWidth: 0
  },
  sourceDotWrap: {
    marginRight: 8,
    flexShrink: 0
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  sourceText: {
    flex: 1,
    fontSize: 10,
    fontFamily: fonts.regular
  },
  bookmarkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  }
});
