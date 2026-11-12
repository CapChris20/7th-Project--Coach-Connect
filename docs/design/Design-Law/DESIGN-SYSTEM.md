# Coach Connect design system (neo-brutalist, black, white and gray)

This file is the contract for the new look. The mockups in `mockups/` show it in use. Where this file and the mockups disagree, fix the file.

**Important:** the repo's current `docs/design/DESIGN.md` describes a different look (cool gradient borders, keep the old gradients). This system replaces it. The owner must confirm before `DESIGN.md` is overwritten.

## 1. Rules (from the owner)

1. Thick solid outlines (3px), hard offset shadows with no blur, bold type, flat blocks.
2. Primary colors are black, white and gray. Anything big stays black, white or gray.
3. Gradients are small accents only: pills, avatars, icon chips, progress bars, rings, slider fills, the + button and the nav icons. Never on cards, big blocks or backgrounds.
4. Never green. Never a solid purple border or shadow. Do not lean on orange-to-pink (the nav bar and + button are the one place that gold-to-pink is used, on purpose).
5. Use the owner's real icon art and Lottie files. Do not invent generic icons when one fits.
6. 44px minimum touch targets. Text never below 12px. Chips and buttons are single-line with 16px side padding.
7. Light and dark are both designed, not inverted.
8. System fonts in the app. (Note: the repo already loads Space Grotesk in a few places. Decide once: system font everywhere, or keep Space Grotesk for numbers and headings.)

## 2. Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F2F2F0` | `#0B0B0B` | screen background |
| `surface` (`sf`) | `#FFFFFF` | `#161616` | cards, inputs, sheets |
| `chip` | `#FFFFFF` | `#1F1F1F` | unselected chips, tracks |
| `soft` | `#E3E3DF` | `#262626` | notes, hatched fills, disabled-looking-but-not |
| `ink` | `#0A0A0A` | `#F2F2F2` | text |
| `muted` | `#575757` | `#A6A6A6` | secondary text (contrast checked) |
| `border` (`bd`) | `#0A0A0A` | `#F2F2F2` | every outline |
| `shadow` (`sh`) | `#0A0A0A` | `#8A8A8A` | hard offset shadows |
| `fill` (`blk`) | `#0A0A0A` | `#F2F2F2` | primary buttons, selected states, active nav, hero blocks |
| `onFill` (`on`) | `#FFFFFF` | `#0A0A0A` | text and icons on `fill` |

Selected and primary elements are solid `fill` (black in light, white in dark) with `onFill` text.

### Gradient accents (11 pairs, 135 degrees)

`#FF6B9D→#FB923C`, `#FBBF24→#EF4444`, `#A78BFA→#E879F9`, `#60A5FA→#818CF8`, `#FDE047→#FB923C`, `#FDA4AF→#FB7185`, `#7DD3FC→#A78BFA`, `#FB7185→#FBBF24`, `#FDBA74→#C4B5FD`, `#A78BFA→#FB7185`, `#FCD34D→#F472B6`.

Rotate them per element (stride of 3 in the mockup kit so neighbors differ). Text on a gradient is always `#0A0A0A`, in both themes. Nav icons and the + button use `#FCD34D→#F472B6`.

## 3. Shape tokens

| Token | Value |
|---|---|
| border width | 3px (dividers 2px, pills 2.5px, emphasis 4px) |
| dashed border | empty, pending and drop-zone states |
| radius: phone | 36 |
| radius: card | 10, with corner accents on some cards: `6 24 6 6`, `10 26 10 10`, `10 10 10 26` (vary by role, never all the same) |
| radius: button | 10 |
| radius: chip, pill | 999 (small tags: 6) |
| radius: input | 8 |
| radius: icon chip | 12 (large 14) |
| radius: sheet | 24 top corners |
| radius: avatar, + button | 50% |
| hard shadow | `x y 0 shadowColor`: hero 6, card 5, button 4, small 3. No blur, no spread. |

## 4. Type (system font)

