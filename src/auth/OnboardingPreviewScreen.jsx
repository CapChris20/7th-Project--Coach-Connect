/**
 * Dev-only onboarding gallery — browse every client/trainer step without signing up.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from '../subscription/constants';
import { SubscriptionProvider } from '../subscription/SubscriptionProvider';
import OnboardingWizardScreen from './OnboardingWizardScreen';

export default function OnboardingPreviewScreen({ onClose }) {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState('client');
  const [step, setStep] = useState(1);
  const totalSteps = role === 'client' ? 9 : 8;

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <View style={[styles.toolbar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.toolbarRow}>
          <Text style={styles.toolbarTitle}>Onboarding preview</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>Close</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.toolbarHint}>No signup — tap a step to jump</Text>

        <View style={styles.roleRow}>
          {['client', 'trainer'].map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => {
                setRole(r);
                setStep(1);
              }}
              style={[styles.roleChip, role === r && styles.roleChipOn]}
            >
              <Text style={[styles.roleChipText, role === r && styles.roleChipTextOn]}>
                {r === 'client' ? 'Client' : 'Trainer'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepRow}>
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

      <SubscriptionProvider userId={null}>
        <OnboardingWizardScreen
          key={`${role}-${step}`}
          role={role}
          previewMode
          previewInitialStep={step}
          onPreviewClose={onClose}
          onComplete={() => {}}
        />
      </SubscriptionProvider>
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
