# Coach Connect design system (neobrutalist, gradient-led)

Source of truth for the **look and feel** of the redesign. Visual reference: `docs/design/mockups/index.html` (open in a browser, 43 screens, light and dark toggle).

## How to use the mockup: style AND a better structure
The mockup shows the visual language (outlines, shadows, gradients, type, spacing, components) and the kind of layout the owner wants: fewer, clearer sections, content grouped by task, cards placed differently from the old screens.
- Redesign each screen's layout. Do not just re-skin the old arrangement of cards.
- Keep the screen's behavior, data, props, hooks and navigation exactly as they are. Only the arrangement and look change.
- Every feature the old screen had must still be reachable. Remove clutter, not capability.
- Work one screen per change. Never batch many screens.

## Tokens (add to `src/look-and-feel/colorPalette.js`, keep existing exports and key names)

| Token | Light | Dark |
|---|---|---|
| background | `#F3EEFF` | `#0A0A0F` |
| surface (cards) | `#FFFFFF` | `#17171F` |
| surfaceChip | `#FFFFFF` | `#1F1F2A` |
| ink (text) | `#0A0A0F` | `#F3EEFF` |
| muted text | `#55506B` | `#A7A1BE` |
| border | `#0A0A0F` | `#F3EEFF` |
| hard shadow color | `#0A0A0F` | `#6B3AD9` |

Border width 2.5. Shadow: offset 4/4, radius 0, opacity 1 (iOS `shadowRadius: 0`; Android uses a duplicated offset View because elevation can't do hard shadows). Radii: chips 12, cards 14, hero 18, sheets 20, phone-level 34.

### Gradients (`expo-linear-gradient`, 115deg, start `{x:0,y:0}` end `{x:1,y:1}`)
- `brand`: `#FF6B9D` to `#FB923C`. Primary buttons, plus button, active chips, progress rings, avatars. Text on it is always `#0A0A0F`.
- `ink`: `#6B3AD9` to `#BE185D`. Secondary buttons, selected segments, selected checkboxes. Text on it is white.
- `title`: `#BE185D` to `#C2410C` in light, `#FF6B9D` to `#FB923C` in dark. Hero titles only (masked text).
- `water`: `#67E8F9` to `#60A5FA`. `sleep`: `#E9D5FF` to `#A78BFA`. `energy`: `#BBF7D0` to `#5EEAD4`. Status tiles, option icons, pills. Text `#0A0A0F`.
- `soft`: `#FFF1F7` to `#EDE4FF`. Selected option rows, lottie frames, sheet cards. Text `#0A0A0F`.
- Never a solid accent fill. Never gradient on card borders, body text, or inactive icons.

### Type
Space Grotesk 700 for titles, labels, numbers (tabular nums). Inter 400/500/600 for body. Scale: title 24 (28 on onboarding), card title 18, body 15, helper 13, label 12 uppercase with 0.1em tracking. Never below 12.

## Components to build once in `src/look-and-feel/` and reuse everywhere
`NbCard`, `NbButton` (brand | ink | plain, sm), `NbChip` and `NbChipRow` (single/multi, horizontal scroll variant), `NbSegmented`, `NbOptionRow` (icon, title, sub, checkbox) and grid variant, `NbTile` (gradient status tile), `NbListRow`, `NbSwitch`, `NbHero`, `NbPill`, `NbAvatar`, `NbSheet`, `NbProgressSteps`, `NbRing`, `NbBottomNav`, `NbScreen` (status area, scroll body, sticky CTA). No screen hand-rolls these.

Pressed state: translate 3,3 and shadow to 0. Disabled: 45% opacity plus visible outline (never a faded blank rectangle). Touch targets 44 minimum. Chips and buttons: min 16 horizontal padding, single line, never clipped.

## Rules (what makes it look vibe-coded, so we avoid it)
1. One gradient moment per screen. 2. No gradient borders. 3. No cards inside cards. 4. No repeated identical empty-state cards, use one list. 5. No emoji as icons. 6. One illustration family (the recolored lotties). 7. No text under 12. 8. No gray-on-gray. 9. Radius follows role, not one value. 10. Left-align text, center only empty states and splash. 11. No glow or blur decoration. 12. No accent stripes on rounded cards. 13. Specific copy ("No workout planned"), not slogans. 14. Empty states say what to do next. 15. Disabled buttons look intentional. 16. 44pt targets. 17. Spacing on a 4/8 scale only. 18. No fake data presented as real. 19. Motion only for state change (press, selection, ring fill, scroll-in rise). 20. Respect reduced motion.

## Scroll motion
Cards below the first screen rise 22px and fade in as they enter (Reanimated, ease-out 300ms). Ring and bars animate once on mount. Nothing loops except lottie illustrations (paused when reduced motion is on).

## Keep as they are (do not redesign)
- Icons in `src/assets/icons` and the gradient nav icons: keep the glyphs, restyle only the container around them.
- Account and profile data fields and the existing card content the owner names. TODO: owner to list the exact cards before step 4.

## Replace
- `src/trainer-app/scheduling/WheelPicker.jsx` and `SessionTimePicker.jsx`: delete the wheel. New scheduler = week-strip date chips, time-slot chips (3 columns), segmented length (30/45/60/90), segmented where (In person/Video), notes field, sticky CTA with live summary ("Book Mon, Nov 9 · 9:00 AM · 60 min").

## Screen map (mockup tab to code)
- Onboarding: `src/for-both/setup-steps`, `src/login-and-signup/NewUserSetupScreen.jsx`
- Client app: `src/client-app/home`, `files-and-notes`, `profile`, `workout-plans`, `src/workouts`
- Nutrition and coach: `src/nutrition`, `src/client-app/meals`, `src/ai-coach`
- Trainer: `src/trainer-app/home`, `my-trainees`, `trainee-detail`, `scheduling`, `documents`, `new-requests`
- Auth and marketplace: `src/login-and-signup`, `src/client-app/find-a-trainer`, `src/for-both/trainer-listing`

## Process for Cursor
1. Read this file and open the mockup. 2. Implement tokens and the shared components first, with no screen changes. 3. Port one screen at a time, in this order: scheduler, client home, onboarding, find-a-trainer, nutrition, AI coach, trainer screens. 4. After each screen run the existing tests and `npm run lint`, and compare the styling (not the layout) against the matching mockup board in light and dark. 5. Keep behavior, data and navigation unchanged. Layout is redesigned per screen.
