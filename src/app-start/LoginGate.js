// The traffic cop between "app just launched" and "user is looking at their app".
// Flow: listen to Firebase auth → no user? show login/reset → user? load their profile (Firestore → retry → local cache → safe default)
//       → onboarding unfinished? show the wizard → otherwise route to TrainerAppStart or ClientAppStart by role.
// Rendered once at the top of the tree; everything else in the app mounts underneath whatever this picks.

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { ProPlanSetup } from '../trainer-pro-plan/ProPlanSetup';
import { useStartupLoadingCoverLock } from '../for-both/loading-and-header/StartupLoadingCover';
import { auth, db } from './cloudConnection';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeErrorSync } from '../crash-reports/sendSavedErrors';
import { clearOldSharedChats } from '../ai-coach/past-chats/savedChatShape';
import { clearAllUserData } from '../logout-cleanup/clearDataOnLogout';
import { flushPendingOnboardingSync } from '../for-both/online-connection/uploadSetupAnswers';
import { clearPushTokensForUid } from '../notifications/manageAlerts';
import { loadMyProfile } from '../for-both/cloud-database/loadMyProfile';
import {
  getProfileCacheKey,
  isLikelyNewFirebaseUser,
  normalizeAppRole,
  profileNeedsOnboarding,
} from '../login-and-signup/decideTraineeOrTrainer';
import { handleAuthUidTransition } from '../login-and-signup/signOutCleanupSteps';
import { fillTraineeProfile } from '../helpers/fillTraineeProfile';

// vocab: React.lazy = don't load this file's code until something actually renders it.
// Why it matters here: each of these drags in heavy native modules (Reanimated, Lottie, OAuth SDKs).
// Importing them normally would run all that code during cold start, before the first pixel — which
// is exactly the delay users read as "the app is slow to open". A user only ever needs one of these.
const LoginScreen = React.lazy(() => import('../login-and-signup/LoginScreen'));
const ResetPasswordScreen = React.lazy(() => import('../login-and-signup/ForgotPasswordFlow'));
const NewUserSetupScreen = React.lazy(() => import('../login-and-signup/NewUserSetupScreen'));
const TrainerAppStart = React.lazy(() => import('./TrainerAppStart'));
const ClientAppStart = React.lazy(() => import('./ClientAppStart'));

// What shows while a lazy chunk is still downloading/parsing.
// It's a plain dark rectangle, not a spinner, on purpose: the app's single boot overlay is already
// on screen, and the lock below keeps it there. A second loader here would flash a competing spinner.
function AuthBootFallback() {
  useStartupLoadingCoverLock(true);
  // Manipulate here: #0A0A0A must match the boot overlay's background or you'll see a color flicker.
  return <View style={{ flex: 1, backgroundColor: '#0A0A0A' }} />;
}

// Wrapper used around every lazy screen below so they all share one loading behavior.
// vocab: Suspense = React's "show `fallback` until the lazy child inside is ready" boundary.
function AuthScreenSuspense({ children }) {
  return (
    <Suspense fallback={<AuthBootFallback />}>
      {/* flex: 1 = fill the parent. Needed because the lazy screens expect a full-height parent. */}
      <View style={{ flex: 1 }}>{children}</View>
    </Suspense>
  );
}

// Re-exported from here for history: these helpers used to live in this file, and tests plus older
// call sites still import them from LoginGate. The real implementations are in src/auth/.
export { normalizeAppRole, profileNeedsOnboarding, isLikelyNewFirebaseUser };
export { handleAuthUidTransition } from '../login-and-signup/signOutCleanupSteps';

// Reconciles "what the server thinks" with "what this device knows".
// Why it exists: a user can finish onboarding while the API is down or they're offline. The wizard
// always writes locally first, so Firestore can legitimately be behind. Trusting Firestore alone
// would shove someone who just finished right back into the wizard.
// Keys read: `onboarding_data_${uid}` (full payload the wizard wrote) and `auth_profile_${uid}` (this gate's cache).
async function mergeLocalOnboardingTruth(uid, firestoreProfile) {
  if (!uid || !firestoreProfile || typeof firestoreProfile !== 'object') {
    return firestoreProfile;
  }
  let cached = null;
  try {
    // Order matters: the wizard's own payload is the richer, more recent record, so check it first
    // and stop at the first key that yields a usable object.
    const keys = [`onboarding_data_${uid}`, getProfileCacheKey(uid)];
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          cached = parsed;
          break;
        }
      } catch {
        // Corrupt JSON from an interrupted write — skip this key rather than failing the whole boot.
        continue;
      }
    }
  } catch (_) {
    /* ignore */
  }
  // Nothing cached → server copy is all we have, and that's fine.
  if (!cached) return firestoreProfile;
  // Field-by-field merge (cached first, Firestore second) — the resolver decides which side wins per
  // field rather than blindly overwriting one whole profile with the other.
  return fillTraineeProfile(cached, firestoreProfile);
}

