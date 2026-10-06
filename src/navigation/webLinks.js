// Deep-link maps: translate an incoming URL into a screen for each app shell.
// Flow: the OS opens coachconnect://dashboard → the prefix is stripped → the path is matched to a screen.
// Used by the client and trainer shells as the navigation linking config. https universal links are not listed yet.

import { CLIENT_ROUTES, TRAINER_ROUTES } from './screenNames';

// ===== NAMED CONSTANTS =====

// vocab: deep link = a URL that opens a specific screen instead of only launching the app.
// The scheme has to match what the OS registered. Changing the string here alone will not register a new scheme.
const CLIENT_LINK_PREFIX = 'coachconnect://';
const TRAINER_LINK_PREFIX = 'coachconnect://trainer';

const CLIENT_PATH_HOME = 'home';
const CLIENT_PATH_DASHBOARD = 'dashboard';
const CLIENT_PATH_FILES = 'files';
const CLIENT_PATH_NUTRITION = 'nutrition';
const CLIENT_PATH_AI = 'ai';
const CLIENT_PATH_PROFILE = 'profile';
const CLIENT_PATH_SETTINGS = 'settings';

const TRAINER_PATH_HUB = 'hub';
const TRAINER_PATH_PROFILE = 'profile';
const TRAINER_PATH_SETTINGS = 'settings';

// ===== HELPER FUNCTIONS =====

/**
 * React Navigation wants prefixes plus a screens map. Both shells share that shape.
 * A string screen value is the URL path. An object means "this is a container, keep matching inside it".
 * @param {string[]} prefixes
 * @param {object} screens
 * @returns {{ prefixes: string[], config: { screens: object } }}
 */
function linkingConfig(prefixes, screens) {
  return {
    prefixes,
    config: {
      screens,
    },
  };
}

// ===== MAIN FUNCTION =====

// Nesting here has to match the real navigator. A path that is not nested the same way resolves to nothing.
// These five live inside the tab navigator, so their paths sit under MainTabs.
// Manipulate here: the path strings are what a link can open, for example coachconnect://nutrition.
export const clientLinking = linkingConfig([CLIENT_LINK_PREFIX], {
  [CLIENT_ROUTES.MainTabs]: {
    screens: {
      [CLIENT_ROUTES.Home]: CLIENT_PATH_HOME,
      [CLIENT_ROUTES.Dashboard]: CLIENT_PATH_DASHBOARD,
      [CLIENT_ROUTES.Files]: CLIENT_PATH_FILES,
      [CLIENT_ROUTES.Nutrition]: CLIENT_PATH_NUTRITION,
      [CLIENT_ROUTES.AI]: CLIENT_PATH_AI,
    },
  },
  // Pushed screens sit beside MainTabs. They are not tabs.
  [CLIENT_ROUTES.Profile]: CLIENT_PATH_PROFILE,
  [CLIENT_ROUTES.Settings]: CLIENT_PATH_SETTINGS,
});

// The trainer prefix includes /trainer so the same words (profile, settings) cannot open the client shell.
export const trainerLinking = linkingConfig([TRAINER_LINK_PREFIX], {
  [TRAINER_ROUTES.Main]: TRAINER_PATH_HUB,
  [TRAINER_ROUTES.Profile]: TRAINER_PATH_PROFILE,
  [TRAINER_ROUTES.Settings]: TRAINER_PATH_SETTINGS,
});
