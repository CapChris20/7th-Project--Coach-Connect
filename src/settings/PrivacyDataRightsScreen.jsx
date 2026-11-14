// Privacy and data rights — export request, policy link, AI toggle, delete account.
// Flow: Settings row → this screen → Privacy Policy / Contact / hold-to-delete sheet.
// Used by client and trainer shells. Delete still runs through HoldToConfirmPopup.

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
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
// Manipulate here: hold duration (ms) before delete runs
const HOLD_TO_DELETE_MS = 1200;
// vocab: anatrox-auth = production Firebase project id (do not rename to Coach Connect)
const DELETE_ACCOUNT_URL =
  'https://us-central1-anatrox-auth.cloudfunctions.net/auth/deleteAccount';
const PRIVACY_UPDATED = 'May 9, 2026';
const SCROLL_PAD_WITHOUT_SHELL = 40;
const DELETE_CALLABLE_NAME = 'deleteAccount';

// ===== HELPER FUNCTIONS =====

function PrivacyRowDivider({ colors }) {
  return <View style={[privacyStyles.divider, { backgroundColor: colors.nbBorder }]} />;
}

/**
 * Tappable settings row with optional subtitle / trailing date and chevron.
 */
function PrivacyRightsLinkRow({ title, subtitle, trailing, onPress, colors, showDivider }) {
  return (
    <>
      {showDivider ? <PrivacyRowDivider colors={colors} /> : null}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={privacyStyles.row}
      >
        <View style={privacyStyles.rowText}>
          <Text style={[privacyStyles.rowTitle, { color: colors.nbInk }]}>{title}</Text>
          {subtitle ? (
            <Text style={[privacyStyles.rowSub, { color: colors.nbMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? (
          <Text style={[privacyStyles.trailing, { color: colors.nbMuted }]}>{trailing}</Text>
        ) : null}
        <Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />
      </TouchableOpacity>
    </>
  );
}

/**
 * Intro card explaining what the user can do with their data.
 */
function PrivacyIntroCard({ colors }) {
  return (
    <NbCard style={privacyStyles.infoCard}>
      <Text style={[privacyStyles.infoTitle, { color: colors.nbInk }]}>
        What you can do with your data
      </Text>
      <Text style={[privacyStyles.infoBody, { color: colors.nbMuted }]}>
        Ask for a copy, correct it, or delete it. Privacy questions or requests about your data
        go to Coach Connect support.
      </Text>
    </NbCard>
  );
}

/**
 * Export + Privacy policy rows.
 */
function YourDataSection({ colors, onExportPress, onPrivacyPress }) {
  return (
    <>
      <Text style={[privacyStyles.section, { color: colors.nbMuted }]}>YOUR DATA</Text>
      <NbCard style={privacyStyles.groupCard}>
        <PrivacyRightsLinkRow
          title="Export my data"
          subtitle="A copy of your logs and plans."
          onPress={onExportPress}
          colors={colors}
        />
        <PrivacyRightsLinkRow
          title="Privacy policy"
          trailing={PRIVACY_UPDATED}
          onPress={onPrivacyPress}
          colors={colors}
          showDivider
        />
      </NbCard>
    </>
  );
}

/**
 * AI-powered features switch — persists through useAI.
 */
function AiFeaturesSection({ colors, isAiOn, onAiToggle }) {
  return (
    <>
      <Text style={[privacyStyles.section, { color: colors.nbMuted }]}>AI FEATURES</Text>
      <NbCard style={privacyStyles.groupCard}>
        <View style={privacyStyles.row}>
          <View style={privacyStyles.rowText}>
            <Text style={[privacyStyles.rowTitle, { color: colors.nbInk }]}>
              AI-powered features
            </Text>
            <Text style={[privacyStyles.rowSub, { color: colors.nbMuted }]}>
              Your answers are sent to the AI provider to personalize replies.
            </Text>
          </View>
          <NbSwitch value={isAiOn} onValueChange={onAiToggle} />
        </View>
      </NbCard>
    </>
  );
}

/**
 * Opens the hold-to-confirm delete sheet (disabled when signed out).
 */
function DeleteAccountCard({ colors, signedInUser, onOpenDeleteHold }) {
  const deleteIsDisabled = !signedInUser;

  return (
    <NbCard style={privacyStyles.deleteCard}>
      <TouchableOpacity
        onPress={onOpenDeleteHold}
        disabled={deleteIsDisabled}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        style={privacyStyles.deleteRow}
      >
        <Text style={[privacyStyles.deleteTitle, { color: colors.nbInk }]}>Delete account</Text>
        <Text style={[privacyStyles.deleteHint, { color: colors.nbMuted }]}>
          Permanently removes your data
        </Text>
      </TouchableOpacity>
    </NbCard>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Privacy and data rights settings screen.
 * @param {{ onClose?: Function, onNavigate?: Function, embedShellBottomNav?: boolean }} props
 */
export default function PrivacyDataRightsScreen({
  onClose,
  onNavigate,
  embedShellBottomNav = false,
}) {
  // vocab: useTheme = Design Law light/dark tokens
  const { colors } = useTheme();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  // vocab: useAI = app-wide AI permission flag (persisted)
  const { aiEnabled, toggleAI } = useAI();
  const [showDeleteHoldModal, setShowDeleteHoldModal] = useState(false);
  const [notice, setNotice] = useState(null);

  // vocab: getAuth = Firebase Auth instance (projectId stays anatrox-auth)
  const firebaseAuth = getAuth();
  const signedInUser = firebaseAuth.currentUser;

  const showNoticeSheet = (title, message, extras = {}) => {
    setNotice({ title, message, ...extras });
  };

  const navigateToScreen = (screenKey) => {
    if (typeof onNavigate !== 'function') {
      return;
    }
    onNavigate(screenKey);
  };

  /**
   * Wipe the account on the server, then quiet Auth cleanup + sign out.
   * Flow: 1. need user  2. server delete  3. Auth delete  4. sign out  5. notice
   */
  async function performDeleteAccount() {
    // 1. Refuse if the session already ended.
    if (!signedInUser) {
      throw new Error('Not signed in. Please sign in again and retry.');
    }

    try {
      // 2. Callable first; HTTP fallback if the callable fails.
      await deleteAccountOnServer(signedInUser);

      // 3. Local Auth user may already be gone after backend delete — ignore that error.
      try {
        await deleteUser(signedInUser);
      } catch (_authDeleteSkipped) {
        // backend already performed canonical deletion
      }

      // 4. Clear the local session so the app returns to signed-out chrome.
      await signOut(firebaseAuth);

      // 5. Confirm to the user that deletion finished.
      showNoticeSheet('Account deleted', 'Your account and data have been permanently deleted.');
    } catch (error) {
      const message = error?.message || 'Failed to delete account. Please try again.';
      throw new Error(message);
    }
  }

  const handleExportDataPress = () => {
    showNoticeSheet(
      'Export my data',
      'Request a copy of your logs and plans through Contact support. We may ask you to verify your identity.',
      {
        cancelLabel: 'Close',
        confirmLabel: 'Contact support',
        onConfirm: () => navigateToScreen('contactSupport'),
      },
    );
  };

  const handleOpenPrivacyPolicy = () => {
    navigateToScreen('privacy');
  };

  const handleAiToggle = (enabled) => {
    toggleAI(enabled);
  };

  const handleOpenDeleteHold = () => {
    setShowDeleteHoldModal(true);
  };

  const handleCloseDeleteHold = () => {
    setShowDeleteHoldModal(false);
  };

  const handleCloseNotice = () => {
    setNotice(null);
  };

  let scrollBottomPadding = SCROLL_PAD_WITHOUT_SHELL;
  if (embedShellBottomNav) {
    scrollBottomPadding = shellNavInset;
  }

  const deleteHoldMessage = buildDeleteHoldMessage();
  const isAiOn = !!aiEnabled;
  const noticeIsVisible = !!notice;
  const noticeTitle = notice?.title || '';
  const noticeConfirmLabel = notice?.confirmLabel || 'OK';

  return (
    <SafeAreaView
      style={[privacyStyles.root, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader title="Privacy and data rights" onBack={onClose} />
      <ScrollView
        contentContainerStyle={[privacyStyles.scroll, { paddingBottom: scrollBottomPadding }]}
        {...FORM_SCROLL_PROPS}
      >
        <PrivacyIntroCard colors={colors} />
        <YourDataSection
          colors={colors}
          onExportPress={handleExportDataPress}
          onPrivacyPress={handleOpenPrivacyPolicy}
        />
        <AiFeaturesSection colors={colors} isAiOn={isAiOn} onAiToggle={handleAiToggle} />
        <DeleteAccountCard
          colors={colors}
          signedInUser={signedInUser}
          onOpenDeleteHold={handleOpenDeleteHold}
        />
      </ScrollView>

      <HoldToConfirmPopup
        visible={showDeleteHoldModal}
        onClose={handleCloseDeleteHold}
        title="Delete account?"
        message={deleteHoldMessage}
        holdDurationMs={HOLD_TO_DELETE_MS}
        pillLabel="Hold to confirm"
        onHoldComplete={performDeleteAccount}
      />
      <NbNoticeSheet
        visible={noticeIsVisible}
        onClose={handleCloseNotice}
        title={noticeTitle}
        message={notice?.message}
        confirmLabel={noticeConfirmLabel}
        cancelLabel={notice?.cancelLabel}
        onConfirm={notice?.onConfirm}
      />
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Hold-sheet copy; iOS appends the Apple subscriptions URL.
 */
function buildDeleteHoldMessage() {
  let deleteHoldMessage =
    'Your account and data will be permanently deleted. Press and hold the button to confirm.\n\n' +
    'Deleting your Coach Connect account does not cancel Coach Connect Pro. If you subscribe through Apple, manage or cancel in Settings → Apple ID → Subscriptions';

  if (Platform.OS === 'ios') {
    deleteHoldMessage += ` (${APPLE_MANAGE_SUBSCRIPTIONS_URL}).`;
    return deleteHoldMessage;
  }

  deleteHoldMessage += '.';
  return deleteHoldMessage;
}

/**
 * POST /auth/deleteAccount when the Firebase callable fails.
 * vocab: anatrox-auth = production Firebase project id (do not rename).
 */
async function deleteAccountThroughHttpEndpoint({ userId, idToken }) {
  const response = await fetch(DELETE_ACCOUNT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ userId }),
  });
  const responseJson = await response.json().catch(() => ({}));
  const serverOk = response.ok && responseJson?.ok === true;
  if (!serverOk) {
    const errorMessage = responseJson?.error || `Delete failed (${response.status})`;
    throw new Error(errorMessage);
  }
  return true;
}

async function tryDeleteAccountCallable() {
  // vocab: httpsCallable = Firebase Functions client wrapper for deleteAccount
  const deleteCallable = httpsCallable(functions, DELETE_CALLABLE_NAME);
  const callableResponse = await deleteCallable({});
  if (callableResponse?.data?.ok !== true) {
    throw new Error('Delete failed');
  }
}

/**
 * Prefer callable; on failure refresh the id token and hit the HTTP endpoint.
 */
async function deleteAccountOnServer(signedInUser) {
  try {
    await tryDeleteAccountCallable();
    return;
  } catch (_callableFailed) {
    const freshIdToken = await signedInUser.getIdToken(true);
    await deleteAccountThroughHttpEndpoint({
      userId: signedInUser.uid,
      idToken: freshIdToken,
    });
  }
}

const privacyStyles = StyleSheet.create({
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
