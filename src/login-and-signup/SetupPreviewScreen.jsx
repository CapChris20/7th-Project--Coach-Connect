// Dev-only gallery for eyeballing every onboarding screen without creating an account.
// Flow: pick a role chip and a step number → those choices are handed to the real NewUserSetupScreen in preview mode.
// Opened from the dev menu; nothing here ships to users, and no onboarding data is ever saved.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from '../trainer-pro-plan/proPlanSwitches';
import { ProPlanSetup } from '../trainer-pro-plan/ProPlanSetup';
import NewUserSetupScreen from './NewUserSetupScreen';

// ===== NAMED CONSTANTS =====

const ROLE_CLIENT = 'client';
const ROLE_TRAINER = 'trainer';
const PREVIEW_ROLES = [ROLE_CLIENT, ROLE_TRAINER];
const CLIENT_STEP_COUNT = 9;
const TRAINER_STEP_COUNT = 8;
const FIRST_STEP = 1;
const PREVIEW_BACKGROUND = '#0A0A0F';

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

  const [role, setRole] = useState(ROLE_CLIENT);
  const [step, setStep] = useState(FIRST_STEP);

  const totalSteps = stepCountForRole(role);

  return (
    <View style={{ flex: 1, backgroundColor: PREVIEW_BACKGROUND }}>
      {/* Dev toolbar sits above the wizard and pads itself past the notch. */}
      <View style={[styles.toolbar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.toolbarRow}>
          <Text style={styles.toolbarTitle}>Onboarding preview</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>Close</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.toolbarHint}>No signup — tap a step to jump</Text>

        <View style={styles.roleRow}>
          {PREVIEW_ROLES.map((previewRole) => (
            <TouchableOpacity
              key={previewRole}
              onPress={() => {
                // Reset to step 1: trainer onboarding has fewer steps, so staying on 9 would miss.
                setRole(previewRole);
                setStep(FIRST_STEP);
              }}
              style={[styles.roleChip, role === previewRole && styles.roleChipOn]}
            >
              <Text style={[styles.roleChipText, role === previewRole && styles.roleChipTextOn]}>
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
              style={[styles.stepChip, step === stepNumber && styles.stepChipOn]}
            >
              <Text style={[styles.stepChipText, step === stepNumber && styles.stepChipTextOn]}>
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
