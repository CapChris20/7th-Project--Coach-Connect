// Marketplace Filter bottom sheet — Design Law HardShadow / Nb* chrome (PNG 05).
// Flow: copy live filters into a draft → edit → Reset restores defaults → Show N trainers applies + closes.
// Used by SearchTrainersScreen. Parent owns the live filters; this sheet only edits a copy.
//
// vocab: draft = local copy so Cancel-by-backdrop never leaks half-edited filters
// vocab: NbSegmented = mutually exclusive solid-fill tabs in one outlined track

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

// ===== HELPER FUNCTIONS =====

/**
 * Multi-select specialty toggle — add if missing, remove if present.
 * @param {string[]} specialties
 * @param {string} specialty
 * @returns {string[]}
 */
function specialtiesAfterToggle(specialties, specialty) {
  if (specialties.includes(specialty)) {
    return specialties.filter((entry) => entry !== specialty);
  }
  return [...specialties, specialty];
}

/**
 * Availability is a single exclusive pick (or null = any). Tap again to clear.
 * @param {string|null} current
 * @param {string} option
 * @returns {string|null}
 */
function availabilityAfterTap(current, option) {
  if (current === option) return null;
  return option;
}

function SectionLabel({ children, colors }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{children}</Text>
  );
}

/**
 * Solid-fill selected pill (PNG 05 specialty / experience / availability).
 * Selected = nbFill + onFill text — never brand gradient chrome.
 */
