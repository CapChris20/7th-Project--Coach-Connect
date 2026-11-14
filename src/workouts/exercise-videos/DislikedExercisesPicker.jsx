// Multi-select exercise chips for avoid / prefer lists (Design Law fill + check).
// Flow: parse stored value → optional search → toggle ids → serializeExerciseDislikes.
// Used by: Exercises-to-avoid NbSheet, onboarding / plan-preference editors.
// Persistence key stays `exercisesDislike` (legacy field name — do not rename).

import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  EXERCISE_DISLIKE_CATEGORIES,
  searchExerciseDislikeCatalog,
} from './dislikableExercises';
import { parseExerciseDislikes, serializeExerciseDislikes } from './dislikedExercisesText';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const INTENT_DISLIKE = 'dislike';
const INTENT_PREFER = 'prefer';

// Manipulate here: sheet pins these ids first so the PNG-like list reads familiar
const SHEET_PINNED_IDS = [
  'burpee',
  'lunge_walk',
  'running',
  'deadlift',
  'pullup',
  'jump_squat',
  'plank',
];

const EMPTY_CATALOG_MESSAGE = 'No matches — add a custom exercise below.';
const LAYOUT_SHEET = 'sheet';

// ===== HELPER FUNCTIONS =====

/**
 * Add or remove one exercise id from the current selection.
 * @param {string[]} currentSelectedIds
 * @param {string} exerciseId
 * @returns {string[]}
 */
function selectedIdsAfterToggle(currentSelectedIds, exerciseId) {
  const alreadySelected = currentSelectedIds.includes(exerciseId);
  if (alreadySelected) {
    return currentSelectedIds.filter((id) => id !== exerciseId);
  }
  return [...currentSelectedIds, exerciseId];
}

/**
 * Hint under the search box — prefer vs avoid wording + optional count.
 * @param {{ isPreferIntent: boolean, selectedCount: number }} options
 * @returns {string}
 */
function helperHintForPicker({ isPreferIntent, selectedCount }) {
  let countSuffix = '';
  if (selectedCount > 0) {
    countSuffix = ` (${selectedCount} selected)`;
  }

  if (isPreferIntent) {
    return `Tap exercises you would prefer in your plan. Skip any you don't care about.${countSuffix}`;
  }
  return `Tap exercises you never want in your plan. Selected = avoided.${countSuffix}`;
}

/**
 * Flat catalog for the avoid sheet: pinned names first, then the rest A→Z.
 * @param {Array<{id: string, name: string}>} filteredExercises
 * @returns {Array}
 */
function flatSheetExerciseOrder(filteredExercises) {
  const exerciseById = new Map(filteredExercises.map((row) => [row.id, row]));

  const pinnedRows = [];
  for (const pinnedId of SHEET_PINNED_IDS) {
    const pinnedRow = exerciseById.get(pinnedId);
    if (pinnedRow) {
      pinnedRows.push(pinnedRow);
    }
  }

  const pinnedIdSet = new Set(pinnedRows.map((row) => row.id));
  const unpinnedRows = [];
  for (const row of filteredExercises) {
    if (!pinnedIdSet.has(row.id)) {
      unpinnedRows.push(row);
    }
  }
  unpinnedRows.sort((left, right) => left.name.localeCompare(right.name));

  return [...pinnedRows, ...unpinnedRows];
}

/**
 * Group search hits under EXERCISE_DISLIKE_CATEGORIES; drop empty sections.
 * @param {Array} filteredExercises
 * @returns {Array}
 */
function categorySectionsFromSearchHits(filteredExercises) {
  const exercisesByCategoryId = {};
  for (const category of EXERCISE_DISLIKE_CATEGORIES) {
    exercisesByCategoryId[category.id] = [];
  }

  for (const exercise of filteredExercises) {
    const bucket = exercisesByCategoryId[exercise.category];
    if (bucket) {
      bucket.push(exercise);
    }
  }

  const sectionsWithExercises = [];
  for (const category of EXERCISE_DISLIKE_CATEGORIES) {
    const exercisesInCategory = exercisesByCategoryId[category.id] || [];
    if (exercisesInCategory.length === 0) {
      continue;
    }
    sectionsWithExercises.push({
      ...category,
      exercises: exercisesInCategory,
    });
  }
  return sectionsWithExercises;
}

/**
 * Legacy callers may pass `t` with old theme keys; merge with live useTheme() tokens.
 * @param {object|undefined} legacyThemeProp
 * @param {object} liveThemeColors
 * @returns {object}
 */
