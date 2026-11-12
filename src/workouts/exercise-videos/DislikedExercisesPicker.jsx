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

// ===== HELPER FUNCTIONS =====

function idsWithToggledId(selectedIds, id) {
  if (selectedIds.includes(id)) return selectedIds.filter((selectedId) => selectedId !== id);
  return [...selectedIds, id];
}

function pickerHintText({ isPrefer, selectedCount }) {
  const countSuffix = selectedCount > 0 ? ` (${selectedCount} selected)` : '';
  if (isPrefer) {
    return `Tap exercises you would prefer in your plan. Skip any you don't care about.${countSuffix}`;
  }
  return `Tap exercises you never want in your plan. Selected = avoided.${countSuffix}`;
}

/**
 * Flat catalog for the avoid sheet: pinned names first, then the rest A→Z.
 * @param {Array} filtered
 * @returns {Array}
 */
function orderSheetExercises(filtered) {
  const byId = new Map(filtered.map((exercise) => [exercise.id, exercise]));
  const pinned = SHEET_PINNED_IDS.map((id) => byId.get(id)).filter(Boolean);
  const pinnedSet = new Set(pinned.map((exercise) => exercise.id));
  const rest = filtered
    .filter((exercise) => !pinnedSet.has(exercise.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...rest];
}

function exercisesGroupedByCategory(filteredExercises) {
  const byCategory = {};
  for (const category of EXERCISE_DISLIKE_CATEGORIES) {
    byCategory[category.id] = [];
  }
  for (const exercise of filteredExercises) {
    if (byCategory[exercise.category]) byCategory[exercise.category].push(exercise);
  }
  return EXERCISE_DISLIKE_CATEGORIES
    .map((category) => ({ ...category, exercises: byCategory[category.id] || [] }))
    .filter((category) => category.exercises.length > 0);
}

/**
 * Fill chip: selected = nbFill + check + HardShadow; idle = surface + border only.
 * vocab: HardShadow = solid offset sibling (Android) / shadowRadius 0 (iOS)
 * Matches mockup: `.chip[aria-pressed=true]` gets shadow; `.tick` only when selected.
 */
function AvoidChip({ label, selected, onPress }) {
  const { colors } = useTheme();
  const bg = selected ? colors.nbFill : colors.nbSurfaceChip || colors.nbSurface;
  const fg = selected ? colors.nbOnFill : colors.nbInk;

  const chip = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: colors.nbBorder,
          minHeight: nb.minTouchTarget,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
      {selected ? (
        <Ionicons name="checkmark" size={16} color={fg} style={styles.chipCheck} />
      ) : null}
    </Pressable>
  );

  if (!selected) return <View style={styles.chipShadow}>{chip}</View>;
  return (
    <HardShadow radius={999} offset={nb.shadowOffsetSmall} style={styles.chipShadow}>
      {chip}
    </HardShadow>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Catalog multi-select. `intent` only changes hint copy; stored field is still exercisesDislike.
 * @param {object} props
 * @param {'sheet'|'grouped'} [props.layout] sheet = flat wrap (avoid NbSheet); grouped = onboarding sections
 * @param {boolean} [props.showSearch] search field under the hint
 * @param {boolean} [props.showHint] helper sentence above chips
 * @param {boolean} [props.showOtherField] free-text "Other" input
 */
export default function DislikedExercisesPicker({
  value = '',
  onChange,
  t: themeProp,
  layout = 'grouped',
  showSearch = true,
  showHint = true,
  showOtherField = true,
  /** Stored field is still `exercisesDislike`; selected items = exercises to prioritize when prefer */
  intent = INTENT_PREFER,
  animatePills: _deprecatedAnimate,
}) {
  void _deprecatedAnimate;

  const { colors: themeColors } = useTheme();
  // Prefer live theme tokens; fall back to legacy `t` prop from older callers
  const colors = themeProp
    ? {
        nbInk: themeProp.textPrimary || themeColors.nbInk,
        nbMuted: themeProp.textSecondary || themeColors.nbMuted,
        nbSurface: themeProp.cardBg || themeColors.nbSurface,
        nbBorder: themeProp.cardBorder || themeColors.nbBorder,
        nbFill: themeColors.nbFill,
        nbOnFill: themeColors.nbOnFill,
        nbSoft: themeColors.nbSoft,
      }
    : themeColors;

  const { selectedIds, customText } = useMemo(() => parseExerciseDislikes(value), [value]);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => searchExerciseDislikeCatalog(search), [search]);
  const grouped = useMemo(() => exercisesGroupedByCategory(filtered), [filtered]);
  const flatList = useMemo(() => orderSheetExercises(filtered), [filtered]);

  const toggleId = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nextIds = idsWithToggledId(selectedIds, id);
    onChange?.(serializeExerciseDislikes(nextIds, customText));
  };

  const handleCustomChange = (text) => {
    onChange?.(serializeExerciseDislikes(selectedIds, text));
  };

  const selectedCount = selectedIds.length;
  const isPrefer = intent !== INTENT_DISLIKE;
  const hintText = pickerHintText({ isPrefer, selectedCount });
  const otherLabel = isPrefer ? 'Other exercises you prefer' : 'Other (not listed)';
  const isSheet = layout === 'sheet';

  const renderChipRow = (exercises) => (
    <View style={styles.pillRow}>
      {exercises.map((exercise) => (
        <AvoidChip
          key={exercise.id}
          label={exercise.name}
          selected={selectedIds.includes(exercise.id)}
          onPress={() => toggleId(exercise.id)}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      {showHint ? (
        <Text style={[styles.hint, { color: colors.nbMuted }]}>{hintText}</Text>
      ) : null}

      {showSearch ? (
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
          placeholderTextColor={colors.nbMuted}
          style={[
            styles.search,
            {
              color: colors.nbInk,
              backgroundColor: colors.nbSurface,
              borderColor: colors.nbBorder,
            },
          ]}
        />
      ) : null}

      {isSheet ? (
        flatList.length ? (
          renderChipRow(flatList)
        ) : (
          <Text style={{ color: colors.nbMuted, fontSize: 13, marginTop: 8 }}>
            No matches — add a custom exercise below.
          </Text>
        )
      ) : (
        grouped.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{section.label}</Text>
            {renderChipRow(section.exercises)}
          </View>
        ))
      )}

      {!isSheet && !grouped.length ? (
        <Text style={{ color: colors.nbMuted, fontSize: 13, marginTop: 8 }}>
          No matches — add a custom exercise below.
        </Text>
      ) : null}

      {showOtherField ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{otherLabel}</Text>
          <TextInput
            value={customText}
            onChangeText={handleCustomChange}
            placeholder="e.g. sled drags, specific machine at your gym..."
            placeholderTextColor={colors.nbMuted}
            multiline
            style={[
              styles.otherInput,
              {
                color: colors.nbInk,
                backgroundColor: colors.nbSurface,
                borderColor: colors.nbBorder,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