function FilterPill({ label, active, onPress, colors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.pill,
        {
          borderColor: colors.nbBorder,
          backgroundColor: active ? colors.nbFill : colors.nbSurface,
        },
      ]}
    >
      <Text
        style={[styles.pillText, { color: active ? colors.nbOnFill : colors.nbInk }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({ title, subtitle, value, onValueChange, colors, showDivider }) {
  return (
    <View
      style={[
        styles.toggleRow,
        showDivider && { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.nbBorder },
      ]}
    >
      <View style={styles.toggleCopy}>
        <Text style={[styles.toggleTitle, { color: colors.nbInk }]}>{title}</Text>
        <Text style={[styles.toggleSub, { color: colors.nbMuted }]}>{subtitle}</Text>
      </View>
      <NbSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Marketplace filter sheet. Edits a draft copy; Show N trainers is the only write back to the parent.
 * @param {{
 *   visible: boolean,
 *   filters: object,
 *   onClose: Function,
 *   onApply: Function,
 *   trainers?: object[],
 *   search?: string,
 *   quickSpecialty?: string,
 * }} props
 */
export function FilterPopup({
  visible,
  filters,
  onClose,
  onApply,
  trainers = [],
  search = '',
  quickSpecialty = 'All',
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters || DEFAULT_FILTERS);

  // Recopy live filters whenever the sheet opens so Cancel never leaks half-edits.
  useEffect(() => {
    if (visible) setDraft({ ...DEFAULT_FILTERS, ...(filters || {}) });
  }, [visible, filters]);

  // Live match count for the fill CTA — same rules as the list (filterTrainers).
  const matchCount = useMemo(
    () => filterTrainers(trainers, draft, { query: search, quickSpecialty }).length,
    [trainers, draft, search, quickSpecialty],
  );

  const sortSegments = SORT_OPTIONS.map((option) => ({ id: option, label: option }));
  const sessionSegments = SESSION_TYPES.map((option) => ({ id: option, label: option }));

  const toggleSpecialty = (specialty) => {
    setDraft((current) => ({
      ...current,
      specialties: specialtiesAfterToggle(current.specialties || [], specialty),
    }));
  };

  const applyDraftAndClose = () => {
    onApply?.(draft);
    onClose?.();
  };

  const showLabel =
    matchCount === 1 ? 'Show 1 trainer' : `Show ${matchCount} trainers`;

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
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.nbSurface,
              borderColor: colors.nbBorder,
              paddingBottom: Math.max(insets.bottom, MIN_SHEET_BOTTOM_PAD),
            },
          ]}
        >
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.nbBorder }]} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: SHEET_SCROLL_EXTRA_PAD }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces
          >
            {/* Header: Filter + underlined Reset */}
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.nbInk }]}>Filter</Text>
              <Pressable
                onPress={() => setDraft({ ...DEFAULT_FILTERS })}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Reset filters"
              >
                <Text style={[styles.resetLink, { color: colors.nbInk }]}>Reset</Text>
              </Pressable>
            </View>

            {/* SORT BY — segmented */}
            <View style={styles.section}>
              <SectionLabel colors={colors}>SORT BY</SectionLabel>
              <NbSegmented
                segments={sortSegments}
                selected={draft.sort || 'Newest'}
                onSelect={(id) => setDraft({ ...draft, sort: id })}
              />
            </View>

            {/* SPECIALTY — multi pills */}
            <View style={styles.section}>
              <SectionLabel colors={colors}>SPECIALTY</SectionLabel>
              <View style={styles.pillWrap}>
                {FILTER_SPECIALTIES.map((option) => (
                  <FilterPill
                    key={option}
                    label={option}
                    active={(draft.specialties || []).includes(option)}
                    onPress={() => toggleSpecialty(option)}
                    colors={colors}
                  />
                ))}
              </View>
            </View>

            {/* SESSION TYPE — segmented */}
            <View style={styles.section}>
              <SectionLabel colors={colors}>SESSION TYPE</SectionLabel>
              <NbSegmented
                segments={sessionSegments}
                selected={draft.sessionType || 'Both'}
                onSelect={(id) => setDraft({ ...draft, sessionType: id })}
              />
            </View>

            {/* EXPERIENCE — exclusive pills */}
            <View style={styles.section}>
              <SectionLabel colors={colors}>EXPERIENCE</SectionLabel>
              <View style={styles.pillWrap}>
                {EXPERIENCE_OPTIONS.map((option) => (
                  <FilterPill
                    key={option}
                    label={option}
                    active={draft.experience === option}
                    onPress={() => setDraft({ ...draft, experience: option })}
                    colors={colors}
                  />
                ))}
              </View>
            </View>

            {/* PRICE PER MONTH — min / max fields (no slider in PNG 05) */}
            <View style={styles.section}>
              <SectionLabel colors={colors}>PRICE PER MONTH</SectionLabel>
              <View style={styles.priceRow}>
                <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbInput} style={styles.priceField}>
                  <TextInput
                    placeholder="Min $/mo"
                    placeholderTextColor={colors.nbMuted}
                    keyboardType="number-pad"
                    value={draft.priceMin}
                    onChangeText={(typed) => setDraft({ ...draft, priceMin: typed })}
                    style={[
                      styles.input,
                      {
                        color: colors.nbInk,
                        borderColor: colors.nbBorder,
                        backgroundColor: colors.nbSurface,
                      },
                    ]}
                  />
                </HardShadow>
                <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbInput} style={styles.priceField}>
                  <TextInput
                    placeholder="Max $/mo"
                    placeholderTextColor={colors.nbMuted}
                    keyboardType="number-pad"
                    value={draft.priceMax}
                    onChangeText={(typed) => setDraft({ ...draft, priceMax: typed })}
                    style={[
                      styles.input,
                      {
                        color: colors.nbInk,
                        borderColor: colors.nbBorder,
                        backgroundColor: colors.nbSurface,
                      },
                    ]}
                  />
                </HardShadow>
              </View>
            </View>

            {/* AVAILABILITY — exclusive pills */}
            <View style={styles.section}>
              <SectionLabel colors={colors}>AVAILABILITY</SectionLabel>
              <View style={styles.pillWrap}>
                {AVAILABILITY_OPTIONS.map((option) => (
                  <FilterPill
                    key={option}
                    label={option}
                    active={draft.availability === option}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        availability: availabilityAfterTap(draft.availability, option),
                      })
                    }
                    colors={colors}
                  />
                ))}
              </View>
            </View>

            {/* Verified + Available only toggles in one outlined group */}
            <View
              style={[
                styles.toggleGroup,
                { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
              ]}
            >
              <ToggleRow
                title="Verified"
                subtitle="Credentials checked"
                value={!!draft.verifiedOnly}
                onValueChange={(next) => setDraft({ ...draft, verifiedOnly: next })}
                colors={colors}
                showDivider
              />
              <ToggleRow
                title="Available only"
                subtitle="Hide waitlists"
                value={!!draft.availableOnly}
                onValueChange={(next) => setDraft({ ...draft, availableOnly: next })}
                colors={colors}
              />
            </View>

            {/* Primary CTA */}
            <View style={styles.ctaWrap}>
              <NbButton variant="fill" onPress={applyDraftAndClose}>
                {showLabel}
              </NbButton>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default FilterPopup;

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
