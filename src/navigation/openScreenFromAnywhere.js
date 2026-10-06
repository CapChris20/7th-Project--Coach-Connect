// A handle on the navigator for code that is not inside a screen.
// Flow: the navigation container attaches rootNavigationRef → these helpers wait until it is ready → then they move.
// Used by: notification taps, auth listeners, and deep links.

import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

// ===== NAMED CONSTANTS =====

// Manipulate here: index 0 with one route means that screen is the whole stack. There is no back arrow.
const RESET_STACK_INDEX = 0;

// ===== HELPER FUNCTIONS =====

/**
 * Cold start can call these before the navigator exists. Navigating then throws.
 * @returns {boolean}
 */
function isNavigatorReady() {
  return rootNavigationRef.isReady();
}

// vocab: createNavigationContainerRef controls navigation from outside a screen.
const rootNavigationRef = createNavigationContainerRef();

// ===== MAIN FUNCTION =====

/**
 * @param {string} name
 * @param {object} [params]
 * @returns {void}
 */
export function rootNavigate(name, params) {
  if (!isNavigatorReady()) return;
  rootNavigationRef.navigate(name, params);
}

/**
 * Does nothing on the first screen, because there is nothing to pop.
 * @returns {void}
 */
export function rootGoBack() {
  if (!isNavigatorReady()) return;
  if (!rootNavigationRef.canGoBack()) return;
  rootNavigationRef.goBack();
}

/**
 * Replaces the whole history with one screen. Sign-out uses this so the user cannot swipe back in.
 * @param {string} name
 * @returns {void}
 */
export function rootResetTo(name) {
  if (!isNavigatorReady()) return;
  // vocab: CommonActions.reset throws away the current stack and installs a new one.
  rootNavigationRef.dispatch(
    CommonActions.reset({
      index: RESET_STACK_INDEX,
      routes: [{ name }],
    }),
  );
}

export { rootNavigationRef };
