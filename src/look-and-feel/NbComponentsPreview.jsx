// Living storybook for every Design Law Nb* widget in this folder.
// Flow: read system theme → wire demo state → scroll one section per family → optional sheet.
// Used by: Stage 1 / visual QA via the dev menu (not a production tab).

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { lightColors, darkColors, spacing } from './colorPalette';
import NbScreen from './NbScreen';
import NbCard from './NbCard';
import NbButton from './NbButton';
import NbChip from './NbChip';
import NbChipRow from './NbChipRow';
import NbSegmented from './NbSegmented';
import NbOptionRow, { NbOptionGrid } from './NbOptionRow';
import NbTile from './NbTile';
import NbListRow from './NbListRow';
import NbSwitch from './NbSwitch';
import NbHero from './NbHero';
import NbPill from './NbPill';
import NbAvatar from './NbAvatar';
import NbSheet from './NbSheet';
import NbProgressSteps from './NbProgressSteps';
import NbRing from './NbRing';
import NbBottomNav from './NbBottomNav';

// ===== NAMED CONSTANTS =====

// Manipulate here: reorder or append demo chips when a new NbChipRow contract lands
const CHIP_ROW_DEMO_ITEMS = [
  { id: 'chip1', label: 'Chip 1' },
  { id: 'chip2', label: 'Chip 2' },
  { id: 'chip3', label: 'Chip 3' },
  { id: 'chip4', label: 'Chip 4' },
];

const SEGMENTED_DEMO_TABS = [
  { id: 'tab1', label: 'Tab 1' },
  { id: 'tab2', label: 'Tab 2' },
  { id: 'tab3', label: 'Tab 3' },
];

const OPTION_GRID_DEMO_ITEMS = [
  { id: 'grid1', title: 'Option A' },
  { id: 'grid2', title: 'Option B' },
  { id: 'grid3', title: 'Option C' },
  { id: 'grid4', title: 'Option D' },
];

const PROGRESS_STEPS_TOTAL = 5;
const RING_DEMO_PROGRESS = 0.65;
const RING_DEMO_SIZE = 120;
const RING_DEMO_STROKE = 10;
const AVATAR_SIZE_SMALL = 40;
const AVATAR_SIZE_MEDIUM = 60;
const AVATAR_SIZE_LARGE = 80;

// ===== HELPER FUNCTIONS =====

/**
 * Light palette for light/undefined scheme; dark palette only when scheme is "dark".
 * @param {string|null|undefined} colorScheme
 */
function pickPreviewColors(colorScheme) {
  const schemeIsDark = colorScheme === 'dark';
  if (schemeIsDark) {
    return darkColors;
  }
  return lightColors;
}

/**
 * Four fake bottom-nav tabs with Ionicons tinted to the active ink color.
 * @param {string} inkColor
 */
function buildPreviewBottomNavTabs(inkColor) {
  return [
    {
      id: 'home',
      icon: <Ionicons name="home-outline" size={22} color={inkColor} />,
      label: 'Home',
    },
    {
      id: 'workout',
      icon: <Ionicons name="barbell-outline" size={24} color={inkColor} />,
      label: 'Workout',
    },
    {
      id: 'nutrition',
      icon: <Ionicons name="restaurant-outline" size={22} color={inkColor} />,
      label: 'Nutrition',
    },
    {
      id: 'profile',
      icon: <Ionicons name="person-outline" size={22} color={inkColor} />,
      label: 'Profile',
    },
  ];
}

/**
 * Toggle one chip id in/out of the multi-select list (immutable updater for useState).
 * @param {string} chipId
 * @returns {(previousSelectedIds: string[]) => string[]}
 */
function createMultiSelectChipToggler(chipId) {
  return function updateMultiSelectedIds(previousSelectedIds) {
    const chipAlreadySelected = previousSelectedIds.includes(chipId);
    if (chipAlreadySelected) {
      return previousSelectedIds.filter((selectedId) => selectedId !== chipId);
    }
    return [...previousSelectedIds, chipId];
  };
}

function HorizontalSpacer({ width }) {
  return <View style={{ width }} />;
}

function PreviewSection({ label, inkColor, children }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: inkColor }]}>{label}</Text>
      {children}
    </View>
  );
}

function PreviewCatalogHeader({ inkColor, mutedColor, colorScheme }) {
  const themeLine = `Current theme: ${colorScheme}`;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: inkColor }]}>
        Neobrutalist Components
      </Text>
      <Text style={[styles.sectionSubtitle, { color: mutedColor }]}>
        {themeLine}
      </Text>
    </View>
  );
}

