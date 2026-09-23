// Dev-only gallery for eyeballing every onboarding screen without creating an account.
// Flow: pick a role chip and a step number → those choices are handed to the real NewUserSetupScreen in preview mode.
// Opened from the dev menu; nothing here ships to users, and no onboarding data is ever saved.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from '../trainer-pro-plan/proPlanSwitches';
import { ProPlanSetup } from '../trainer-pro-plan/ProPlanSetup';
import NewUserSetupScreen from './NewUserSetupScreen';

export default function SetupPreviewScreen({ onClose }) {
  // vocab: useSafeAreaInsets = how much of the screen the notch/status bar covers on this device;
  // the toolbar below has to pad itself down by that much or it renders under the clock.
  const insets = useSafeAreaInsets();

  // The two dials of this whole screen: which flow, and which step of it.
  // vocab: useState = React's "remember a value and re-render when it changes".
  const [role, setRole] = useState('client');
  const [step, setStep] = useState(1);

  // How many chips to draw in the step picker.
  // Manipulate here: these counts are hand-kept in sync with the real wizard. If you add a step to
  // client or trainer onboarding, bump the matching number or that step becomes unreachable here.
  const totalSteps = role === 'client' ? 9 : 8;

  return (
    // Manipulate here: #0A0A0F is the app's near-black background — matches the wizard so the
    // preview doesn't look like a different app behind the toolbar.
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      {/* Dev toolbar: the only non-production chrome here. Sits above the wizard and pads itself
          past the notch, since the wizard underneath draws its own full-screen layout. */}
      <View style={[styles.toolbar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.toolbarRow}>
          <Text style={styles.toolbarTitle}>Onboarding preview</Text>
          {/* Manipulate here: hitSlop=12 grows the tappable area 12px past the text on every side,
              so this small word is still easy to hit with a thumb. */}
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>Close</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.toolbarHint}>No signup — tap a step to jump</Text>

        {/* Role switcher. Manipulate here: the array below is the list of flows you can preview. */}
        <View style={styles.roleRow}>
          {['client', 'trainer'].map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => {
                // Reset to step 1 alongside the role: trainer onboarding has fewer steps, so
                // staying on step 9 after switching would ask for a step that doesn't exist.
                setRole(r);
                setStep(1);
              }}
              // vocab/symbol: `cond && style` inside an array = apply that style only when cond is
              // true (false is ignored by React Native's style merger). This is the "selected" look.
              style={[styles.roleChip, role === r && styles.roleChipOn]}
            >
              <Text style={[styles.roleChipText, role === r && styles.roleChipTextOn]}>
                {r === 'client' ? 'Client' : 'Trainer'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Step picker — a horizontal strip of numbered chips, one per step of the chosen flow.
            Scrollable because 9 chips don't fit on a narrow phone. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepRow}>
          {/* vocab: Array.from({ length: n }, (_, i) => i + 1) = build [1, 2, 3 … n].
              The `_` is the (unused) element value; `i` is the index, and +1 makes it 1-based to
              match how the wizard numbers its steps. */}
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setStep(n)}
              style={[styles.stepChip, step === n && styles.stepChipOn]}
            >
              <Text style={[styles.stepChipText, step === n && styles.stepChipTextOn]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* The wizard reads subscription state through this provider, so it must be wrapped even in
          preview. userId={null} = "nobody signed in", which makes the provider serve its
          logged-out defaults instead of fetching a real subscription. */}
      <ProPlanSetup userId={null}>
        <NewUserSetupScreen
          // The key is the whole trick of this screen: changing a key makes React throw the old
          // component away and mount a fresh one. Without it, the wizard would keep its internal
          // step state and ignore previewInitialStep after the first render.
          key={`${role}-${step}`}
          role={role}
          // previewMode tells the wizard to skip auth/writes; previewInitialStep is where to open.
          previewMode
          previewInitialStep={step}
          onPreviewClose={onClose}
          // Empty handler: finishing in preview should save nothing and navigate nowhere.
          onComplete={() => {}}
        />
      </ProPlanSetup>
    </View>
  );
}

// Toolbar styling only — the wizard below brings its own.
// Manipulate here: #FF6B9D is the app's pink accent (used for Close + the selected role chip) and
// #9A3412 the burnt-orange used for the selected step chip. rgba(255,255,255,0.x) values are white
// at x opacity, which is how the dark theme does muted text and hairline borders.
const styles = StyleSheet.create({
  toolbar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#12121A',
    zIndex: 10,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  toolbarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  toolbarHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginBottom: 10,
  },
  closeBtn: {
    color: '#FF6B9D',
    fontSize: 15,
    fontWeight: '700',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  roleChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  roleChipOn: {
    borderColor: '#FF6B9D',
    backgroundColor: 'rgba(255,107,157,0.15)',
  },
  roleChipText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
  roleChipTextOn: {
    color: '#FFFFFF',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  stepChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  stepChipOn: {
    borderColor: '#9A3412',
    backgroundColor: 'rgba(154,52,18,0.35)',
  },
  stepChipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '700',
  },
  stepChipTextOn: {
    color: '#FFFFFF',
  },
});
