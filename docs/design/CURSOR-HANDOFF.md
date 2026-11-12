# Handing this to Cursor

## What Cursor needs

1. **The mockups** (`mockups/*.html`). Open them in a browser. They need an internet connection for the animation libraries. Each page has a Light / Dark / Both switch. Cursor cannot look at a browser, so give it the mapping and the design system as text, and tell it which mockup to open for each task.
2. **`DESIGN-SYSTEM.md`**: the tokens, shapes, type, components and the native notes.
3. **`MAPPING.md`**: for each mockup screen, the existing repo files to change.
4. **The rules file** (`cursor-rules/coach-connect-design.mdc`): copy it to `.cursor/rules/` in the repo so every Cursor chat sees it.
5. **The assets** (`assets/icons`, `assets/lottie`). The recolored Lottie files replace or sit next to the ones in `src/assets/animations`.
6. **The repo's own `CODING_STYLE.md`.** The repo requires every rewritten file to follow it (plain names, a numbered main function). Say "Follow CODING_STYLE.md (Variation 3)" in each request.

## Do the skills and repos need to be installed or cloned?

No. The skills and reference repos installed on this Mac (`apple-design`, `impeccable`, `ui-ux-pro-max`, the Expo, animation and React Native skills, and others) are Claude Code skills. Cursor does not load Claude Code skills. They are not needed to implement these designs. All the rules that matter are already written into `DESIGN-SYSTEM.md`.

If you want Cursor to have reading material, clone the reference repos into a `docs/refs/` folder outside `src` and tell Cursor to read them when asked. Expo's docs and Reanimated's docs are the most useful. Cursor can also read documentation sites when you give it a link. I am less sure of Cursor's exact features than of Claude Code's, so check Cursor's own documentation for how rules and doc references are loaded in your version.

## What the app already has

The app already includes everything the designs need: `react-native-reanimated` 4, `react-native-gesture-handler`, `expo-linear-gradient`, `lottie-react-native`, `react-native-svg`, `expo-haptics`, `expo-blur`, `react-native-safe-area-context`, `expo-camera`, `expo-image-picker` and `react-native-webview`. Nothing new needs installing for the design. A drag-to-reorder list (the plan builder) would need a new package or a custom gesture.

`src/look-and-feel/` already has `Nb*` components (`NbButton`, `NbCard`, `NbChip`, `NbSegmented`, `NbSheet`, `NbSwitch`, `NbTile`, `NbRing`, `NbBottomNav` and more) from an earlier neo-brutalist pass. The plan is to restyle these to `DESIGN-SYSTEM.md`, then build screens from them.

## Conflicts to settle before starting

- **`docs/design/DESIGN.md` says the opposite of the new look.** It says to keep the cool gradient borders and old color system. The mockups use black, white and gray with gradients only as small accents. The owner needs to confirm the new system, then replace `DESIGN.md` with `DESIGN-SYSTEM.md`.
- **Fonts.** The brief says system fonts. The repo loads Space Grotesk in places.
- **The three commits** on branch `claude/cool-planck-5qbxar` (kit tokens, a hook extraction, a new home layout) were made earlier without being asked. Decide whether to revert them before building on the `look-and-feel` folder.
- **Navigation bar.** `BottomMenuBar.js` and `NbBottomNav.jsx` both exist. Pick one place for the new bar.
- **Guessed content.** The + sheet items, the Pro price and trial length, the AI-step bullets, best times in trainer availability, the Map view, and all sample data are placeholders (see captions).

## Suggested order of work

1. Tokens: one theme file with the values in section 2 to 5 of `DESIGN-SYSTEM.md`, light and dark.
2. Primitives: restyle the `Nb*` components, then add the missing ones (icon chip, bar, field, slider, stepper, toast, skeleton, empty state, hard shadow wrapper).
3. Navigation bar and screen shell.
4. One pilot flow on its own branch, for example Client dashboard. Run it on the iOS simulator and an Android device, and fix what the native notes in section 9 predict (shadows, dashed borders, gradient icons).
5. Roll out the other flows in the order of `MAPPING.md`, one pull request per flow.
6. Add the states: empty, loading, error, offline.

## How to ask Cursor, per screen

> Implement the "Trainer home" mockup (`mockups/trainer-home.html`, screens 1 to 3). Files to change are listed under "Trainer home" in `MAPPING.md`. Follow `DESIGN-SYSTEM.md` and `CODING_STYLE.md` (Variation 3). Keep the screen's data and behavior. Do not invent copy: use the text in the mockup only where the mockup caption says it comes from the app.

## What Cursor cannot do for you

- It cannot tell whether a screen "looks right". Compare against the mockup in a browser and on a device.
- The mockups are web pages. They do not prove that any effect works on a phone.
- A few screens are new (for example session mode). `MAPPING.md` marks them.
