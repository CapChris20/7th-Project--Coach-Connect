/**
 * AppNavigationContext - Centralized navigation for CoachConnect header and bottom nav
 *
 * Apps (ClientApp, TrainerApp) provide handlers via the provider.
 * CoachConnectHeader and BottomNavBar consume this context, falling back to props when no provider.
 * This keeps navigation logic out of app files and in the shared components.
 */

import React, { createContext, useContext, useCallback, useRef, useState } from 'react';

const AppNavigationContext = createContext(null);

const noop = () => {};

export function AppNavigationProvider({ children, ...handlers }) {
  const value = {
    onProfilePress: handlers.onProfilePress ?? noop,
    onSettingsPress: handlers.onSettingsPress ?? noop,
    onHomePress: handlers.onHomePress ?? noop,
    onPlusPress: handlers.onPlusPress ?? noop,
    onVoicePress: handlers.onVoicePress ?? noop,
    onNutritionPress: handlers.onNutritionPress ?? noop,
    onWorkoutPress: handlers.onWorkoutPress ?? noop,
    onMessagesPress: handlers.onMessagesPress ?? noop,
  };

  return (
    <AppNavigationContext.Provider value={value}>
      {children}
    </AppNavigationContext.Provider>
  );
}

export function useAppNavigation() {
  return useContext(AppNavigationContext);
}

/**
 * Merge context handlers with props - props override when provided
 */
export function useMergedNavigation(props = {}) {
  const context = useAppNavigation();
  return {
    onProfilePress: props.onProfilePress ?? context?.onProfilePress ?? noop,
    onSettingsPress: props.onSettingsPress ?? context?.onSettingsPress ?? noop,
    onHomePress: props.onHomePress ?? context?.onHomePress ?? noop,
    onPlusPress: props.onPlusPress ?? context?.onPlusPress ?? noop,
    onVoicePress: props.onVoicePress ?? context?.onVoicePress ?? noop,
    onNutritionPress: props.onNutritionPress ?? context?.onNutritionPress ?? noop,
    onWorkoutPress: props.onWorkoutPress ?? context?.onWorkoutPress ?? noop,
    onMessagesPress: props.onMessagesPress ?? context?.onMessagesPress ?? noop,
  };
}