function resolvePickerColors(legacyThemeProp, liveThemeColors) {
  if (!legacyThemeProp) {
    return liveThemeColors;
  }
  return {
    nbInk: legacyThemeProp.textPrimary || liveThemeColors.nbInk,
    nbMuted: legacyThemeProp.textSecondary || liveThemeColors.nbMuted,
    nbSurface: legacyThemeProp.cardBg || liveThemeColors.nbSurface,
    nbBorder: legacyThemeProp.cardBorder || liveThemeColors.nbBorder,
    nbFill: liveThemeColors.nbFill,
    nbOnFill: liveThemeColors.nbOnFill,
    nbSoft: liveThemeColors.nbSoft,
  };
}

// Fill chip: selected = nbFill + check + HardShadow; idle = surface + border only.
// vocab: HardShadow = solid offset sibling (Android) / shadowRadius 0 (iOS)
function AvoidChip({ label, selected, onPress }) {
  const { colors: themeColors } = useTheme();

  let chipBackground = themeColors.nbSurfaceChip || themeColors.nbSurface;
  let chipForeground = themeColors.nbInk;
  if (selected) {
    chipBackground = themeColors.nbFill;
    chipForeground = themeColors.nbOnFill;
  }

  const chipBody = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        chipStyles.chip,
        {
          backgroundColor: chipBackground,
          borderColor: themeColors.nbBorder,
          minHeight: nb.minTouchTarget,
        },
      ]}
    >
      <Text style={[chipStyles.chipText, { color: chipForeground }]} numberOfLines={1}>
        {label}
      </Text>
      {selected ? (
        <Ionicons name="checkmark" size={16} color={chipForeground} style={chipStyles.chipCheck} />
      ) : null}
    </Pressable>
  );

  if (!selected) {
    return <View style={chipStyles.chipShadow}>{chipBody}</View>;
  }

  return (
    <HardShadow radius={999} offset={nb.shadowOffsetSmall} style={chipStyles.chipShadow}>
      {chipBody}
    </HardShadow>
  );
}

function ChipRow({ exercises, selectedIds, onToggleExerciseId }) {
  return (
    <View style={pickerStyles.pillRow}>
      {exercises.map((exercise) => {
        const isSelected = selectedIds.includes(exercise.id);
        const pressThisChip = () => {
          onToggleExerciseId(exercise.id);
        };
        return (
          <AvoidChip
            key={exercise.id}
            label={exercise.name}
            selected={isSelected}
            onPress={pressThisChip}
          />
        );
      })}
    </View>
  );
}

function SheetExerciseList({ flatSheetList, selectedIds, onToggleExerciseId, mutedTextStyle }) {
  if (flatSheetList.length === 0) {
    return <Text style={mutedTextStyle}>{EMPTY_CATALOG_MESSAGE}</Text>;
  }

  return (
    <ChipRow
      exercises={flatSheetList}
      selectedIds={selectedIds}
      onToggleExerciseId={onToggleExerciseId}
    />
  );
}

function GroupedCategoryLists({
  groupedSections,
  selectedIds,
  onToggleExerciseId,
  sectionLabelColor,
}) {
  return groupedSections.map((section) => (
    <View key={section.id} style={pickerStyles.section}>
      <Text style={[pickerStyles.sectionLabel, { color: sectionLabelColor }]}>
        {section.label}
      </Text>
      <ChipRow
        exercises={section.exercises}
        selectedIds={selectedIds}
        onToggleExerciseId={onToggleExerciseId}
      />
    </View>
  ));
}

// ===== MAIN FUNCTION =====

/**
 * Multi-select chip picker for prefer / avoid exercise lists.
 * @param {object} props
 * @param {string} [props.value]
 * @param {Function} [props.onChange]
 * @param {object} [props.t] legacy theme bridge
 * @param {string} [props.layout] 'grouped' | 'sheet'
 * @param {boolean} [props.showSearch]
 * @param {boolean} [props.showHint]
 * @param {boolean} [props.showOtherField]
 * @param {string} [props.intent] 'prefer' | 'dislike' — stored field is still exercisesDislike
 * @param {boolean} [props.animatePills] deprecated
 */
