// Bottom sheet for marketplace filters: sort, specialty, experience, price, session type.
// Flow: copy current filters into a draft → edit the draft → Apply writes it back, Reset restores defaults.
// Used by SearchTrainersScreen. The parent owns the live filters; this sheet only edits a copy.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND,
  DEFAULT_FILTERS,
  EXPERIENCE_OPTIONS,
  FILTER_SPECIALTIES,
  MP_FONT,
  PRICE_CEILING,
  PRICE_FLOOR,
  SESSION_TYPES,
  SORT_OPTIONS,
  getTheme,
} from './trainerFilters';
import { Pill, PrimaryButton, SecondaryButton, SectionLabel } from './FindTrainerPieces';
import BlurredBackground from '../../look-and-feel/BlurredBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ===== NAMED CONSTANTS =====

const THUMB_SIZE = 18;
const PRICE_SLIDER_STEP = 10;
const SHEET_SCROLL_EXTRA_PAD = 20;
const MIN_SHEET_BOTTOM_PAD = 16;
const ANY_PRICE_LABEL = 'Any';

// ===== HELPER FUNCTIONS =====

/**
 * How far the custom thumb sits on the track. 0 = floor, 1 = ceiling.
 * @param {number} value
 * @returns {number}
 */
function priceSliderRatio(value) {
  return (value - PRICE_FLOOR) / (PRICE_CEILING - PRICE_FLOOR);
}

/**
 * @param {object} draft
 * @returns {number}
 */
function draftMaxPrice(draft) {
  if (!draft.priceMax.trim()) return PRICE_CEILING;
  return Math.min(PRICE_CEILING, Math.max(PRICE_FLOOR, Number(draft.priceMax) || PRICE_CEILING));
}

/**
 * At the ceiling we show "Any" so a blank max-price field and the slider match.
 * @param {number} sliderMax
 * @returns {string}
 */
function maxPriceLabel(sliderMax) {
  if (sliderMax >= PRICE_CEILING) return ANY_PRICE_LABEL;
  return `$${sliderMax}`;
}

/**
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
 * Painted track + invisible native slider. The OS thumb is hidden so we can draw a branded one.
 */
function PriceSlider({ value, onValueChange, isDark, mutedColor }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const ratio = priceSliderRatio(value);
  const fillPct = Math.min(100, Math.max(0, ratio * 100));
  const thumbLeft = trackWidth > 0
    ? Math.min(trackWidth - THUMB_SIZE, Math.max(0, ratio * trackWidth - THUMB_SIZE / 2))
    : 0;

  return (
    <View
      style={styles.sliderHost}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      <View style={[styles.sliderTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : mutedColor }]}>
        <LinearGradient
          colors={[BRAND.pink, BRAND.orange]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.sliderFill, { width: `${fillPct}%` }]}
        />
      </View>
      <Slider
        style={styles.sliderNative}
        minimumValue={PRICE_FLOOR}
        maximumValue={PRICE_CEILING}
        step={PRICE_SLIDER_STEP}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor="transparent"
      />
      {trackWidth > 0 ? (
        <View pointerEvents="none" style={[styles.sliderThumb, { left: thumbLeft }]}>
          <View style={styles.sliderThumbInner} />
        </View>
      ) : null}
    </View>
  );
}

