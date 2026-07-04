/**
 * linking
 *
 * Purpose: linking — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/navigation
 * Key exports: clientLinking, trainerLinking
 *
 * @file-header
 */
import { CLIENT_ROUTES, TRAINER_ROUTES } from './routes';

/** Deep linking stub — expand when universal links are configured. */
export const clientLinking = {
  prefixes: ['coachconnect://'],
  config: {
    screens: {
      [CLIENT_ROUTES.MainTabs]: {
        screens: {
          [CLIENT_ROUTES.Home]: 'home',
          [CLIENT_ROUTES.Dashboard]: 'dashboard',
          [CLIENT_ROUTES.Files]: 'files',
          [CLIENT_ROUTES.Nutrition]: 'nutrition',
          [CLIENT_ROUTES.AI]: 'ai',
        },
      },
      [CLIENT_ROUTES.Profile]: 'profile',
      [CLIENT_ROUTES.Settings]: 'settings',
    },
  },
};

export const trainerLinking = {
  prefixes: ['coachconnect://trainer'],
  config: {
    screens: {
      [TRAINER_ROUTES.Main]: 'hub',
      [TRAINER_ROUTES.Profile]: 'profile',
      [TRAINER_ROUTES.Settings]: 'settings',
    },
  },
};