| Role | Size / weight / tracking |
|---|---|
| Wordmark poster | 58–62 / 900 / -2 to -3 |
| Screen title (h1) | 25 / 900 / -0.6 (hero variant 34) |
| Section title (h2) | 19–21 / 900 / -0.3 |
| Body | 15 / 400–700 / line height 1.42 |
| Small | 13 / 600 |
| Label (all caps) | 12 / 900 / +1.3 letter spacing |
| Numbers | 900, negative tracking, tabular figures (`fontVariant: ['tabular-nums']`) |
| Minimum anywhere | 12 |

## 5. Spacing

4 · 8 · 10 · 12 · 14 · 16 · 24 · 28. Screen side gutter 16. Space between blocks 16. Card padding 14. Dense pages (videos, report) use 24–28 between sections. Bottom padding 120 above the nav bar.

## 6. Components (what to build or restyle) and the existing component to change

The repo already has `Nb*` components in `src/look-and-feel/`. Restyle those to this spec instead of creating new ones.

| Mockup component | Spec | Existing file |
|---|---|---|
| Button | fill black, 3px border, shadow 4, min height 50, 16/900 text, icon + label gap 10. Ghost = surface fill. Small = 44 tall, auto width. Pressed: scale .95 then spring back. Loading: spinner + present-tense word, same size. | `NbButton.jsx` |
| Chip | 44 tall, 999 radius, 3px border. Selected = fill + onFill + shadow 3 + check. | `NbChip.jsx`, `NbChipRow.jsx` |
| Tile | chip with icon chip, label, optional small description; radius 10; check top right. | `NbTile.jsx` |
| Segmented | 3px border, 44 tall, selected cell = fill. Scrolls horizontally when long. | `NbSegmented.jsx` |
| Switch | 56 × 34, knob 22. On = fill. | `NbSwitch.jsx` |
| Card | surface, 3px border, shadow 5, padding 14. Variants: flat (no shadow), black (fill), dashed (empty), corner accent. | `NbCard.jsx` |
| Pill | 26 tall, 2.5px border, gradient fill, 12/900 text `#0A0A0A`. Neutral pill = soft fill. | `NbPill.jsx` |
| Avatar | 44 circle, 3px border, gradient, initials 15/900. | `NbAvatar.jsx` |
| Icon chip | 44 square, radius 12, gradient, owner icon art 28px inside. | (new, small) |
| Progress bar | 16 tall, 3px border, gradient fill with a 3px right edge. | (new) |
| Ring | stroke 12–14, track = soft, fill = fill color or gradient, number in the middle. | `NbRing.jsx` |
| Stepper | 44 buttons, number 30–44/900. | (new) |
| Slider | track 18, knob 40 black with grip lines, fill gradient. | (new) |
| Sheet | bottom sheet, radius 24 top, grab bar, scrim 50%, slide up with a slight overshoot. | `NbSheet.jsx` |
| Drawer | left drawer 84% wide, radius 24 right side. | (new) |
| Field | 48+ tall, 3px border, label 12 caps above. Error = dashed border + line with a "!" circle and a plain sentence. | (new) |
| Toast | surface or black, 3px, shadow 4, action button inside. | (new) |
| Banner | black or outlined card with one action. | (new) |
| Skeleton | hatched soft fill, same layout as the real screen, soft pulse (no shimmer). | (new) |
| Empty state | dashed card, large icon chip, h1, one sentence, one or two buttons. | (new) |
| Screen shell | status area, scroll area, optional bottom bar | `NbScreen.jsx` |
| Hero block | black block with big type and a Lottie | `NbHero.jsx` |
| List row | 56–64 tall, 2px dividers | `NbListRow.jsx`, `NbOptionRow.jsx` |
| Steps | chapter bar, 3 segments | `NbProgressSteps.jsx` |
| Bottom bar | see section 7 | `NbBottomNav.jsx` and `src/navigation/BottomMenuBar.js` |

States every interactive component needs: default, pressed, selected, error, loading, empty. Dark mode follows tokens, no separate art.

## 7. Bottom navigation bar

