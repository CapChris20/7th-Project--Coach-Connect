// Design Law Privacy and data rights — export / policy / AI toggle / delete entry.
// Flow: Settings row → this screen → Privacy Policy / Contact / Delete hold sheet.
// Used by client + trainer shells. Account delete still runs through HoldToConfirmPopup.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteUser, getAuth, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { useAI } from '../for-both/app-wide-settings/AIPermission';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import NbCard from '../look-and-feel/NbCard';
import NbSwitch from '../look-and-feel/NbSwitch';
import HoldToConfirmPopup from '../for-both/popups/HoldToConfirmPopup';
import {
  SHELL_SAFE_AREA_EDGES,
  FORM_SCROLL_PROPS,
  useShellBottomNavInset,
} from '../navigation/bottomMenuSpacing';
import { functions } from '../app-start/cloudConnection';
import { APPLE_MANAGE_SUBSCRIPTIONS_URL } from '../trainer-pro-plan/proPlanSwitches';
import { nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET = 24;
const HOLD_TO_DELETE_MS = 1200;
const DELETE_ACCOUNT_URL =
  'https://us-central1-anatrox-auth.cloudfunctions.net/auth/deleteAccount';
const PRIVACY_UPDATED = 'May 9, 2026';

// ===== HELPER FUNCTIONS =====

/**
 * POST /auth/deleteAccount on the Cloud Function when the callable fails.
 * vocab: anatrox-auth = production Firebase project id (do not rename).
 */
async function callDeleteAccountEndpoint({ userId, idToken }) {
  const response = await fetch(DELETE_ACCOUNT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ userId }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.ok !== true) {
    throw new Error(json?.error || `Delete failed (${response.status})`);
  }
  return true;
}

function GroupDivider({ colors }) {
  return <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />;
}

function RightsLinkRow({ title, subtitle, trailing, onPress, colors, showDivider }) {
  return (
    <>
      {showDivider ? <GroupDivider colors={colors} /> : null}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={styles.row}
      >
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.nbInk }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.rowSub, { color: colors.nbMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? (
          <Text style={[styles.trailing, { color: colors.nbMuted }]}>{trailing}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />
      </TouchableOpacity>
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ onClose?: Function, onNavigate?: Function, embedShellBottomNav?: boolean }} props
 */
export default function PrivacyDataRightsScreen({
  onClose,
  onNavigate,
  embedShellBottomNav = false,
}) {
  const { colors } = useTheme();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const { aiEnabled, toggleAI } = useAI();
  const [showDeleteHoldModal, setShowDeleteHoldModal] = useState(false);
  const auth = getAuth();
  const user = auth.currentUser;

  const go = (screen) => {
    if (typeof onNavigate === 'function') onNavigate(screen);
  };

  async function performDeleteAccount() {
    if (!user) throw new Error('Not signed in. Please sign in again and retry.');
    try {
      try {
        const callable = httpsCallable(functions, 'deleteAccount');
        const response = await callable({});
        if (response?.data?.ok !== true) throw new Error('Delete failed');
      } catch (_callableError) {
        const idToken = await user.getIdToken(true);
        await callDeleteAccountEndpoint({ userId: user.uid, idToken });
      }
      try {
        await deleteUser(user);
      } catch (_ignored) {
        // backend already performed canonical deletion
      }
      await signOut(auth);
      Alert.alert('Account deleted', 'Your account and data have been permanently deleted.');
    } catch (error) {
      throw new Error(error?.message || 'Failed to delete account. Please try again.');
    }
  }

  const onExport = () => {
    Alert.alert(
      'Export my data',
      'Request a copy of your logs and plans through Contact support. We may ask you to verify your identity.',
      [
        { text: 'Contact support', onPress: () => go('contactSupport') },
        { text: 'Close', style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader title="Privacy and data rights" onBack={onClose} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: embedShellBottomNav ? shellNavInset : 40 },
        ]}
        {...FORM_SCROLL_PROPS}
      >
        <NbCard style={styles.infoCard}>
          <Text style={[styles.infoTitle, { color: colors.nbInk }]}>
            What you can do with your data
          </Text>
          <Text style={[styles.infoBody, { color: colors.nbMuted }]}>
            Ask for a copy, correct it, or delete it. Privacy questions or requests about your data
            go to Coach Connect support.
          </Text>
        </NbCard>

        <Text style={[styles.section, { color: colors.nbMuted }]}>YOUR DATA</Text>
        <NbCard style={styles.groupCard}>
          <RightsLinkRow
            title="Export my data"
            subtitle="A copy of your logs and plans."
            onPress={onExport}
            colors={colors}
          />
          <RightsLinkRow
            title="Privacy policy"
            trailing={PRIVACY_UPDATED}
            onPress={() => go('privacy')}
            colors={colors}
            showDivider
          />
        </NbCard>

        <Text style={[styles.section, { color: colors.nbMuted }]}>AI FEATURES</Text>
        <NbCard style={styles.groupCard}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.nbInk }]}>AI-powered features</Text>
              <Text style={[styles.rowSub, { color: colors.nbMuted }]}>
                Your answers are sent to the AI provider to personalize replies.
              </Text>
            </View>
            <NbSwitch value={!!aiEnabled} onValueChange={(enabled) => toggleAI(enabled)} />
          </View>
        </NbCard>

        <NbCard style={styles.deleteCard}>
          <TouchableOpacity
            onPress={() => setShowDeleteHoldModal(true)}
            disabled={!user}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            style={styles.deleteRow}
          >
            <Text style={[styles.deleteTitle, { color: colors.nbInk }]}>Delete account</Text>
            <Text style={[styles.deleteHint, { color: colors.nbMuted }]}>
              Permanently removes your data
            </Text>
          </TouchableOpacity>
        </NbCard>
      </ScrollView>

      <HoldToConfirmPopup
        visible={showDeleteHoldModal}
        onClose={() => setShowDeleteHoldModal(false)}
        title="Delete account?"
        message={
          'Your account and data will be permanently deleted. Press and hold the button to confirm.\n\n' +
          'Deleting your Coach Connect account does not cancel Coach Connect Pro. If you subscribe through Apple, manage or cancel in Settings → Apple ID → Subscriptions' +
          (Platform.OS === 'ios' ? ` (${APPLE_MANAGE_SUBSCRIPTIONS_URL}).` : '.')
        }
        holdDurationMs={HOLD_TO_DELETE_MS}
        pillLabel="Hold to confirm"
        onHoldComplete={performDeleteAccount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  infoCard: { padding: spacing.md, marginBottom: spacing.lg },
  infoTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    marginBottom: 6,
  },
  infoBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  groupCard: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: nb.minTouchTarget,
    gap: spacing.sm,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15 },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 2, lineHeight: 17 },
  trailing: { fontFamily: 'Inter_400Regular', fontSize: 13, marginRight: 4 },
  divider: { height: nb.borderWidthDivider, marginHorizontal: spacing.md },
  deleteCard: { padding: spacing.md, marginBottom: spacing.xl },
  deleteRow: { minHeight: nb.minTouchTarget, justifyContent: 'center' },
  deleteTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  deleteHint: { fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 4 },
});
