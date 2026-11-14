// Marketplace Filter bottom sheet — Design Law HardShadow / Nb* chrome (PNG 05).
// Flow: copy live filters into a draft → edit → Reset restores defaults → Show N trainers applies + closes.
// Used by SearchTrainersScreen. Parent owns the live filters; this sheet only edits a copy.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AVAILABILITY_OPTIONS,
  DEFAULT_FILTERS,
  EXPERIENCE_OPTIONS,
  FILTER_SPECIALTIES,
  SESSION_TYPES,
  SORT_OPTIONS,
  filterTrainers,
} from './trainerFilters';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbSegmented from '../../look-and-feel/NbSegmented';
import NbSwitch from '../../look-and-feel/NbSwitch';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHEET_SCROLL_EXTRA_PAD = 24;
const MIN_SHEET_BOTTOM_PAD = 16;
const SECTION_GAP = 18;
const DEFAULT_SORT_LABEL = 'Best match';
const DEFAULT_SESSION_TYPE = 'Both';
const DEFAULT_QUICK_SPECIALTY = 'All';
const RESET_HIT_SLOP = 8;

// ===== HELPER FUNCTIONS =====

function specialtyListWithoutName(currentList, specialtyName) {
  const nextList = [];
  for (let index = 0; index < currentList.length; index += 1) {
    const entry = currentList[index];
    if (entry !== specialtyName) {
      nextList.push(entry);
    }
  }
  return nextList;
}

function specialtyListAfterTap(specialties, specialtyName) {
  let currentList = [];
  if (specialties) {
    currentList = specialties;
  }
  if (currentList.includes(specialtyName)) {
    return specialtyListWithoutName(currentList, specialtyName);
  }
  return [...currentList, specialtyName];
}

function availabilityAfterTap(currentChoice, optionLabel) {
  if (currentChoice === optionLabel) {
    return null;
  }
  return optionLabel;
}

function labelForShowTrainersButton(matchCount) {
  if (matchCount === 1) {
    return 'Show 1 trainer';
  }
  return `Show ${matchCount} trainers`;
}

function segmentsFromOptionLabels(optionLabels) {
  const segments = [];
  for (let index = 0; index < optionLabels.length; index += 1) {
    const optionLabel = optionLabels[index];
    segments.push({
      id: optionLabel,
      label: optionLabel,
    });
  }
  return segments;
}

function pillChrome(colors, isActive) {
  if (isActive) {
    return {
      backgroundColor: colors.nbFill,
      textColor: colors.nbOnFill,
    };
  }
  return {
    backgroundColor: colors.nbSurface,
    textColor: colors.nbInk,
  };
}

function buildSpecialtyPillElements(selectedSpecialties, onToggleSpecialty, colors) {
  const pillElements = [];
  for (let index = 0; index < FILTER_SPECIALTIES.length; index += 1) {
    const specialtyName = FILTER_SPECIALTIES[index];
    const isActive = selectedSpecialties.includes(specialtyName);
    pillElements.push(
      <FilterPill
        key={specialtyName}
        label={specialtyName}
        active={isActive}
        onPress={() => onToggleSpecialty(specialtyName)}
        colors={colors}
      />,
    );
  }
  return pillElements;
}

function buildExperiencePillElements(selectedExperience, onSelectExperience, colors) {
  const pillElements = [];
  for (let index = 0; index < EXPERIENCE_OPTIONS.length; index += 1) {
    const experienceLabel = EXPERIENCE_OPTIONS[index];
    const isActive = selectedExperience === experienceLabel;
    pillElements.push(
      <FilterPill
        key={experienceLabel}
        label={experienceLabel}
        active={isActive}
        onPress={() => onSelectExperience(experienceLabel)}
        colors={colors}
      />,
    );
  }
  return pillElements;
}

function buildAvailabilityPillElements(selectedAvailability, onSelectAvailability, colors) {
  const pillElements = [];
  for (let index = 0; index < AVAILABILITY_OPTIONS.length; index += 1) {
    const optionLabel = AVAILABILITY_OPTIONS[index];
    const isActive = selectedAvailability === optionLabel;
    pillElements.push(
      <FilterPill
        key={optionLabel}
        label={optionLabel}
        active={isActive}
        onPress={() => onSelectAvailability(optionLabel)}
        colors={colors}
      />,
    );
  }
  return pillElements;
}

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  maybeFunction(...args);
}

function draftFromLiveFilters(filters) {
  return { ...DEFAULT_FILTERS, ...(filters || {}) };
}

function countMatchingTrainers(trainers, draft, search, quickSpecialty) {
  const matching = filterTrainers(trainers, draft, {
    query: search,
    quickSpecialty,
  });
  return matching.length;
}

// ===== SMALL UI PIECES =====

function SectionLabel({ children, colors }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{children}</Text>
  );
}

