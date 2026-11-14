// Deep-link maps: turn an incoming URL into a screen for each app shell.
// Flow: OS opens coachconnect://dashboard → strip the prefix → match the path to a screen name.
// Used by the client and trainer shells as React Navigation linking config.
// https universal links are not listed yet. Key exports: clientLinking, trainerLinking.

import { CLIENT_ROUTES, TRAINER_ROUTES } from './screenNames';

// ===== NAMED CONSTANTS =====

// vocab: deep link = a URL that opens a specific screen instead of only launching the app.
// The scheme must match what the OS registered. Changing the string here alone will not register a new scheme.
const CLIENT_LINK_PREFIX = 'coachconnect://';
const TRAINER_LINK_PREFIX = 'coachconnect://trainer';

// Manipulate here: path strings are what a link can open, e.g. coachconnect://nutrition.
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
 * @param {string[]} linkPrefixes
 * @param {object} screenMap
 * @returns {{ prefixes: string[], config: { screens: object } }}
 */
function buildLinkingConfig(linkPrefixes, screenMap) {
  const linkingConfig = {
    prefixes: linkPrefixes,
    config: {
      screens: screenMap,
    },
  };
  return linkingConfig;
}

/**
 * The five client tabs live inside MainTabs. Nesting must match the real navigator.
 * @returns {object}
 */
function buildClientTabPathMap() {
  const tabPathMap = {};
  tabPathMap[CLIENT_ROUTES.Home] = CLIENT_PATH_HOME;
  tabPathMap[CLIENT_ROUTES.Dashboard] = CLIENT_PATH_DASHBOARD;
  tabPathMap[CLIENT_ROUTES.Files] = CLIENT_PATH_FILES;
  tabPathMap[CLIENT_ROUTES.Nutrition] = CLIENT_PATH_NUTRITION;
  tabPathMap[CLIENT_ROUTES.AI] = CLIENT_PATH_AI;
  return tabPathMap;
}

/**
 * Client root: MainTabs (with nested tabs) plus Profile/Settings pushed beside the tabs.
 * @returns {object}
 */
function buildClientRootPathMap() {
  const tabContainer = {};
  tabContainer[CLIENT_ROUTES.MainTabs] = {
    screens: buildClientTabPathMap(),
  };

  const pushedBesideTabs = {};
  pushedBesideTabs[CLIENT_ROUTES.Profile] = CLIENT_PATH_PROFILE;
  pushedBesideTabs[CLIENT_ROUTES.Settings] = CLIENT_PATH_SETTINGS;

  return Object.assign({}, tabContainer, pushedBesideTabs);
}

/**
 * Trainer root: hub plus Profile/Settings. Prefix includes /trainer so the same
 * path words (profile, settings) cannot open the client shell.
 * @returns {object}
 */
function buildTrainerRootPathMap() {
  const trainerPathMap = {};
  trainerPathMap[TRAINER_ROUTES.Main] = TRAINER_PATH_HUB;
  trainerPathMap[TRAINER_ROUTES.Profile] = TRAINER_PATH_PROFILE;
  trainerPathMap[TRAINER_ROUTES.Settings] = TRAINER_PATH_SETTINGS;
  return trainerPathMap;
}

// ===== MAIN FUNCTION =====

// Client shell: coachconnect://… paths resolve through buildClientRootPathMap.
export const clientLinking = buildLinkingConfig(
  [CLIENT_LINK_PREFIX],
  buildClientRootPathMap(),
);

// Trainer shell: coachconnect://trainer… paths resolve through buildTrainerRootPathMap.
export const trainerLinking = buildLinkingConfig(
  [TRAINER_LINK_PREFIX],
  buildTrainerRootPathMap(),
);