function ButtonsPreviewSection({ inkColor }) {
  function doNothingOnPress() {}

  return (
    <PreviewSection label="Buttons" inkColor={inkColor}>
      <View style={styles.row}>
        <View style={styles.buttonContainer}>
          <NbButton variant="brand" onPress={doNothingOnPress}>
            Brand
          </NbButton>
        </View>
        <View style={styles.buttonContainer}>
          <NbButton variant="ink" onPress={doNothingOnPress}>
            Ink
          </NbButton>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.buttonContainer}>
          <NbButton variant="plain" onPress={doNothingOnPress}>
            Plain
          </NbButton>
        </View>
        <View style={styles.buttonContainer}>
          <NbButton variant="brand" sm onPress={doNothingOnPress}>
            Small
          </NbButton>
        </View>
      </View>
      <NbButton variant="brand" disabled>
        Disabled
      </NbButton>
    </PreviewSection>
  );
}

function SingleSelectChipsSection({ inkColor, chipSelected, setChipSelected }) {
  const option1IsSelected = chipSelected === 'option1';
  const option2IsSelected = chipSelected === 'option2';
  const option3IsSelected = chipSelected === 'option3';

  function selectOption1() {
    setChipSelected('option1');
  }
  function selectOption2() {
    setChipSelected('option2');
  }
  function selectOption3() {
    setChipSelected('option3');
  }

  return (
    <PreviewSection label="Chips (Single Select)" inkColor={inkColor}>
      <View style={styles.row}>
        <NbChip selected={option1IsSelected} onPress={selectOption1}>
          Option 1
        </NbChip>
        <HorizontalSpacer width={spacing.sm} />
        <NbChip selected={option2IsSelected} onPress={selectOption2}>
          Option 2
        </NbChip>
        <HorizontalSpacer width={spacing.sm} />
        <NbChip selected={option3IsSelected} onPress={selectOption3}>
          Option 3
        </NbChip>
      </View>
    </PreviewSection>
  );
}

function OptionRowsPreviewSection({ inkColor, optionSelected, setOptionSelected }) {
  const firstOptionSelected = optionSelected === 'opt1';
  const secondOptionSelected = optionSelected === 'opt2';

  function selectFirstOption() {
    setOptionSelected('opt1');
  }
  function selectSecondOption() {
    setOptionSelected('opt2');
  }

  const firstRowExtraStyle = { marginBottom: spacing.sm };

  return (
    <PreviewSection label="Option Rows" inkColor={inkColor}>
      <NbOptionRow
        title="Option with checkbox"
        subtitle="This is a subtitle"
        selected={firstOptionSelected}
        showCheckbox
        onPress={selectFirstOption}
        style={firstRowExtraStyle}
      />
      <NbOptionRow
        title="Another option"
        subtitle="Also with a subtitle"
        selected={secondOptionSelected}
        showCheckbox
        onPress={selectSecondOption}
      />
    </PreviewSection>
  );
}

function StatusTilesPreviewSection({ inkColor }) {
  return (
    <PreviewSection label="Status Tiles" inkColor={inkColor}>
      <View style={styles.row}>
        <View style={styles.tileFlex}>
          <NbTile gradient="water" value="8" label="Glasses" />
        </View>
        <HorizontalSpacer width={spacing.sm} />
        <View style={styles.tileFlex}>
          <NbTile gradient="sleep" value="7.5h" label="Sleep" />
        </View>
        <HorizontalSpacer width={spacing.sm} />
        <View style={styles.tileFlex}>
          <NbTile gradient="energy" value="85%" label="Energy" />
        </View>
      </View>
    </PreviewSection>
  );
}

function ListRowsPreviewSection({ inkColor, mutedColor }) {
  function doNothingOnPress() {}

  const chevronNode = <Text style={{ color: mutedColor }}>→</Text>;
  const newPillNode = <NbPill variant="brand">New</NbPill>;
  const firstRowExtraStyle = { marginBottom: spacing.sm };

  return (
    <PreviewSection label="List Rows" inkColor={inkColor}>
      <NbListRow
        title="List Item 1"
        subtitle="With subtitle"
        right={chevronNode}
        onPress={doNothingOnPress}
        style={firstRowExtraStyle}
      />
      <NbListRow
        title="List Item 2"
        subtitle="Another item"
        right={newPillNode}
        onPress={doNothingOnPress}
      />
    </PreviewSection>
  );
}