function FilterPill({ label, active, onPress, colors }) {
  const chrome = pillChrome(colors, active);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.pill,
        { borderColor: colors.nbBorder, backgroundColor: chrome.backgroundColor },
      ]}
    >
      <Text style={[styles.pillText, { color: chrome.textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({ title, subtitle, value, onValueChange, colors, showDivider }) {
  let dividerStyle = null;
  if (showDivider) {
    dividerStyle = {
      borderBottomWidth: StyleSheet.hairlineWidth * 2,
      borderBottomColor: colors.nbBorder,
    };
  }

  return (
    <View style={[styles.toggleRow, dividerStyle]}>
      <View style={styles.toggleCopy}>
        <Text style={[styles.toggleTitle, { color: colors.nbInk }]}>{title}</Text>
        <Text style={[styles.toggleSub, { color: colors.nbMuted }]}>{subtitle}</Text>
      </View>
      <NbSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function FilterSheetHeader({ colors, onReset }) {
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.title, { color: colors.nbInk }]}>Filter</Text>
      <Pressable
        onPress={onReset}
        hitSlop={RESET_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Reset filters"
      >
        <Text style={[styles.resetLink, { color: colors.nbInk }]}>Reset</Text>
      </Pressable>
    </View>
  );
}

function SortBySection({ draft, setDraft, colors, sortSegments }) {
  let selectedSort = DEFAULT_SORT_LABEL;
  if (draft.sort) {
    selectedSort = draft.sort;
  }

  function selectSort(sortId) {
    setDraft({ ...draft, sort: sortId });
  }

  return (
    <View style={styles.section}>
      <SectionLabel colors={colors}>SORT BY</SectionLabel>
      <NbSegmented
        segments={sortSegments}
        selected={selectedSort}
        onSelect={selectSort}
      />
    </View>
  );
}

function SpecialtySection({ draft, setDraft, colors }) {
  let selectedSpecialties = [];
  if (draft.specialties) {
    selectedSpecialties = draft.specialties;
  }

  function toggleSpecialty(specialtyName) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      specialties: specialtyListAfterTap(currentDraft.specialties, specialtyName),
    }));
  }

  const specialtyPills = buildSpecialtyPillElements(
    selectedSpecialties,
    toggleSpecialty,
    colors,
  );

  return (
    <View style={styles.section}>
      <SectionLabel colors={colors}>SPECIALTY</SectionLabel>
      <View style={styles.pillWrap}>{specialtyPills}</View>
    </View>
  );
}

function SessionTypeSection({ draft, setDraft, colors, sessionSegments }) {
  let selectedSession = DEFAULT_SESSION_TYPE;
  if (draft.sessionType) {
    selectedSession = draft.sessionType;
  }

  function selectSessionType(sessionTypeId) {
    setDraft({ ...draft, sessionType: sessionTypeId });
  }

  return (
    <View style={styles.section}>
      <SectionLabel colors={colors}>SESSION TYPE</SectionLabel>
      <NbSegmented
        segments={sessionSegments}
        selected={selectedSession}
        onSelect={selectSessionType}
      />
    </View>
  );
}

function ExperienceSection({ draft, setDraft, colors }) {
  function selectExperience(experienceLabel) {
    setDraft({ ...draft, experience: experienceLabel });
  }

  const experiencePills = buildExperiencePillElements(
    draft.experience,
    selectExperience,
    colors,
  );

  return (
    <View style={styles.section}>
      <SectionLabel colors={colors}>EXPERIENCE</SectionLabel>
      <View style={styles.pillWrap}>{experiencePills}</View>
    </View>
  );
}

function PricePerMonthSection({ draft, setDraft, colors }) {
  const inputChrome = {
    color: colors.nbInk,
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
  };

  function setPriceMin(typedText) {
    setDraft({ ...draft, priceMin: typedText });
  }

  function setPriceMax(typedText) {
    setDraft({ ...draft, priceMax: typedText });
  }

  return (
    <View style={styles.section}>
      <SectionLabel colors={colors}>PRICE PER MONTH</SectionLabel>
      <View style={styles.priceRow}>
        <HardShadow
          offset={nb.shadowOffsetSmall}
          radius={borderRadius.nbInput}
          style={styles.priceField}
        >
          <TextInput
            placeholder="Min $/mo"
            placeholderTextColor={colors.nbMuted}
            keyboardType="number-pad"
            value={draft.priceMin}
            onChangeText={setPriceMin}
            style={[styles.input, inputChrome]}
          />
        </HardShadow>
        <HardShadow
          offset={nb.shadowOffsetSmall}
          radius={borderRadius.nbInput}
          style={styles.priceField}
        >
          <TextInput
            placeholder="Max $/mo"
            placeholderTextColor={colors.nbMuted}
            keyboardType="number-pad"
            value={draft.priceMax}
            onChangeText={setPriceMax}
            style={[styles.input, inputChrome]}
          />
        </HardShadow>
      </View>
    </View>
  );
}

