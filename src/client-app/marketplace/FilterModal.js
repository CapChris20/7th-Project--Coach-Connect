/**
 * Filter Modal
 *
 * Purpose: UI screen or component: Filter Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/marketplace
 * Key exports: FilterModal
 *
 * @file-header
 */
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
} from '../marketplaceFilters';
import { Pill, PrimaryButton, SecondaryButton, SectionLabel } from './MarketplaceUI';
import BlurBackdropPlate from '../../shared-ui/BlurBackdropPlate';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const THUMB_SIZE = 18;

function PriceSlider({ value, onValueChange, isDark, mutedColor }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const ratio = (value - PRICE_FLOOR) / (PRICE_CEILING - PRICE_FLOOR);
  const fillPct = Math.min(100, Math.max(0, ratio * 100));
  const thumbLeft = trackWidth > 0 ? Math.min(trackWidth - THUMB_SIZE, Math.max(0, ratio * trackWidth - THUMB_SIZE / 2)) : 0;

  return (
    <View
      style={s.sliderHost}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <View style={[s.sliderTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : mutedColor }]}>
        <LinearGradient
          colors={[BRAND.pink, BRAND.orange]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.sliderFill, { width: `${fillPct}%` }]}
        />
      </View>
      <Slider
        style={s.sliderNative}
        minimumValue={PRICE_FLOOR}
        maximumValue={PRICE_CEILING}
        step={10}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor="transparent"
      />
      {trackWidth > 0 ? (
        <View pointerEvents="none" style={[s.sliderThumb, { left: thumbLeft }]}>
          <View style={s.sliderThumbInner} />
        </View>
      ) : null}
    </View>
  );
}

function FilterSection({ label, children }) {
  return (
    <View style={s.filterSection}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </View>
  );
}

export function FilterModal({ visible, filters, onClose, onApply, isDark = true }) {
  const t = getTheme(isDark);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const sliderMax = draft.priceMax.trim()
    ? Math.min(PRICE_CEILING, Math.max(PRICE_FLOOR, Number(draft.priceMax) || PRICE_CEILING))
    : PRICE_CEILING;
  const maxLabel = sliderMax >= PRICE_CEILING ? 'Any' : `$${sliderMax}`;

  const toggleSpec = (spec) =>
    setDraft((d) => ({
      ...d,
      specialties: d.specialties.includes(spec)
        ? d.specialties.filter((x) => x !== spec)
        : [...d.specialties, spec],
    }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.filterSheetWrap}>
        <View style={s.modalOverlay} pointerEvents="box-none">
          <BlurBackdropPlate
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
          </BlurBackdropPlate>
        </View>
        <View style={[s.filterSheet, { backgroundColor: t.card }]}>
          <ScrollView
            style={s.filterScrollView}
            contentContainerStyle={[
              s.filterScroll,
              { paddingBottom: Math.max(insets.bottom, 16) + 20 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces
          >
            <View style={s.filterHeader}>
              <View>
                <SectionLabel>Refine</SectionLabel>
                <Text style={[s.filterTitle, { color: t.foreground, fontFamily: MP_FONT.displayBold }]}>
                  Filters
                </Text>
              </View>
              <Pressable onPress={onClose} style={[s.iconBtn, { borderColor: t.border }]}>
                <Text style={{ color: t.foreground, fontSize: 18 }}>✕</Text>
              </Pressable>
            </View>

            <FilterSection label="Sort by">
              <View style={[s.pillWrap, s.pillWrapCenter]}>
                {SORT_OPTIONS.map((o) => (
                  <Pill
                    key={o}
                    label={o}
                    active={draft.sort === o}
                    onPress={() => setDraft({ ...draft, sort: o })}
                    t={t}
                    isDark={isDark}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection label="Specialty">
              <View style={[s.pillWrap, s.pillWrapCenter]}>
                {FILTER_SPECIALTIES.map((o) => (
                  <Pill
                    key={o}
                    label={o}
                    active={draft.specialties.includes(o)}
                    onPress={() => toggleSpec(o)}
                    t={t}
                    isDark={isDark}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection label="Experience">
              <View style={s.pillWrap}>
                {EXPERIENCE_OPTIONS.map((o) => (
                  <Pill
                    key={o}
                    label={o}
                    active={draft.experience === o}
                    onPress={() => setDraft({ ...draft, experience: o })}
                    t={t}
                    isDark={isDark}
                  />
                ))}
              </View>
            </FilterSection>

            <FilterSection label="Availability">
              <View
                style={[
                  s.toggleRow,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : t.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : t.muted,
                  },
                ]}
              >
                <Text style={{ color: t.foreground, fontWeight: '600' }}>Available only</Text>
                <Switch
                  value={draft.availableOnly}
                  onValueChange={(v) => setDraft({ ...draft, availableOnly: v })}
                  trackColor={{ false: t.border, true: BRAND.pink }}
                  thumbColor="#fff"
                />
              </View>
            </FilterSection>

            <FilterSection label={`Max price · ${maxLabel}/mo`}>
              <PriceSlider
                value={sliderMax}
                isDark={isDark}
                mutedColor={t.muted}
                onValueChange={(v) =>
                  setDraft({ ...draft, priceMax: v >= PRICE_CEILING ? '' : String(Math.round(v)) })
                }
              />
              <View style={s.sliderLabels}>
                <Text style={{ color: t.mutedForeground, fontSize: 12 }}>${PRICE_FLOOR}</Text>
                <Text style={{ color: t.mutedForeground, fontSize: 12 }}>${PRICE_CEILING}</Text>
              </View>
              <View style={s.priceInputs}>
                <TextInput
                  placeholder="Min $/mo"
                  placeholderTextColor={t.mutedForeground}
                  keyboardType="number-pad"
                  value={draft.priceMin}
                  onChangeText={(v) => setDraft({ ...draft, priceMin: v })}
                  style={[
                    s.input,
                    {
                      color: t.foreground,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : t.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : t.muted,
                    },
                  ]}
                />
                <TextInput
                  placeholder="Max $/mo"
                  placeholderTextColor={t.mutedForeground}
                  keyboardType="number-pad"
                  value={draft.priceMax}
                  onChangeText={(v) => setDraft({ ...draft, priceMax: v })}
                  style={[
                    s.input,
                    {
                      color: t.foreground,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : t.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : t.muted,
                    },
                  ]}
                />
              </View>
            </FilterSection>

            <FilterSection label="Session type">
              <View style={s.pillWrap}>
                {SESSION_TYPES.map((o) => (
                  <Pill
                    key={o}
                    label={o}
                    active={draft.sessionType === o}
                    onPress={() => setDraft({ ...draft, sessionType: o })}
                    t={t}
                    isDark={isDark}
                  />
                ))}
              </View>
            </FilterSection>

            <View
              style={[
                s.filterFooter,
                { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : t.border },
              ]}
            >
              <SecondaryButton
                onPress={() => setDraft(DEFAULT_FILTERS)}
                style={{ flex: 1 }}
                textColor={t.foreground}
                isDark={isDark}
              >
                Reset
              </SecondaryButton>
              <PrimaryButton
                onPress={() => {
                  onApply(draft);
                  onClose();
                }}
                style={{ flex: 2 }}
              >
                Apply filters
              </PrimaryButton>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default FilterModal;

const s = StyleSheet.create({
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