export default function LoginGate() {
  // The Firebase user object, or null when signed out. This is the top-level fork of the whole file.
  const [user, setUser] = useState(null);
  // True until Firebase has told us *anything*. Starts true because on launch we genuinely don't
  // know yet whether there's a saved session — showing the login screen during that gap would flash
  // login at users who are actually signed in.
  const [authLoading, setAuthLoading] = useState(true);
  // Forgot-password is a sibling of the login screen rather than a route, so it's a boolean here.
  const [showForgotPasswordFlow, setShowForgotPasswordFlow] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordFlowEmail] = useState('');
  // Whether to show the wizard...
  const [showOnboarding, setShowOnboarding] = useState(false);
  // ...and whether we've finished *deciding* that. Two separate flags because `false` means "no
  // onboarding needed" only once onboardingChecked is true — before that it just means "unknown".
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  // Startup side-work (error syncing) that must finish before we render a shell.
  const [keyLoaded, setKeyLoaded] = useState(false);
  // vocab: useRef = a mutable box that survives re-renders WITHOUT causing one when it changes.
  // Used for the previous uid because updating it must not trigger a render — it's bookkeeping for
  // the auth listener, not something the UI displays.
  const prevUidRef = useRef(null);

  // One boot overlay for the entire launch, owned by the shell. We only tell it when to stay up;
  // rendering our own loader here would stack a second spinner on top of it.
  // Two ways to still be booting: (a) signed out and Firebase hasn't answered, (b) signed in but the
  // profile/onboarding decision isn't done.
  const bootLocked = (!user && authLoading) || (!!user && (!keyLoaded || !onboardingChecked));
  useStartupLoadingCoverLock(bootLocked);

  // Startup side-work: wire up the crash/error reporter that ships errors to the server.
  // Runs once ([] deps) and independently of auth — errors during the login flow should be captured too.
  useEffect(() => {
    (async () => {
      try {
        await initializeErrorSync();
      } catch (e) {
        console.error('Failed to load API key:', e);
      } finally {
        // `finally`, not the try body: even if error syncing fails, boot must proceed. Leaving
        // keyLoaded false would hang the app on the overlay forever.
        setKeyLoaded(true);
      }
    })();
  }, []);

  // The heart of this file: Firebase's auth listener.
  useEffect(() => {
    // Firebase never initialized (missing config — see config.js). Drop the loading state so the
    // login screen at least renders instead of hanging on a black overlay.
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    // vocab: onAuthStateChanged = Firebase calls this callback every time the session changes
    // (restored on launch, signed in, signed out, token refreshed) and returns an unsubscribe function.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const prevUid = prevUidRef.current;

      // FIRST, before any state update: if the identity changed, wipe the previous user's cached
      // data and push tokens off this device. Doing this before setUser is what stops account B
      // from briefly rendering with account A's cached profile.
      await handleAuthUidTransition(prevUid, firebaseUser, {
        clearPushTokensForUid,
        clearAllUserData,
      });

      // Remember who we just handled, so the next fire can detect a switch.
      if (firebaseUser?.uid) {
        prevUidRef.current = firebaseUser.uid;
      } else {
        prevUidRef.current = null;
      }

      // One-time migration: older builds stored AI chats in a shared bucket rather than per-user.
      // Swallowed on failure because a migration that can't run must never block sign-in.
      if (firebaseUser) {
        try {
          await clearOldSharedChats();
        } catch (e) {
          // Ignore errors - migration is optional
        }
      }

      setUser(firebaseUser);

      if (firebaseUser) {
        // Fire-and-forget retry of any onboarding save that never reached the server (offline, dev
        // API down). Not awaited on purpose — this must not delay showing the app.
        // vocab/symbol: .catch(() => {}) = swallow the rejection so an unhandled-promise warning
        // doesn't appear for something we intentionally don't care about.
        flushPendingOnboardingSync(firebaseUser).catch(() => {});

        // --- Profile bootstrap, attempt 1 of 4: Firestore with a timeout -------------------
        // We read Firestore directly instead of asking our backend `/api/me`, so a misconfigured or
        // down API can't break sign-in. The whole point of the next ~80 lines is that the user gets
        // INTO the app no matter which of these sources is available.
        try {
          if (db && firebaseUser?.uid) {
            const uid = firebaseUser.uid;
            // vocab: doc(db, 'users', uid) = a pointer to the document users/{uid}; getDoc fetches it.
            const profileRef = doc(db, 'users', uid);
            // vocab: Promise.race = whichever promise settles first wins. Paired with a timer that
            // REJECTS, this is the standard "give up after N ms" pattern — Firestore has no built-in
            // timeout and can hang indefinitely on a bad connection, which would freeze the splash.
            // Manipulate here: 7000ms is how long a user stares at the boot overlay in the worst
            // case before we fall through to the fallbacks below.
            const profileSnap = await Promise.race([
              getDoc(profileRef),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore profile timeout')), 7000)),
            ]);

            // vocab/symbol: profileSnap?.exists?.() = call exists() only if both the snapshot and
            // the method are there — the timeout path can hand us something that isn't a snapshot.
            if (profileSnap?.exists?.()) {
              let profile = { uid, ...(profileSnap.data() || {}) };
              // No role on the document = a half-created profile, so this attempt doesn't count as a
              // success; fall through to the retry below rather than routing someone wrongly.
              if (profile?.role) {
                // Let local "I finished onboarding" evidence override a lagging server copy.
                profile = await mergeLocalOnboardingTruth(uid, profile);
                setUserData(profile);
                setUserRole(profile.role);
                setShowOnboarding(profileNeedsOnboarding(profile));
                // Refresh the cache so the NEXT cold start can route instantly even offline.
                try {
                  await AsyncStorage.setItem(getProfileCacheKey(uid), JSON.stringify(profile));
                } catch (_) {}
                // These two flags are what release the boot overlay.
                setAuthLoading(false);
                setOnboardingChecked(true);
                // Early return = "we're done, skip every fallback below". Each attempt ends this way.
                return;
              }
            }
          }
        } catch (firestoreBootstrapError) {
          // Swallowed on purpose: a failure here is not fatal, it just means we try the next source.
          console.warn('Firestore-first auth bootstrap failed:', firestoreBootstrapError?.message || firestoreBootstrapError);
        }

        // --- Attempt 2 of 4: the same Firestore read, but no timeout ----------------------
        // Why bother? The first attempt may have lost the race on a slow-but-working connection.
        // Firestore also warms its connection on the first call, so this retry often succeeds fast.
        try {
          if (db && firebaseUser?.uid) {
            const uid = firebaseUser.uid;
            const retrySnap = await getDoc(doc(db, 'users', uid));
            if (retrySnap?.exists?.()) {
              let profile = { uid, ...(retrySnap.data() || {}) };
              if (profile?.role) {
                profile = await mergeLocalOnboardingTruth(uid, profile);
                setUserData(profile);
                setUserRole(profile.role);
                setShowOnboarding(profileNeedsOnboarding(profile));
                try {
                  await AsyncStorage.setItem(getProfileCacheKey(uid), JSON.stringify(profile));
                } catch (_) {}
                setAuthLoading(false);
                setOnboardingChecked(true);
                return;
              }
            }
          }
        } catch (retryError) {
          console.warn('Firestore retry bootstrap failed:', retryError?.message || retryError);
        }

        // --- Attempt 3 of 4: whatever this device cached ----------------------------------
        // This is the offline path. It's why a returning user with no signal still lands in the
        // right shell instead of being defaulted to client.
        try {
          const uid = firebaseUser?.uid;
          if (uid) {
            // Two caches, best first: the gate's own profile snapshot, then the wizard's raw payload.
            const candidates = [
              await AsyncStorage.getItem(getProfileCacheKey(uid)),
              await AsyncStorage.getItem(`onboarding_data_${uid}`),
            ];
            for (const cachedRaw of candidates) {
              if (!cachedRaw) continue;
              const cached = JSON.parse(cachedRaw);
              // A cached entry with no role can't answer the only question that matters here
              // (which shell?), so skip to the next candidate.
              const cachedRole = cached?.role || null;
              if (!cachedRole) continue;
              const profile = { uid, ...(cached || {}) };
              setUserData(profile);
              setUserRole(cachedRole);
              setShowOnboarding(profileNeedsOnboarding(profile));
              setAuthLoading(false);
              setOnboardingChecked(true);
              return;
            }
          }
        } catch (cacheError) {
          console.warn('AsyncStorage bootstrap fallback failed:', cacheError?.message || cacheError);
        }

        // --- Attempt 4 of 4: give up and assume something safe ----------------------------
        // Reached only when Firestore AND the cache told us nothing. The rule is "never leave a
        // signed-in user staring at a black screen", so we pick defaults that are recoverable:
        // 'client' because a client wrongly shown trainer tools is a security problem, while a
        // trainer briefly in the client shell is only an annoyance (fixed on the next good read).
        const uid = firebaseUser?.uid || null;
        // Brand-new accounts legitimately have no profile yet, so they get the wizard; an older
        // account with an unreadable profile is assumed done, so we don't re-onboard a real user.
        const likelyNew = isLikelyNewFirebaseUser(firebaseUser);
        setUserData(
          uid
            ? { uid, role: 'client', onboardingCompleted: likelyNew ? false : true }
            : null
        );
        setUserRole('client');
        setShowOnboarding(likelyNew);
        setAuthLoading(false);
        setOnboardingChecked(true);
        return;
      } else {
        // Signed out: drop role and wizard state before the render below swaps in the login screen.
        setUserRole(null);
        setShowOnboarding(false);
      }

      // Signed-out path only (every signed-in branch returned above). Releases the boot overlay so
      // the login screen can appear.
      setAuthLoading(false);
      setOnboardingChecked(true);

      // Full reset of anything that could leak into the next session's first render.
      // Note onboardingChecked goes back to FALSE here even though it was just set true: once we're
      // signed out there is no user to have checked, and the next sign-in must re-decide from scratch.
      if (!firebaseUser) {
        setShowOnboarding(false);
        setOnboardingChecked(false);
        setUserRole(null);
        setUserData(null);
      }
    });

    // Cleanup: detach the Firebase listener when LoginGate unmounts, or it keeps firing into a dead
    // component. Empty deps [] = subscribe once for the app's lifetime.
    return () => unsubscribe();
  }, []);

  // --- Render: a top-to-bottom chain of "which screen wins?" -------------------------------
  // Order is the routing logic. Each `if` that returns claims the screen, so earlier checks
  // outrank later ones: loading > forgot-password > login > boot wait > onboarding > role shell.

  // Signed out.
  if (!user) {
    // Firebase hasn't answered yet. Blank dark screen (the boot overlay is on top of it) rather than
    // the login form — flashing login at an already-signed-in user is the bug this prevents.
    if (authLoading) {
      return <View style={{ flex: 1, backgroundColor: '#0A0A0A' }} />;
    }
    // Forgot-password takes over the whole screen instead of layering over login.
    if (showForgotPasswordFlow) {
      return (
        <AuthScreenSuspense>
          <ResetPasswordScreen
          // Carried over from the login form so they don't retype the email they just typed.
          initialEmail={forgotPasswordEmail}
          // Fake navigation object: this screen was written for React Navigation, but here it's just
          // a boolean-toggled view. Both navigate and goBack mean the same thing in this context —
          // "close me and go back to login" — so both clear the flag and the prefilled email.
          navigation={{
            navigate: () => {
              setShowForgotPasswordFlow(false);
              setForgotPasswordFlowEmail('');
            },
            goBack: () => {
              setShowForgotPasswordFlow(false);
              setForgotPasswordFlowEmail('');
            },
          }}
        />
        </AuthScreenSuspense>
      );
    }
    return (
      <AuthScreenSuspense>
        <LoginScreen
        // Fresh signup: we already know everything we need, so set state directly rather than
        // waiting for the auth listener. This is a head start, not a replacement — onAuthStateChanged
        // still fires and reconciles right after.
        onSignupSuccess={(userData, role) => {
          setUser(userData);
          const r = normalizeAppRole(role);
          setUserRole(r);
          setShowOnboarding(true); // New users always go to onboarding
          // Cache the picked role immediately: the server hasn't written `role` to the user doc yet,
          // so without this a reload mid-onboarding would default a new trainer into client flow.
          if (userData?.uid) {
            AsyncStorage.setItem(
              getProfileCacheKey(userData.uid),
              JSON.stringify({ uid: userData.uid, role: r, onboardingCompleted: false })
            ).catch(() => {});
          }
        }}
        // Returning user: read their profile eagerly so we can route without a visible gap between
        // "logged in" and "shell appears".
        onLoginSuccess={async (userData) => {
          setUser(userData);
          if (!userData?.uid || !db) return;
          try {
            const snap = await getDoc(doc(db, 'users', userData.uid));
            // No profile document. For a brand-new account (Google/Apple first sign-in) that's
            // expected — the doc hasn't been created yet — so send them to onboarding. For an
            // existing account it's a transient read problem, so we do nothing and let the auth
            // listener's four-attempt bootstrap handle it properly.
            if (!snap.exists()) {
              const likelyNew = isLikelyNewFirebaseUser(userData);
              if (likelyNew) {
                setUserRole('client');
                setShowOnboarding(true);
                setOnboardingChecked(true);
              }
              return;
            }
            const profile = { uid: userData.uid, ...(snap.data() || {}) };
            if (profile.role) {
              setUserData(profile);
              setUserRole(profile.role);
              setShowOnboarding(profileNeedsOnboarding(profile));
              setOnboardingChecked(true);
            }
          } catch (_) {
            // Silent by design: this whole handler is an optimization. onAuthStateChanged will
            // reconcile, so a failure here costs a moment of loading, not correctness.
          }
        }}
        // Login passes up whatever email was already typed so the reset form starts prefilled.
        onForgotPasswordFlowPress={(prefillEmail) => {
          setForgotPasswordFlowEmail(String(prefillEmail || '').trim());
          setShowForgotPasswordFlow(true);
        }}
      />
      </AuthScreenSuspense>
    );
  }

  // Signed in, but we don't yet know the role or whether onboarding is owed. Render nothing behind
  // the boot overlay — picking a shell now would mean guessing, and a wrong guess shows the user
  // the wrong app for a second before it swaps.
  if (!keyLoaded || !onboardingChecked) {
    return <View style={{ flex: 1, backgroundColor: '#0A0A0A' }} />;
  }

  // Onboarding outranks both shells: an unfinished profile can't safely render the real app.
  if (showOnboarding) {
    return (
      // The wizard can show subscription/paywall steps, so it needs this provider around it.
      <ProPlanSetup userId={user?.uid || null}>
        <AuthScreenSuspense>
          <NewUserSetupScreen
          role={normalizeAppRole(userRole)}
          // Called when the wizard finishes. The wizard already saved to Firestore/API itself
          // (see finishSetup.js); this handler's job is to update THIS component so the next
          // render drops the wizard and mounts the right shell.
          onComplete={(chosenRole, updateData) => {
            // Role can change inside the wizard (they pick client vs trainer there), so take the
            // wizard's answer over whatever we came in with.
            if (chosenRole) setUserRole(normalizeAppRole(chosenRole));
            if (updateData) setUserData(updateData);
            // Write the completed profile to cache immediately. Without this, a cold start before
            // Firestore catches up would read a stale "not onboarded" cache and replay the wizard.
            if (user?.uid && chosenRole) {
              const r = normalizeAppRole(chosenRole);
              AsyncStorage.setItem(
                getProfileCacheKey(user.uid),
                JSON.stringify({
                  uid: user.uid,
                  // Spread first so the three authoritative fields below can't be overwritten by
                  // whatever updateData happens to contain.
                  ...(updateData || {}),
                  role: r,
                  onboardingCompleted: true,
                })
              ).catch(() => {});
            }
            // Last line on purpose: this is the switch that unmounts the wizard, so everything
            // above must already be set or the shell renders with stale role/profile for a frame.
            setShowOnboarding(false);
          }}
        />
        </AuthScreenSuspense>
      </ProPlanSetup>
    );
  }

  // Fully authenticated and onboarded — pick a shell.
  // Trainer is an explicit opt-in: only the exact normalized value 'trainer' gets trainer tools.
  if (normalizeAppRole(userRole) === 'trainer') {
    return (
      <AuthScreenSuspense>
        <TrainerAppStart user={user} />
      </AuthScreenSuspense>
    );
  }

  // Lets ClientAppStart ask us to re-read the profile from the server. Needed because things change
  // underneath us — most notably trainerId, when a client links to a trainer after launch and the
  // shell needs the fresh value without a full app restart.
  const refetchUserData = async () => {
    try {
      if (!user?.uid) return;
      const payload = await loadMyProfile(user);
      if (payload) setUserData(payload);
    } catch (e) {
      console.error('refetchUserData:', e);
    }
  };

  // Client is the catch-all: unknown or missing role lands here, matching the bootstrap fallback above.
  // The spread-then-override guarantees `role` is always a clean normalized value, even if the cached
  // profile carries something like 'Client ' with stray casing/whitespace.
  const clientPayload =
    userData && typeof userData === 'object'
      ? { ...userData, role: normalizeAppRole(userData.role ?? userRole) }
      // No profile at all — hand over the bare minimum so the shell can still mount and fetch.
      : { uid: user?.uid, role: 'client' };
  return (
    <AuthScreenSuspense>
      <ClientAppStart user={user} userData={clientPayload} onRefetchUserData={refetchUserData} />
    </AuthScreenSuspense>
  );
}