function AvailabilitySection({ draft, setDraft, colors }) {
  function selectAvailability(optionLabel) {
    setDraft({
      ...draft,
      availability: availabilityAfterTap(draft.availability, optionLabel),
    });
  }

  const availabilityPills = buildAvailabilityPillElements(
    draft.availability,
    selectAvailability,
    colors,
  );

  return (
    <View style={styles.section}>
      <SectionLabel colors={colors}>AVAILABILITY</SectionLabel>
      <View style={styles.pillWrap}>{availabilityPills}</View>
    </View>
  );
}

function VerifiedAvailableToggles({ draft, setDraft, colors }) {
  function setVerifiedOnly(nextValue) {
    setDraft({ ...draft, verifiedOnly: nextValue });
  }

  function setAvailableOnly(nextValue) {
    setDraft({ ...draft, availableOnly: nextValue });
  }

  const verifiedIsOn = Boolean(draft.verifiedOnly);
  const availableIsOn = Boolean(draft.availableOnly);

  return (
    <View
      style={[
        styles.toggleGroup,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
      <ToggleRow
        title="Verified"
        subtitle="Credentials checked"
        value={verifiedIsOn}
        onValueChange={setVerifiedOnly}
        colors={colors}
        showDivider
      />
      <ToggleRow
        title="Available only"
        subtitle="Hide waitlists"
        value={availableIsOn}
        onValueChange={setAvailableOnly}
        colors={colors}
      />
    </View>
  );
}

function FilterDraftEditor({
  draft,
  setDraft,
  colors,
  matchCount,
  onApplyAndClose,
}) {
  const showTrainersLabel = labelForShowTrainersButton(matchCount);
  const sortSegments = segmentsFromOptionLabels(SORT_OPTIONS);
  const sessionSegments = segmentsFromOptionLabels(SESSION_TYPES);

  function resetDraftToDefaults() {
    setDraft({ ...DEFAULT_FILTERS });
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: SHEET_SCROLL_EXTRA_PAD }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      bounces
    >
      <FilterSheetHeader colors={colors} onReset={resetDraftToDefaults} />
      <SortBySection
        draft={draft}
        setDraft={setDraft}
        colors={colors}
        sortSegments={sortSegments}
      />
      <SpecialtySection draft={draft} setDraft={setDraft} colors={colors} />
      <SessionTypeSection
        draft={draft}
        setDraft={setDraft}
        colors={colors}
        sessionSegments={sessionSegments}
      />
      <ExperienceSection draft={draft} setDraft={setDraft} colors={colors} />
      <PricePerMonthSection draft={draft} setDraft={setDraft} colors={colors} />
      <AvailabilitySection draft={draft} setDraft={setDraft} colors={colors} />
      <VerifiedAvailableToggles draft={draft} setDraft={setDraft} colors={colors} />
      <View style={styles.ctaWrap}>
        <NbButton variant="fill" onPress={onApplyAndClose}>
          {showTrainersLabel}
        </NbButton>
      </View>
    </ScrollView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Marketplace filter bottom sheet. Edits a draft copy; Apply writes back to the parent.
 * @param {object} props
 */
export function FilterPopup({
  visible,
  filters,
  onClose,
  onApply,
  trainers = [],
  search = '',
  quickSpecialty = DEFAULT_QUICK_SPECIALTY,
}) {
  // 1. Theme + home-indicator insets + draft state (starts from live filters).
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters || DEFAULT_FILTERS);

  // 2. Recopy live filters whenever the sheet opens — backdrop Cancel must not leak half-edits.
  useEffect(() => {
    if (!visible) {
      return;
    }
    setDraft(draftFromLiveFilters(filters));
  }, [visible, filters]);

  // 3. Live match count for the fill CTA — same rules as the list (filterTrainers).
  const matchCount = useMemo(
    () => countMatchingTrainers(trainers, draft, search, quickSpecialty),
    [trainers, draft, search, quickSpecialty],
  );

  const sheetBottomPad = Math.max(insets.bottom, MIN_SHEET_BOTTOM_PAD);

  function applyDraftAndClose() {
    callIfFunction(onApply, draft);
    callIfFunction(onClose);
  }

  const sheetChrome = {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
    paddingBottom: sheetBottomPad,
  };

  // 4. Modal shell + draft editor; only “Show N trainers” writes back to the parent.
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
        />
        <View style={[styles.sheet, sheetChrome]}>
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.nbBorder }]} />
          </View>

          <FilterDraftEditor
            draft={draft}
            setDraft={setDraft}
            colors={colors}
            matchCount={matchCount}
            onApplyAndClose={applyDraftAndClose}
          />
        </View>
      </View>
    </Modal>
  );
}

export default FilterPopup;

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  handle: {
    alignItems: 'center',
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
  },
  resetLink: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: SECTION_GAP,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.7,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priceField: {
    flex: 1,
  },
  input: {
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbInput,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  toggleGroup: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    marginBottom: SECTION_GAP,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    minHeight: 56,
  },
  toggleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  toggleTitle: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  toggleSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  ctaWrap: {
    marginTop: 4,
    marginBottom: spacing.sm,
  },
});
