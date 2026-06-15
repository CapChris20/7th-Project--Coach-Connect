/**
 * navigation Ref
 *
 * Purpose: navigation Ref — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/navigation
 * Key exports: rootNavigate, rootGoBack, rootResetTo, rootNavigationRef
 *
 * @file-header
 */
import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

export const rootNavigationRef = createNavigationContainerRef();

export function rootNavigate(name, params) {
  if (rootNavigationRef.isReady()) {
    rootNavigationRef.navigate(name, params);
  }
}

export function rootGoBack() {
  if (rootNavigationRef.isReady() && rootNavigationRef.canGoBack()) {
    rootNavigationRef.goBack();
  }
}

export function rootResetTo(name) {
  if (!rootNavigationRef.isReady()) return;
  rootNavigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name }],
    }),
  );
}