Flat bar, full width, 3px top border, surface fill. Five slots with labels always visible (12/800): Home, Workout (icon larger), the + button in the middle, Files (or AI Coach in the AI layout), Nutrition. The active tab gets a soft chip (border + shadow 3) behind the icon only — never covering the label — and a bold label. Icons stay the nav accent gradient in both states (~30px, Workout ~34). The + button is a ~58 circle with gradient fill, a 3px border and a hard shadow, seated mostly inside the bar with only a small overhang (~8px) above the top border — not a high floating FAB. The + opens an Add sheet. The sheet's contents are a guess; confirm them.

## 8. Motion (the mockups use GSAP; the app uses Reanimated 4)

| Mockup | App equivalent |
|---|---|
| Staggered entrance (y 16, fade, 55ms stagger, 0.5s, power3.out) | `FadeInDown.delay(index * 55).duration(500)` layout animations |
| Count-up numbers | shared value + `withTiming`, `useAnimatedReaction` to set text |
| Filling bars and rings | `withTiming` on width or `strokeDashoffset` (animated props with react-native-svg) |
| Press feedback (scale .95, spring back) | `withSpring` on a scale shared value |
| Pop on select | `withSequence(withTiming(.86), withSpring(1))` |
| Sheet slide up with slight overshoot | translateY with `withSpring` (damping about 14) |
| Drag, swipe to clear, compare slider | `Gesture.Pan()` from gesture-handler plus shared values |
| Lottie | `lottie-react-native` with the recolored JSON files |
| Reduced motion | `useReducedMotion()`: skip entrances and loops |

## 9. Native build notes (not yet tested on a device)

- **Hard shadows.** iOS: `shadowOffset`, `shadowOpacity: 1`, `shadowRadius: 0`, `shadowColor`. Android cannot do an unblurred offset shadow with `elevation`. Draw the shadow as a sibling `View` behind the card, offset by the shadow size, with the same radius and the shadow color. Wrap it once in a `HardShadow` component.
- **Dashed borders.** `borderStyle: 'dashed'` is unreliable with rounded corners on Android. Use an SVG rect when it looks wrong.
- **Gradients.** `expo-linear-gradient` for pills, bars, avatars, the + button. For gradient strokes on icons, use `react-native-svg` with a `linearGradient`. Use `userSpaceOnUse` coordinates, because a straight line has no bounding box.
- **Hatched fills** (skeleton, photo placeholder, viewfinder) are an SVG pattern.
- **Charts** are plain `react-native-svg` (lines, bars, rings), drawn to scale from the data.
- **Sticky headers and tab bars** use `stickyHeaderIndices` or a header outside the scroll view.
- **Large text.** Test with the largest system text size. Rows wrap; do not set fixed heights on text.
- **Safe areas.** `react-native-safe-area-context` is installed; the bottom bar needs the bottom inset.
- **Keyboard.** Forms and the coach composer must move above the keyboard.

## 10. Assets

- Icons: `assets/icons/*.png` in this zip (resized to 96px). Originals are in `src/assets/icons` and `src/assets/icons/New Icons`. Names used: hydration, sleeping, stress, energy, scales, picture, people, workout, schedule, progress, protein, carbs, fats, week, injury, height, journey, dumbbell(s), checkin, settings, muscle, gym, beginner, inter, adv, age, bands, pullup, body, banned, trash, supp, male, female, other, pns.
- Lottie: `assets/lottie/*.json`, with green and teal shifted toward orchid. Originals are in `src/assets/animations`. Recolor again with the script in `build-sources/prep.py` if a file changes.
- Nav icons (home, dumbbell, sparkles, file, fork) are drawn SVG paths in `build-sources/kit.py` (`NV`).

## 11. Content rules

- Specific copy. Say what happens. Errors say what went wrong and what to do.
- All names, numbers, dates, prices, foods and example sentences in the mockups are sample data.
- Wording not taken from the app is listed in each mockup caption. Search captions for "my wording", "my addition" and "placeholder".
- No emoji as icons. No text under 12px.