export default function DislikedExercisesPicker({
  value = '',
  onChange,
  t: legacyThemeProp,
  layout = 'grouped',
  showSearch = true,
  showHint = true,
  showOtherField = true,
  /** Stored field is still `exercisesDislike`; selected items = exercises to prioritize when prefer */
  intent = INTENT_PREFER,
  animatePills: deprecatedAnimatePills,
}) {
  void deprecatedAnimatePills;

  // vocab: useTheme = Design Law light/dark tokens from lightDarkMode
  const { colors: liveThemeColors } = useTheme();
  const pickerColors = resolvePickerColors(legacyThemeProp, liveThemeColors);

  // vocab: useMemo = re-parse only when the stored string changes
  const parsedDislikes = useMemo(() => parseExerciseDislikes(value), [value]);
  const selectedIds = parsedDislikes.selectedIds;
  const customText = parsedDislikes.customText;

  const [searchQuery, setSearchQuery] = useState('');

  const searchHits = useMemo(() => searchExerciseDislikeCatalog(searchQuery), [searchQuery]);
  const groupedSections = useMemo(() => categorySectionsFromSearchHits(searchHits), [searchHits]);
  const flatSheetList = useMemo(() => flatSheetExerciseOrder(searchHits), [searchHits]);

  const isPreferIntent = intent !== INTENT_DISLIKE;
  const isSheetLayout = layout === LAYOUT_SHEET;
  const selectedCount = selectedIds.length;
  const hintText = helperHintForPicker({ isPreferIntent, selectedCount });

  let otherFieldLabel = 'Other (not listed)';
  if (isPreferIntent) {
    otherFieldLabel = 'Other exercises you prefer';
  }

  const noSearchMatches = searchHits.length === 0;
  const mutedTextColor = pickerColors.nbMuted;
  const mutedTextStyle = { color: mutedTextColor, fontSize: 13, marginTop: 8 };

  // 1. Haptic tap → flip id in serialized string → notify parent.
  const toggleExerciseSelection = (exerciseId) => {
    // vocab: impactAsync = fire-and-forget light haptic; ignore failures on unsupported devices
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nextSelectedIds = selectedIdsAfterToggle(selectedIds, exerciseId);
    onChange?.(serializeExerciseDislikes(nextSelectedIds, customText));
  };

  const handleCustomTextChange = (nextCustomText) => {
    onChange?.(serializeExerciseDislikes(selectedIds, nextCustomText));
  };

  let hintNode = null;
  if (showHint) {
    hintNode = (
      <Text style={[pickerStyles.hint, { color: pickerColors.nbMuted }]}>{hintText}</Text>
    );
  }

  let searchNode = null;
  if (showSearch) {
    searchNode = (
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search exercises..."
        placeholderTextColor={pickerColors.nbMuted}
        style={[
          pickerStyles.search,
          {
            color: pickerColors.nbInk,
            backgroundColor: pickerColors.nbSurface,
            borderColor: pickerColors.nbBorder,
          },
        ]}
      />
    );
  }

  let catalogNode;
  if (isSheetLayout) {
    catalogNode = (
      <SheetExerciseList
        flatSheetList={flatSheetList}
        selectedIds={selectedIds}
        onToggleExerciseId={toggleExerciseSelection}
        mutedTextStyle={mutedTextStyle}
      />
    );
  } else {
    catalogNode = (
      <GroupedCategoryLists
        groupedSections={groupedSections}
        selectedIds={selectedIds}
        onToggleExerciseId={toggleExerciseSelection}
        sectionLabelColor={pickerColors.nbMuted}
      />
    );
  }

  let emptyGroupedMessageNode = null;
  if (!isSheetLayout && noSearchMatches) {
    emptyGroupedMessageNode = <Text style={mutedTextStyle}>{EMPTY_CATALOG_MESSAGE}</Text>;
  }

  let otherFieldNode = null;
  if (showOtherField) {
    otherFieldNode = (
      <View style={{ marginTop: 12 }}>
        <Text style={[pickerStyles.sectionLabel, { color: pickerColors.nbMuted }]}>
          {otherFieldLabel}
        </Text>
        <TextInput
          value={customText}
          onChangeText={handleCustomTextChange}
          placeholder="e.g. sled drags, specific machine at your gym..."
          placeholderTextColor={pickerColors.nbMuted}
          multiline
          style={[
            pickerStyles.otherInput,
            {
              color: pickerColors.nbInk,
              backgroundColor: pickerColors.nbSurface,
              borderColor: pickerColors.nbBorder,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={pickerStyles.root}>
      {hintNode}
      {searchNode}
      {catalogNode}
      {emptyGroupedMessageNode}
      {otherFieldNode}
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const chipStyles = StyleSheet.create({
  chipShadow: {
    marginBottom: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
  },
  chipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  chipCheck: {
    marginLeft: 6,
  },
});

const pickerStyles = StyleSheet.create({
  root: {
    marginTop: 4,
  },
  hint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: 10,
  },
  search: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
    minHeight: 48,
  },
  section: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  otherInput: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    minHeight: 72,
    textAlignVertical: 'top',
  },
});
