// A handle on the root navigator for code that is not inside a React screen.
// Flow: navigation container attaches rootNavigationRef → helpers wait until ready → then they move.
// Used by: notification taps, auth listeners, and deep links.
// Read order: constants → exported recipes → readiness PLUMBING.

import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

// ===== NAMED CONSTANTS =====

// Manipulate here: index 0 with one route means that screen is the whole stack (no back arrow).
const RESET_STACK_INDEX = 0;

// vocab: createNavigationContainerRef = control navigation from outside a React screen tree
const rootNavigationRef = createNavigationContainerRef();

// ===== HELPER FUNCTIONS =====
// (readiness check lives under PLUMBING)

// ===== MAIN FUNCTION =====

/**
 * Navigate to a named screen from outside the tree (notifications, auth, deep links).
 * Cold start can call this before the container mounts — we no-op instead of throwing.
 * @param {string} screenName
 * @param {object} [screenParams]
 */
export function rootNavigate(screenName, screenParams) {
  // 1. Refuse until the navigation container is attached and ready.
  if (!navigatorIsAttachedAndReady()) return;

  // 2. Forward the frozen route name + params shape to React Navigation.
  rootNavigationRef.navigate(screenName, screenParams);
}

/**
 * Pop one screen when the stack has somewhere to go back to.
 */
export function rootGoBack() {
  // 1. Refuse until the navigator is ready.
  if (!navigatorIsAttachedAndReady()) return;

  // 2. Nothing under this screen → stay put (no empty goBack).
  const stackHasPreviousScreen = rootNavigationRef.canGoBack();
  if (!stackHasPreviousScreen) return;

  // 3. Pop one level.
  rootNavigationRef.goBack();
}

/**
 * Throw away the current stack and install a single route (e.g. after sign-in).
 * @param {string} screenName
 */
export function rootResetTo(screenName) {
  // 1. Refuse until the navigator is ready.
  if (!navigatorIsAttachedAndReady()) return;

  // 2. Dispatch a reset so the named screen is the only route on the stack.
  // vocab: CommonActions.reset = replace the whole stack with the routes we pass in
  const resetToSingleScreen = CommonActions.reset({
    index: RESET_STACK_INDEX,
    routes: [{ name: screenName }],
  });
  rootNavigationRef.dispatch(resetToSingleScreen);
}

export { rootNavigationRef };

// ===== PLUMBING — skip unless debugging =====

/**
 * True when the navigation container has mounted and accepted the ref.
 * @returns {boolean}
 */
function navigatorIsAttachedAndReady() {
  return rootNavigationRef.isReady();
}
