import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Visual height of BottomNavBar (excludes home-indicator inset). */
export const BOTTOM_NAV_BAR_HEIGHT = 80;

/** Space to reserve when a parent shell renders the floating bottom nav (hideBottomNav on child). */
export function useShellBottomNavInset(extra = 12) {
  const insets = useSafeAreaInsets();
  return BOTTOM_NAV_BAR_HEIGHT + insets.bottom + extra;
}
