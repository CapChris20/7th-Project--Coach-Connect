// Deep-link maps: translate an incoming URL into a screen for each app shell.
// Flow: OS opens `coachconnect://dashboard` → prefix is stripped → the path is matched against `cloudConnection.screens` → that screen opens.
// Handed to NavigationContainer's `webLinks` prop by the client and trainer shells. Currently a stub — universal (https) links aren't wired yet.
// Key exports: clientLinking, trainerLinking

import { CLIENT_ROUTES, TRAINER_ROUTES } from './screenNames';

// vocab: deep link = a URL that opens a specific screen instead of just launching the app
// vocab: prefixes = the URL starts React Navigation will accept and strip before path matching.
//        'coachconnect://' is our custom URL scheme (declared in the native app cloudConnection — changing it
//        here alone will not work; the scheme must match what the OS registered).
// Manipulate here: add an https:// prefix here once universal/app links are set up on the domain.
export const clientLinking = {
  prefixes: ['coachconnect://'],
  cloudConnection: {
    // `screens` mirrors the navigator tree: nesting here must match how screens are actually nested,
    // otherwise the link resolves to nothing. A string value is the URL path; an object means
    // "this is a container, keep matching inside it".
    screens: {
      [CLIENT_ROUTES.MainTabs]: {
        // These five live inside the tab navigator, so their paths are nested under MainTabs.
        // Manipulate here: the right-hand strings are the URL paths users can be sent to,
        // e.g. coachconnect://nutrition lands on the Nutrition tab.
        screens: {
          [CLIENT_ROUTES.Home]: 'home',
          [CLIENT_ROUTES.Dashboard]: 'dashboard',
          [CLIENT_ROUTES.Files]: 'files',
          [CLIENT_ROUTES.Nutrition]: 'nutrition',
          [CLIENT_ROUTES.AI]: 'ai',
        },
      },
      // Top-level pushed screens — not tabs, so they sit beside MainTabs rather than inside it.
      [CLIENT_ROUTES.Profile]: 'profile',
      [CLIENT_ROUTES.Settings]: 'settings',
    },
  },
};

// Trainer shell gets its own prefix so the same path words ('profile', 'settings') can't collide with
// the client map above — the '/trainer' segment is what disambiguates which shell should handle the link.
export const trainerLinking = {
  prefixes: ['coachconnect://trainer'],
  cloudConnection: {
    screens: {
      [TRAINER_ROUTES.Main]: 'hub',
      [TRAINER_ROUTES.Profile]: 'profile',
      [TRAINER_ROUTES.Settings]: 'settings',
    },
  },
};
