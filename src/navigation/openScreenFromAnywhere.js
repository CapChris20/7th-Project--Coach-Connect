// A global handle on the navigator so non-screen code can move the app around.
// Flow: NavigationContainer attaches itself to rootNavigationRef → these helpers check "is it ready?" → then navigate/back/reset.
// Used by things that live outside React screens (push-notification taps, auth listeners, deep-link handlers).
// Key exports: rootNavigationRef, rootNavigate, rootGoBack, rootResetTo

import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

// vocab: createNavigationContainerRef = React Navigation's way to control the navigator from outside a screen.
// Inside a screen you'd use the useNavigation() hook; this ref is the escape hatch for everything else.
export const rootNavigationRef = createNavigationContainerRef();

// Go to a screen by route name. Every helper below guards on isReady() because this module can be
// called before the navigator has mounted (e.g. a notification opening the app from cold start) —
// calling navigate() too early throws, so we silently no-op instead of crashing the launch.
// vocab: params = the data bag handed to the destination screen (route.params over there)
export function rootNavigate(name, params) {
  if (rootNavigationRef.isReady()) {
    rootNavigationRef.navigate(name, params);
  }
}

// Back button behavior for outside-of-React callers.
// canGoBack() matters: popping an empty history stack is an error, and on the very first screen
// there is nothing behind us — so we check before we pop.
export function rootGoBack() {
  if (rootNavigationRef.isReady() && rootNavigationRef.canGoBack()) {
    rootNavigationRef.goBack();
  }
}

// Hard replace of the whole history with a single screen — no back arrow, nothing to return to.
// This is the sign-in/sign-out move: after logging out you must not be able to swipe back into the app.
export function rootResetTo(name) {
  if (!rootNavigationRef.isReady()) return;
  rootNavigationRef.dispatch(
    // vocab: CommonActions.reset = throw away the current navigation state and install a new one
    CommonActions.reset({
      // Manipulate here: index is which route in the array below is the active one.
      // index 0 + a one-item screenNames array = "this screen is the entire stack".
      index: 0,
      screenNames: [{ name }],
    }),
  );
}
