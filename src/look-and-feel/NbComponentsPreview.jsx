// Preview screen showcasing all neobrutalist components in light and dark mode
// Flow: renders all Nb* components with examples → used for visual QA and reference
// Where used: temporary screen for Stage 1 review, can be accessed via dev menu
//
// vocab: component preview = visual catalog of all design system components

import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch as RNSwitch } from 'react-native';
import { useColorScheme } from 'react-native';
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

/**
 * Comprehensive preview of all neobrutalist components.
 * Shows each component with examples in current color scheme.
 */
export default function NbComponentsPreview() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  
  // Component states for interactive examples
  const [chipSelected, setChipSelected] = useState('option1');
  const [multiChipSelected, setMultiChipSelected] = useState(['chip1']);
  const [segmentSelected, setSegmentSelected] = useState('tab1');
  const [optionSelected, setOptionSelected] = useState('opt1');
  const [gridSelected, setGridSelected] = useState('grid1');
  const [switchValue, setSwitchValue] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [progressStep, setProgressStep] = useState(3);
  const [navActive, setNavActive] = useState('home');
  
  const toggleMultiChip = (id) => {
    setMultiChipSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };
  
  return (
    <NbScreen
      footer={
        <NbButton variant="brand" onPress={() => setSheetVisible(true)}>
          Open Sheet Example
        </NbButton>
      }
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.nbInk }]}>
          Neobrutalist Components
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.nbMuted }]}>
          Current theme: {colorScheme}
        </Text>
      </View>
      
      {/* Hero */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Hero</Text>
        <NbHero
          title="Welcome to Coach Connect"
          subtitle="Your fitness journey starts here"
        />
      </View>
      
      {/* Progress Steps */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Progress Steps</Text>
        <NbProgressSteps total={5} current={progressStep} />
      </View>
      
      {/* Buttons */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Buttons</Text>
        <View style={styles.row}>
          <View style={styles.buttonContainer}>
            <NbButton variant="brand" onPress={() => {}}>
              Brand
            </NbButton>
          </View>
          <View style={styles.buttonContainer}>
            <NbButton variant="ink" onPress={() => {}}>
              Ink
            </NbButton>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.buttonContainer}>
            <NbButton variant="plain" onPress={() => {}}>
              Plain
            </NbButton>
          </View>
          <View style={styles.buttonContainer}>
            <NbButton variant="brand" sm onPress={() => {}}>
              Small
            </NbButton>
          </View>
        </View>
        <NbButton variant="brand" disabled>
          Disabled
        </NbButton>
      </View>
      
      {/* Chips */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Chips (Single Select)</Text>
        <View style={styles.row}>
          <NbChip
            selected={chipSelected === 'option1'}
            onPress={() => setChipSelected('option1')}
          >
            Option 1
          </NbChip>
          <View style={{ width: spacing.sm }} />
          <NbChip
            selected={chipSelected === 'option2'}
            onPress={() => setChipSelected('option2')}
          >
            Option 2
          </NbChip>
          <View style={{ width: spacing.sm }} />
          <NbChip
            selected={chipSelected === 'option3'}
            onPress={() => setChipSelected('option3')}
          >
            Option 3
          </NbChip>
        </View>
      </View>
      
      {/* Chip Row */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Chip Row (Multi Select)</Text>
        <NbChipRow
          items={[
            { id: 'chip1', label: 'Chip 1' },
            { id: 'chip2', label: 'Chip 2' },
            { id: 'chip3', label: 'Chip 3' },
            { id: 'chip4', label: 'Chip 4' },
          ]}
          selected={multiChipSelected}
          onSelect={toggleMultiChip}
          multiSelect
          style={{ marginHorizontal: -spacing.md }}
        />
      </View>
      
      {/* Segmented Control */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Segmented Control</Text>
        <NbSegmented
          segments={[
            { id: 'tab1', label: 'Tab 1' },
            { id: 'tab2', label: 'Tab 2' },
            { id: 'tab3', label: 'Tab 3' },
          ]}
          selected={segmentSelected}
          onSelect={setSegmentSelected}
        />
      </View>
      
      {/* Cards */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Cards</Text>
        <NbCard>
          <View style={{ padding: spacing.md }}>
            <Text style={[styles.cardTitle, { color: colors.nbInk }]}>
              Card Title
            </Text>
            <Text style={[styles.cardBody, { color: colors.nbMuted }]}>
              This is a neobrutalist card with thick border and hard shadow.
            </Text>
          </View>
        </NbCard>
      </View>
      
      {/* Option Rows */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Option Rows</Text>
        <NbOptionRow
          title="Option with checkbox"
          subtitle="This is a subtitle"
          selected={optionSelected === 'opt1'}
          showCheckbox
          onPress={() => setOptionSelected('opt1')}
          style={{ marginBottom: spacing.sm }}
        />
        <NbOptionRow
          title="Another option"
          subtitle="Also with a subtitle"
          selected={optionSelected === 'opt2'}
          showCheckbox
          onPress={() => setOptionSelected('opt2')}
        />
      </View>
      
      {/* Option Grid */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Option Grid</Text>
        <NbOptionGrid
          items={[
            { id: 'grid1', title: 'Option A' },
            { id: 'grid2', title: 'Option B' },
            { id: 'grid3', title: 'Option C' },
            { id: 'grid4', title: 'Option D' },
          ]}
          selected={gridSelected}
          onSelect={setGridSelected}
        />
      </View>
      
      {/* Tiles */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Status Tiles</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <NbTile gradient="water" value="8" label="Glasses" />
          </View>
          <View style={{ width: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <NbTile gradient="sleep" value="7.5h" label="Sleep" />
          </View>
          <View style={{ width: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <NbTile gradient="energy" value="85%" label="Energy" />
          </View>
        </View>
      </View>
      
      {/* List Rows */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>List Rows</Text>
        <NbListRow
          title="List Item 1"
          subtitle="With subtitle"
          right={<Text style={{ color: colors.nbMuted }}>→</Text>}
          onPress={() => {}}
          style={{ marginBottom: spacing.sm }}
        />
        <NbListRow
          title="List Item 2"
          subtitle="Another item"
          right={<NbPill variant="brand">New</NbPill>}
          onPress={() => {}}
        />
      </View>
      
      {/* Switch */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Switch</Text>
        <View style={styles.row}>
          <Text style={[styles.body, { color: colors.nbInk, flex: 1 }]}>
            Toggle this switch
          </Text>
          <NbSwitch value={switchValue} onValueChange={setSwitchValue} />
        </View>
      </View>
      
      {/* Pills */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Pills</Text>
        <View style={styles.row}>
          <NbPill variant="brand">Brand</NbPill>
          <View style={{ width: spacing.xs }} />
          <NbPill variant="water">Water</NbPill>
          <View style={{ width: spacing.xs }} />
          <NbPill variant="sleep">Sleep</NbPill>
          <View style={{ width: spacing.xs }} />
          <NbPill variant="energy">Energy</NbPill>
          <View style={{ width: spacing.xs }} />
          <NbPill variant="plain">Plain</NbPill>
        </View>
      </View>
      
      {/* Avatars */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Avatars</Text>
        <View style={styles.row}>
          <NbAvatar initials="JD" size={40} />
          <View style={{ width: spacing.sm }} />
          <NbAvatar initials="AB" size={60} />
          <View style={{ width: spacing.sm }} />
          <NbAvatar initials="XY" size={80} />
        </View>
      </View>
      
      {/* Ring */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Progress Ring</Text>
        <View style={{ alignItems: 'center' }}>
          <NbRing
            progress={0.65}
            size={120}
            strokeWidth={10}
            value="1,650"
            label="Calories"
          />
        </View>
      </View>
      
      {/* Bottom Nav */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbInk }]}>Bottom Navigation</Text>
        <NbBottomNav
          tabs={[
            { id: 'home', icon: <Text>🏠</Text>, activeIcon: <Text>🏠</Text>, label: 'Home' },
            { id: 'workout', icon: <Text>💪</Text>, activeIcon: <Text>💪</Text>, label: 'Workout' },
            { id: 'nutrition', icon: <Text>🥗</Text>, activeIcon: <Text>🥗</Text>, label: 'Nutrition' },
            { id: 'profile', icon: <Text>👤</Text>, activeIcon: <Text>👤</Text>, label: 'Profile' },
          ]}
          active={navActive}
          onSelect={setNavActive}
        />
      </View>
      
      {/* Sheet */}
      <NbSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title="Example Sheet"
        gradient
      >
        <Text style={[styles.body, { color: colors.nbInk }]}>
          This is a bottom sheet with soft gradient background.
        </Text>
        <View style={{ height: spacing.md }} />
        <NbButton variant="ink" onPress={() => setSheetVisible(false)}>
          Close Sheet
        </NbButton>
      </NbSheet>
    </NbScreen>
  );
}

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