function PillsPreviewSection({ inkColor }) {
  return (
    <PreviewSection label="Pills" inkColor={inkColor}>
      <View style={styles.row}>
        <NbPill variant="brand">Brand</NbPill>
        <HorizontalSpacer width={spacing.xs} />
        <NbPill variant="water">Water</NbPill>
        <HorizontalSpacer width={spacing.xs} />
        <NbPill variant="sleep">Sleep</NbPill>
        <HorizontalSpacer width={spacing.xs} />
        <NbPill variant="energy">Energy</NbPill>
        <HorizontalSpacer width={spacing.xs} />
        <NbPill variant="plain">Plain</NbPill>
      </View>
    </PreviewSection>
  );
}

function AvatarsPreviewSection({ inkColor }) {
  return (
    <PreviewSection label="Avatars" inkColor={inkColor}>
      <View style={styles.row}>
        <NbAvatar initials="JD" size={AVATAR_SIZE_SMALL} />
        <HorizontalSpacer width={spacing.sm} />
        <NbAvatar initials="AB" size={AVATAR_SIZE_MEDIUM} />
        <HorizontalSpacer width={spacing.sm} />
        <NbAvatar initials="XY" size={AVATAR_SIZE_LARGE} />
      </View>
    </PreviewSection>
  );
}

function PreviewExampleSheet({
  sheetVisible,
  inkColor,
  onCloseSheet,
}) {
  const bodyGapStyle = { height: spacing.md };

  return (
    <NbSheet
      visible={sheetVisible}
      onClose={onCloseSheet}
      title="Example Sheet"
      gradient
    >
      <Text style={[styles.body, { color: inkColor }]}>
        This is a bottom sheet with soft gradient background.
      </Text>
      <View style={bodyGapStyle} />
      <NbButton variant="ink" onPress={onCloseSheet}>
        Close Sheet
      </NbButton>
    </NbSheet>
  );
}

/**
 * Full catalog scroll body — one PreviewSection per Nb* family.
 * Kept as a pure layout so the exported screen only owns hooks + handlers.
 */
