// Dev-only gallery for eyeballing every onboarding screen without creating an account.
// Flow: pick a role chip and a step number → those choices are handed to the real NewUserSetupScreen in preview mode.
// Opened from the dev menu; nothing here ships to users, and no onboarding data is ever saved.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from '../trainer-pro-plan/proPlanSwitches';
import { ProPlanSetup } from '../trainer-pro-plan/ProPlanSetup';
import NewUserSetupScreen from './NewUserSetupScreen';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { nb, gradients } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const ROLE_CLIENT = 'client';
const ROLE_TRAINER = 'trainer';
const PREVIEW_ROLES = [ROLE_CLIENT, ROLE_TRAINER];
const CLIENT_STEP_COUNT = 9;
const TRAINER_STEP_COUNT = 8;
const FIRST_STEP = 1;

// ===== HELPER FUNCTIONS =====

/**
 * How many numbered chips to draw. Hand-kept in sync with the real wizard.
 * Manipulate here: if you add a step to client or trainer onboarding, bump the matching constant.
 * @param {string} role
 * @returns {number}
 */
function stepCountForRole(role) {
  return role === ROLE_CLIENT ? CLIENT_STEP_COUNT : TRAINER_STEP_COUNT;
}

/**
 * vocab: Array.from({ length }, (_, index) => index + 1) builds [1, 2, 3 … n] to match wizard steps.
 * @param {number} totalSteps
 * @returns {number[]}
 */
function stepNumbers(totalSteps) {
  return Array.from({ length: totalSteps }, (_, index) => index + FIRST_STEP);
}

function roleChipLabel(role) {
  return role === ROLE_CLIENT ? 'Client' : 'Trainer';
}

// ===== MAIN FUNCTION =====

/**
 * Dev toolbar + live NewUserSetupScreen. Changing the key remounts the wizard on each jump.
 * @param {{ onClose: Function }} props
 */
export default function SetupPreviewScreen({ onClose }) {
  // vocab: useSafeAreaInsets = how much of the screen the notch/status bar covers on this device.
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [role, setRole] = useState(ROLE_CLIENT);
  const [step, setStep] = useState(FIRST_STEP);

  const totalSteps = stepCountForRole(role);

  const toolbarStyle = {
    ...styles.toolbar,
    paddingTop: insets.top + 8,
    backgroundColor: colors.nbSurface,
    borderBottomColor: colors.nbBorder,
    borderBottomWidth: nb.borderWidth,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.nbBackground }}>
      {/* Dev toolbar sits above the wizard and pads itself past the notch. */}
      <View style={toolbarStyle}>
        <View style={styles.toolbarRow}>
          <Text style={[styles.toolbarTitle, { color: colors.nbInk }]}>Onboarding preview</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>Close</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.toolbarHint, { color: colors.nbMuted }]}>No signup — tap a step to jump</Text>

        <View style={styles.roleRow}>
          {PREVIEW_ROLES.map((previewRole) => (
            <TouchableOpacity
              key={previewRole}
              onPress={() => {
                // Reset to step 1: trainer onboarding has fewer steps, so staying on 9 would miss.
                setRole(previewRole);
                setStep(FIRST_STEP);
              }}
              style={[
                styles.roleChip,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder, borderWidth: nb.borderWidth },
                role === previewRole && { backgroundColor: gradients.brand.colors[0] }
              ]}
            >
              <Text style={[
                styles.roleChipText,
                { color: colors.nbMuted },
                role === previewRole && { color: colors.nbInk }
              ]}>
                {roleChipLabel(previewRole)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepRow}>
          {stepNumbers(totalSteps).map((stepNumber) => (
            <TouchableOpacity
              key={stepNumber}
              onPress={() => setStep(stepNumber)}
              style={[
                styles.stepChip,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder, borderWidth: nb.borderWidth },
                step === stepNumber && { backgroundColor: gradients.ink.colors[0] }
              ]}
            >
              <Text style={[
                styles.stepChipText,
                { color: colors.nbMuted },
                step === stepNumber && { color: '#FFFFFF' }
              ]}>
                {stepNumber}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* userId={null} = nobody signed in, so the provider serves logged-out defaults. */}
      <ProPlanSetup userId={null}>
        <NewUserSetupScreen
          key={`${role}-${step}`}
          role={role}
          previewMode
          previewInitialStep={step}
          onPreviewClose={onClose}
          onComplete={() => {}}
        />
      </ProPlanSetup>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  toolbarTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  toolbarHint: {
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
    borderRadius: 12,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
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
  },
  stepChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
