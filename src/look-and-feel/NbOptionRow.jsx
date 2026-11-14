// Neobrutalist option row — icon, title, subtitle, optional checkbox.
// Flow: stack labels → optional checkbox → soft gradient or surface shell → outer Pressable.
// Used by: onboarding, settings, any selectable list / two-column option grid.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, nb, gradients, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: checkbox box size / radius; grid cells stay 50% width
const CHECKBOX_SIZE = 24;
const CHECKBOX_CORNER_RADIUS = 6;
const CHECKMARK_COLOR = '#FFFFFF';
const GRID_CELL_WIDTH = '50%';
const GRID_CELL_PAD = 4;

// ===== HELPER FUNCTIONS =====

/**
 * Soft gradient paints selection when there is no checkbox (checkbox mode stays flat surface).
 */
function rowShouldUseSoftGradient(isSelected, showCheckbox) {
  return isSelected && !showCheckbox;
}

function OptionRowLabelStack({ title, subtitle, inkColor, mutedColor }) {
  let subtitleNode = null;
  if (subtitle) {
    subtitleNode = (
      <Text style={[styles.subtitle, { color: mutedColor }]} numberOfLines={1}>
        {subtitle}
      </Text>
    );
  }

  return (
    <View style={styles.textContainer}>
      <Text style={[styles.title, { color: inkColor }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitleNode}
    </View>
  );
}

/**
 * Empty outlined box when off; ink gradient + check when on.
 */
function OptionRowCheckboxMark({ isSelected, borderColor }) {
  const emptyBoxBackground = isSelected ? undefined : 'transparent';
  const checkboxChrome = {
    borderColor,
    backgroundColor: emptyBoxBackground,
  };

  let checkFillNode = null;
  if (isSelected) {
    // vocab: LinearGradient = expo ramp; ink gradient fills the checked box
    checkFillNode = (
      <LinearGradient
        colors={gradients.ink.colors}
        start={gradients.ink.start}
        end={gradients.ink.end}
        style={styles.checkboxFill}
      >
        <Text style={styles.checkmark}>✓</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.checkbox, checkboxChrome]}>
      {checkFillNode}
    </View>
  );
}

function OptionRowBody({
  icon,
  title,
  subtitle,
  showCheckbox,
  isSelected,
  themeColors,
}) {
  let iconNode = null;
  if (icon) {
    iconNode = <View style={styles.iconContainer}>{icon}</View>;
  }

  let checkboxNode = null;
  if (showCheckbox) {
    checkboxNode = (
      <OptionRowCheckboxMark
        isSelected={isSelected}
        borderColor={themeColors.nbBorder}
      />
    );
  }

  return (
    <>
      {iconNode}
      <OptionRowLabelStack
        title={title}
        subtitle={subtitle}
        inkColor={themeColors.nbInk}
        mutedColor={themeColors.nbMuted}
      />
      {checkboxNode}
    </>
  );
}

function OptionRowSoftGradientShell({ borderColor, children }) {
  // vocab: gradients.soft = Design Law soft select fill (not purple brand)
  return (
    <LinearGradient
      colors={gradients.soft.colors}
      start={gradients.soft.start}
      end={gradients.soft.end}
      style={[styles.row, { borderColor }]}
    >
      {children}
    </LinearGradient>
  );
}

function OptionRowSurfaceShell({ borderColor, surfaceColor, children }) {
  return (
    <View style={[styles.row, { backgroundColor: surfaceColor, borderColor }]}>
      {children}
    </View>
  );
}

/**
 * Soft gradient when selected without checkbox; otherwise flat nbSurface.
 */
function OptionRowPaintedShell({ isSelected, showCheckbox, themeColors, children }) {
  const useSoftGradient = rowShouldUseSoftGradient(isSelected, showCheckbox);

  if (useSoftGradient) {
    return (
      <OptionRowSoftGradientShell borderColor={themeColors.nbBorder}>
        {children}
      </OptionRowSoftGradientShell>
    );
  }

  return (
    <OptionRowSurfaceShell
      borderColor={themeColors.nbBorder}
      surfaceColor={themeColors.nbSurface}
    >
      {children}
    </OptionRowSurfaceShell>
  );
}

// ===== MAIN FUNCTION =====

/**
 * One selectable option row: icon + title/subtitle + optional checkbox, soft gradient when selected.
 *
 * @param {{
 *   icon?: import('react').ReactNode,
 *   title: string,
 *   subtitle?: string,
 *   selected?: boolean,
 *   showCheckbox?: boolean,
 *   onPress?: () => void,
 *   style?: object,
 * }} props
 */
export default function NbOptionRow({
  icon,
  title,
  subtitle,
  selected = false,
  showCheckbox = false,
  onPress,
  style,
}) {
  // vocab: useTheme = Design Law light/dark token bag
  const { colors: themeColors } = useTheme();

  // 1. Inner body: icon + text + optional checkbox mark.
  const rowBody = (
    <OptionRowBody
      icon={icon}
      title={title}
      subtitle={subtitle}
      showCheckbox={showCheckbox}
      isSelected={selected}
      themeColors={themeColors}
    />
  );

  // 2. Paint selection with soft gradient or flat surface.
  const paintedShell = (
    <OptionRowPaintedShell
      isSelected={selected}
      showCheckbox={showCheckbox}
      themeColors={themeColors}
    >
      {rowBody}
    </OptionRowPaintedShell>
  );

  // 3. Whole row is the tap target.
  return (
    <Pressable onPress={onPress} style={style}>
      {paintedShell}
    </Pressable>
  );
}

/**
 * Two-column wrap of NbOptionRow cells. Selected id matches item.id.
 *
 * @param {{
 *   items: Array<{ id: string, title: string, icon?: import('react').ReactNode }>,
 *   selected: string,
 *   onSelect: (id: string) => void,
 *   style?: object,
 * }} props
 */
export function NbOptionGrid({ items, selected, onSelect, style }) {
  // 1. Map each item into a half-width cell owning one OptionRow.
  const gridCells = items.map((item) => {
    const thisItemSelected = selected === item.id;

    function selectThisItem() {
      onSelect(item.id);
    }

    return (
      <View key={item.id} style={styles.gridItem}>
        <NbOptionRow
          icon={item.icon}
          title={item.title}
          selected={thisItemSelected}
          onPress={selectThisItem}
        />
      </View>
    );
  });

  return <View style={[styles.grid, style]}>{gridCells}</View>;
}

// PLUMBING — skip unless debugging row chrome / grid gutters
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    minHeight: nb.minTouchTarget,
  },
  iconContainer: {
    marginRight: spacing.sm + 4,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: CHECKBOX_CORNER_RADIUS,
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  checkboxFill: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: CHECKMARK_COLOR,
    fontSize: 14,
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -GRID_CELL_PAD,
  },
  gridItem: {
    width: GRID_CELL_WIDTH,
    padding: GRID_CELL_PAD,
  },
});
