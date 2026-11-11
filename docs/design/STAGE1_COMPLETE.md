# Stage 1 Complete: Neobrutalist Design System Foundation

## Summary

Stage 1 has been successfully completed. All neobrutalist design tokens and shared components have been implemented with zero linting errors. The design system is now ready to be used across the app.

## What Was Added

### 1. Design Tokens (`src/look-and-feel/colorPalette.js`)

**Neobrutalist Color Tokens:**
- `nbBackground` - Screen background color (light: #F3EEFF, dark: #0A0A0F)
- `nbSurface` - Card/surface color (light: #FFFFFF, dark: #17171F)
- `nbSurfaceChip` - Chip background (light: #FFFFFF, dark: #1F1F2A)
- `nbInk` - Primary text color (light: #0A0A0F, dark: #F3EEFF)
- `nbMuted` - Secondary text (light: #55506B, dark: #A7A1BE)
- `nbBorder` - Border color (light: #0A0A0F, dark: #F3EEFF)
- `nbShadow` - Shadow color (light: #0A0A0F, dark: #6B3AD9)

**Gradients (expo-linear-gradient):**
- `brand` - Primary gradient (#FF6B9D → #FB923C) - buttons, active states, rings
- `ink` - Secondary gradient (#6B3AD9 → #BE185D) - selected segments, checkboxes
- `title` - Hero title gradient (theme-specific)
- `water`, `sleep`, `energy` - Status tile gradients
- `soft` - Subtle background gradient (#FFF1F7 → #EDE4FF)

**Neobrutalist Design Constants:**
- Border width: 2.5px
- Hard shadow offset: 4px/4px, no blur
- Minimum touch target: 44px
- Chip/button padding: 16px horizontal

**Border Radii by Role:**
- Chip: 12px
- Card: 14px
- Hero: 18px
- Sheet: 20px
- Phone: 34px

### 2. Shared Components (all in `src/look-and-feel/`)

#### Layout Components
- **NbScreen** - Screen wrapper with safe area, scroll body, optional sticky footer
- **NbCard** - Card container with thick border and hard shadow
- **NbSheet** - Bottom sheet modal with optional gradient background

#### Buttons & Controls
- **NbButton** - Three variants: `brand` (gradient), `ink` (gradient), `plain` (outlined)
  - Press animation: translate 3,3 and shadow collapse
  - Sizes: default (44px) and `sm` (36px)
- **NbChip** - Single chip with optional gradient when selected
- **NbChipRow** - Horizontal scrolling chip row (single or multi-select)
- **NbSegmented** - Segmented control with ink gradient on selected segment
- **NbSwitch** - Toggle switch with brand gradient when on

#### Lists & Options
- **NbOptionRow** - List item with icon, title, subtitle, optional checkbox
- **NbOptionGrid** - 2-column grid layout for option rows
- **NbListRow** - Standard list row with title, subtitle, right accessory

#### Data Display
- **NbTile** - Gradient status tile for metrics (water/sleep/energy variants)
- **NbRing** - Circular progress ring with gradient stroke
- **NbProgressSteps** - Segmented progress bar for multi-step flows
- **NbPill** - Small badge with text (plain or gradient variants)
- **NbAvatar** - Circular avatar with image or initials on gradient

#### Navigation
- **NbBottomNav** - Bottom tab bar with gradient active state
- **NbHero** - Hero section with gradient-masked title text

### 3. Preview Screen

**Location:** `src/look-and-feel/NbComponentsPreview.jsx`

A comprehensive preview showing all components in the current theme (light/dark). Includes:
- All button variants and sizes
- Chip selection (single and multi)
- Segmented controls
- Cards with content
- Option rows and grids
- Status tiles
- List rows
- Switch toggle
- Pills in all variants
- Avatars in multiple sizes
- Progress ring
- Bottom navigation
- Bottom sheet example

### 4. Navigation Setup

The preview screen is accessible via:
- Route name: `ClientNbComponentsPreview`
- Helper function: `openNbPreview()` from `src/look-and-feel/openNbPreview.js`
- Console: `global.openNbPreview()` (when dev tools are open)

## Design Principles

All components follow these neobrutalist principles:

1. **One gradient moment per screen** - Brand gradient for primary actions only
2. **Thick outlines** - 2.5px borders on everything
3. **Hard shadows** - 4/4 offset with zero blur (iOS) or duplicated view (Android)
4. **Neutral surfaces** - White/dark cards, gradients only for accents
5. **Press feedback** - Translate 2-3px and collapse shadow
6. **Touch targets** - Minimum 44px for all interactive elements
7. **Single-line text** - Chips and buttons never wrap
8. **No text under 12px** - Accessibility minimum
9. **Light and dark** - All components support both themes

## Platform Handling

**iOS:** Uses `shadowRadius: 0` for hard shadows
**Android:** Renders a duplicate offset view as shadow because elevation can't do hard shadows

## What's Next

**Stage 2:** Replace the wheel scheduler with the new date chips and time-slot components (see `docs/design/DESIGN.md` and the "New session" board in `mockups/index.html`)

**Stage 3-9:** Apply the design system to all existing screens, one stage at a time:
- Client home and shell
- Onboarding flow
- Auth and marketplace
- Nutrition and AI coach
- Workouts
- Trainer app
- Final audit pass

## How to View the Preview

### Option 1: Navigate from code
```javascript
import { openNbPreview } from './src/look-and-feel/openNbPreview';
openNbPreview();
```

### Option 2: Dev console
Open React Native debugger and run:
```javascript
global.openNbPreview()
```

### Option 3: Add to Settings (optional)
Add a dev-only button in the Settings screen that calls `openNbPreview()`.

## Files Changed

### New Files (18)
- `src/look-and-feel/NbCard.jsx`
- `src/look-and-feel/NbButton.jsx`
- `src/look-and-feel/NbChip.jsx`
- `src/look-and-feel/NbChipRow.jsx`
- `src/look-and-feel/NbSegmented.jsx`
- `src/look-and-feel/NbOptionRow.jsx`
- `src/look-and-feel/NbTile.jsx`
- `src/look-and-feel/NbListRow.jsx`
- `src/look-and-feel/NbSwitch.jsx`
- `src/look-and-feel/NbHero.jsx`
- `src/look-and-feel/NbPill.jsx`
- `src/look-and-feel/NbAvatar.jsx`
- `src/look-and-feel/NbSheet.jsx`
- `src/look-and-feel/NbProgressSteps.jsx`
- `src/look-and-feel/NbRing.jsx`
- `src/look-and-feel/NbBottomNav.jsx`
- `src/look-and-feel/NbScreen.jsx`
- `src/look-and-feel/NbComponentsPreview.jsx`
- `src/look-and-feel/index.js` (barrel export)
- `src/look-and-feel/openNbPreview.js` (dev helper)

### Modified Files (2)
- `src/look-and-feel/colorPalette.js` - Added neobrutalist tokens and gradients
- `src/client-app/navigation/ClientScreenList.jsx` - Added preview route

### Documentation (3)
- `docs/design/DESIGN.md` (copied from redesign package)
- `docs/design/mockups/` (copied from redesign package)
- `.cursor/rules/redesign.mdc` (workspace rule)

## Lint Status

✅ Zero linting errors
✅ All components follow inline comment style requirements
✅ All components have file-top summaries
✅ All "vocab:" and "Manipulate here:" comments in place

## Dependencies

All required dependencies are already installed:
- ✅ `expo-linear-gradient` - For gradients
- ✅ `@react-native-masked-view/masked-view` - For gradient text masks
- ✅ `react-native-svg` - For progress rings
- ✅ Font packages - Space Grotesk (bold) and Inter (regular/medium)

## Testing

To verify Stage 1:
1. Start the app: `npm run start:dev`
2. Sign in as a client
3. Open the preview screen using one of the methods above
4. Toggle between light and dark mode
5. Test all interactive components (buttons, chips, switches, etc.)
6. Verify press animations work
7. Check that text never clips on narrow screens
8. Confirm all gradients render correctly

## Notes

- The wheel scheduler replacement (Stage 2) will be the first real structural change
- All other stages apply this visual system to existing screens without changing their logic
- The mockups in `docs/design/mockups/index.html` are for style reference only
- Keep the app's existing structure, features, and navigation intact