function PreviewCatalogBody({
  colorScheme,
  colors,
  chipSelected,
  setChipSelected,
  multiChipSelected,
  onMultiChipSelect,
  segmentSelected,
  setSegmentSelected,
  optionSelected,
  setOptionSelected,
  gridSelected,
  setGridSelected,
  switchValue,
  setSwitchValue,
  progressStep,
  bottomNavTabs,
  navActive,
  setNavActive,
  sheetVisible,
  onOpenSheet,
  onCloseSheet,
}) {
  const inkColor = colors.nbInk;
  const mutedColor = colors.nbMuted;
  const chipRowBleedStyle = { marginHorizontal: -spacing.md };
  const cardInnerPadStyle = { padding: spacing.md };
  const ringCenterStyle = { alignItems: 'center' };

  function doNothingOnPlusPress() {}

  const sheetFooterButton = (
    <NbButton variant="brand" onPress={onOpenSheet}>
      Open Sheet Example
    </NbButton>
  );

  return (
    <NbScreen footer={sheetFooterButton}>
      <PreviewCatalogHeader
        inkColor={inkColor}
        mutedColor={mutedColor}
        colorScheme={colorScheme}
      />

      <PreviewSection label="Hero" inkColor={inkColor}>
        <NbHero
          title="Welcome to Coach Connect"
          subtitle="Your fitness journey starts here"
        />
      </PreviewSection>

      <PreviewSection label="Progress Steps" inkColor={inkColor}>
        <NbProgressSteps total={PROGRESS_STEPS_TOTAL} current={progressStep} />
      </PreviewSection>

      <ButtonsPreviewSection inkColor={inkColor} />

      <SingleSelectChipsSection
        inkColor={inkColor}
        chipSelected={chipSelected}
        setChipSelected={setChipSelected}
      />

      <PreviewSection label="Chip Row (Multi Select)" inkColor={inkColor}>
        <NbChipRow
          items={CHIP_ROW_DEMO_ITEMS}
          selected={multiChipSelected}
          onSelect={onMultiChipSelect}
          multiSelect
          style={chipRowBleedStyle}
        />
      </PreviewSection>

      <PreviewSection label="Segmented Control" inkColor={inkColor}>
        <NbSegmented
          segments={SEGMENTED_DEMO_TABS}
          selected={segmentSelected}
          onSelect={setSegmentSelected}
        />
      </PreviewSection>

      <PreviewSection label="Cards" inkColor={inkColor}>
        <NbCard>
          <View style={cardInnerPadStyle}>
            <Text style={[styles.cardTitle, { color: inkColor }]}>
              Card Title
            </Text>
            <Text style={[styles.cardBody, { color: mutedColor }]}>
              This is a neobrutalist card with thick border and hard shadow.
            </Text>
          </View>
        </NbCard>
      </PreviewSection>

      <OptionRowsPreviewSection
        inkColor={inkColor}
        optionSelected={optionSelected}
        setOptionSelected={setOptionSelected}
      />

      <PreviewSection label="Option Grid" inkColor={inkColor}>
        <NbOptionGrid
          items={OPTION_GRID_DEMO_ITEMS}
          selected={gridSelected}
          onSelect={setGridSelected}
        />
      </PreviewSection>

      <StatusTilesPreviewSection inkColor={inkColor} />

      <ListRowsPreviewSection inkColor={inkColor} mutedColor={mutedColor} />

      <PreviewSection label="Switch" inkColor={inkColor}>
        <View style={styles.row}>
          <Text style={[styles.body, { color: inkColor, flex: 1 }]}>
            Toggle this switch
          </Text>
          <NbSwitch value={switchValue} onValueChange={setSwitchValue} />
        </View>
      </PreviewSection>

      <PillsPreviewSection inkColor={inkColor} />

      <AvatarsPreviewSection inkColor={inkColor} />

      <PreviewSection label="Progress Ring" inkColor={inkColor}>
        <View style={ringCenterStyle}>
          <NbRing
            progress={RING_DEMO_PROGRESS}
            size={RING_DEMO_SIZE}
            strokeWidth={RING_DEMO_STROKE}
            value="1,650"
            label="Calories"
          />
        </View>
      </PreviewSection>

      <PreviewSection label="Bottom Navigation" inkColor={inkColor}>
        <NbBottomNav
          tabs={bottomNavTabs}
          active={navActive}
          onSelect={setNavActive}
          onPlusPress={doNothingOnPlusPress}
        />
      </PreviewSection>

      <PreviewExampleSheet
        sheetVisible={sheetVisible}
        inkColor={inkColor}
        onCloseSheet={onCloseSheet}
      />
    </NbScreen>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Interactive catalog of all neobrutalist components in the active color scheme.
 * Flow: 1. theme  2. demo state  3. handlers  4. paint catalog
 */
export default function NbComponentsPreview() {
  // vocab: useColorScheme = RN hook for system light/dark (null on some web builds)
  const colorScheme = useColorScheme();
  const colors = pickPreviewColors(colorScheme);

  // Hook order frozen — append new demo state only at the bottom of this list.
  const [chipSelected, setChipSelected] = useState('option1');
  const [multiChipSelected, setMultiChipSelected] = useState(['chip1']);
  const [segmentSelected, setSegmentSelected] = useState('tab1');
  const [optionSelected, setOptionSelected] = useState('opt1');
  const [gridSelected, setGridSelected] = useState('grid1');
  const [switchValue, setSwitchValue] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [progressStep, setProgressStep] = useState(3);
  const [navActive, setNavActive] = useState('home');

  // 1. Multi-select chip row toggles one id without replacing the whole list by hand.
  function handleMultiChipRowSelect(chipId) {
    setMultiChipSelected(createMultiSelectChipToggler(chipId));
  }

  // 2. Sheet open/close — footer CTA opens; sheet Close / onClose dismiss.
  function openSheetExample() {
    setSheetVisible(true);
  }

  function closeSheetExample() {
    setSheetVisible(false);
  }

  // 3. Build nav tab icons once per ink color, then hand the whole catalog to layout.
  const bottomNavTabs = buildPreviewBottomNavTabs(colors.nbInk);

  // 4. Paint the scroll catalog (layout owns no hooks).
  return (
    <PreviewCatalogBody
      colorScheme={colorScheme}
      colors={colors}
      chipSelected={chipSelected}
      setChipSelected={setChipSelected}
      multiChipSelected={multiChipSelected}
      onMultiChipSelect={handleMultiChipRowSelect}
      segmentSelected={segmentSelected}
      setSegmentSelected={setSegmentSelected}
      optionSelected={optionSelected}
      setOptionSelected={setOptionSelected}
      gridSelected={gridSelected}
      setGridSelected={setGridSelected}
      switchValue={switchValue}
      setSwitchValue={setSwitchValue}
      progressStep={progressStep}
      bottomNavTabs={bottomNavTabs}
      navActive={navActive}
      setNavActive={setNavActive}
      sheetVisible={sheetVisible}
      onOpenSheet={openSheetExample}
      onCloseSheet={closeSheetExample}
    />
  );
}

// PLUMBING — skip unless debugging layout / type sizes
const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  tileFlex: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    marginBottom: 4,
  },
  cardBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
});