function FilterSection({ label, children }) {
  return (
    <View style={styles.filterSection}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Marketplace filter sheet. Edits a draft copy; Apply is the only write back to the parent.
 * vocab: useSafeAreaInsets = notch / home-indicator padding so the footer is not hidden.
 * vocab: useEffect recopies `filters` whenever the sheet opens so Cancel-by-backdrop never leaks edits.
 * @param {{ visible: boolean, filters: object, onClose: Function, onApply: Function, isDark?: boolean }} props
 */
export function FilterPopup({ visible, filters, onClose, onApply, isDark = true }) {
  const theme = getTheme(isDark);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const sliderMax = draftMaxPrice(draft);
  const maxLabel = maxPriceLabel(sliderMax);

  const toggleSpecialty = (specialty) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      specialties: specialtiesAfterToggle(currentDraft.specialties, specialty),
    }));
  };

  const applyDraftAndClose = () => {
    // 1. Write the draft to the parent, then close. Closing first would lose the edits.
    onApply(draft);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.filterSheetWrap}>
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <BlurredBackground
            intensity={isDark ? 32 : 24}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          >
            <Pressable
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? 'rgba(5, 5, 8, 0.48)' : 'rgba(250, 250, 252, 0.55)' },
              ]}
              onPress={onClose}
              accessibilityRole="button"
            />
          </BlurredBackground>
        </View>
        <View style={[styles.filterSheet, { backgroundColor: theme.card }]}>
          <ScrollView
            style={styles.filterScrollView}
            contentContainerStyle={[
              styles.filterScroll,
              { paddingBottom: Math.max(insets.bottom, MIN_SHEET_BOTTOM_PAD) + SHEET_SCROLL_EXTRA_PAD },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces
          >
            <View style={styles.filterHeader}>
              <View>
                <SectionLabel>Refine</SectionLabel>
                <Text style={[styles.filterTitle, { color: theme.foreground, fontFamily: MP_FONT.displayBold }]}>
                  Filters
                </Text>
              </View>
              <Pressable onPress={onClose} style={[styles.iconBtn, { borderColor: theme.border }]}>
                <Text style={{ color: theme.foreground, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>

            <FilterSection label="Sort by">
              <View style={[styles.pillWrap, styles.pillWrapCenter]}>
                {SORT_OPTIONS.map((option) => (
                  <Pill
                    key={option}
                    label={option}
                    active={draft.sort === option}
                    onPress={() => setDraft({ ...draft, sort: option })}
                    t={theme}
                    isDark={isDark}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection label="Specialty">
              <View style={[styles.pillWrap, styles.pillWrapCenter]}>
                {FILTER_SPECIALTIES.map((option) => (
                  <Pill
                    key={option}
                    label={option}
                    active={draft.specialties.includes(option)}
                    onPress={() => toggleSpecialty(option)}
                    t={theme}
                    isDark={isDark}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection label="Experience">
              <View style={styles.pillWrap}>
                {EXPERIENCE_OPTIONS.map((option) => (
                  <Pill
                    key={option}
                    label={option}
                    active={draft.experience === option}
                    onPress={() => setDraft({ ...draft, experience: option })}
                    t={theme}
                    isDark={isDark}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection label="Availability">
              <View
                style={[
                  styles.toggleRow,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : theme.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : theme.muted,
                  },
                ]}
              >
                <Text style={{ color: theme.foreground, fontWeight: '600' }}>Available only</Text>
                <Switch
                  value={draft.availableOnly}
                  onValueChange={(isAvailableOnly) => setDraft({ ...draft, availableOnly: isAvailableOnly })}
                  trackColor={{ false: theme.border, true: BRAND.pink }}
                  thumbColor="#fff"
                />
              </View>
            </FilterSection>

            <FilterSection label={`Max price · ${maxLabel}/mo`}>
              <PriceSlider
                value={sliderMax}
                isDark={isDark}
                mutedColor={theme.muted}
                onValueChange={(nextPrice) =>
                  setDraft({ ...draft, priceMax: nextPrice >= PRICE_CEILING ? '' : String(Math.round(nextPrice)) })
                }
              />
              <View style={styles.sliderLabels}>
                <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>${PRICE_FLOOR}</Text>
                <Text style={{ color: theme.mutedForeground, fontSize: 12 }}>${PRICE_CEILING}</Text>
              </View>
              <View style={styles.priceInputs}>
                <TextInput
                  placeholder="Min $/mo"
                  placeholderTextColor={theme.mutedForeground}
                  keyboardType="number-pad"
                  value={draft.priceMin}
                  onChangeText={(typedPrice) => setDraft({ ...draft, priceMin: typedPrice })}
                  style={[
                    styles.input,
                    {
                      color: theme.foreground,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.muted,
                    },
                  ]}
                />
                <TextInput
                  placeholder="Max $/mo"
                  placeholderTextColor={theme.mutedForeground}
                  keyboardType="number-pad"
                  value={draft.priceMax}
                  onChangeText={(typedPrice) => setDraft({ ...draft, priceMax: typedPrice })}
                  style={[
                    styles.input,
                    {
                      color: theme.foreground,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : theme.muted,
                    },
                  ]}
                />
              </View>
            </FilterSection>

            <FilterSection label="Session type">
              <View style={styles.pillWrap}>
                {SESSION_TYPES.map((option) => (
                  <Pill
                    key={option}
                    label={option}
                    active={draft.sessionType === option}
                    onPress={() => setDraft({ ...draft, sessionType: option })}
                    t={theme}
                    isDark={isDark}
                  />
                ))}
              </View>
            </FilterSection>

            <View
              style={[
                styles.filterFooter,
                { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border },
              ]}
            >
              <SecondaryButton
                onPress={() => setDraft(DEFAULT_FILTERS)}
                style={{ flex: 1 }}
                textColor={theme.foreground}
                isDark={isDark}
              >
                Reset
              </SecondaryButton>
              <PrimaryButton onPress={applyDraftAndClose} style={{ flex: 2 }}>
                Apply filters
              </PrimaryButton>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default FilterPopup;

const styles = StyleSheet.create({
  filterSheetWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sliderHost: {
    height: 44,
    justifyContent: 'center',
    marginTop: 4,
  },
  sliderTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 8,
    borderRadius: 999,
    top: 18,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 999,
  },
  sliderNative: {
    width: '100%',
    height: 44,
  },
  sliderThumb: {
    position: 'absolute',
    top: 13,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: BRAND.pink,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.45,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  sliderThumbInner: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: BRAND.pink,
  },
  filterSheet: {
    maxHeight: '92%',
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  filterScrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  filterScroll: { padding: 24, paddingBottom: 0 },
  pillWrapCenter: { justifyContent: 'center' },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  filterTitle: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: { marginBottom: 20 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  priceInputs: { flexDirection: 'row', gap: 10, marginTop: 12 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  filterFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingTop: 20,
    borderTopWidth: 1,
  },
});
