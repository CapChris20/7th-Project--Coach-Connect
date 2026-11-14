// Look-and-feel barrel — one import for palette tokens and every Nb* building block.
// Flow: tokens → chrome helpers → Nb components by job → dev gallery.
// Used by: screens that want a single `look-and-feel` import instead of deep paths.

// ===== NAMED CONSTANTS =====
// (barrel only re-exports — no runtime constants)

// ===== HELPER FUNCTIONS =====
// (barrel only re-exports — builders live in colorPalette / Nb* files)

// ===== MAIN FUNCTION =====
// Re-export map. Keys and paths are frozen for existing importers.

// ----- Palette tokens (colors, type, space, shadows, nb scale) -----
export {
  lightColors,
  darkColors,
  typography,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  nb,
  gradients,
} from './colorPalette';

// ----- Chrome helpers (hard offset shadow + gradient frame) -----
export { default as HardShadow } from './HardShadow';
export { default as GradientFrame } from './GradientFrame';

// ----- Nb: screen shell + hero -----
export { default as NbScreen } from './NbScreen';
export { default as NbHero } from './NbHero';

// ----- Nb: buttons, fields, switches, steppers -----
export { default as NbButton } from './NbButton';
export { default as NbField } from './NbField';
export { default as NbSwitch } from './NbSwitch';
export { default as NbStepper } from './NbStepper';
export { default as NbSlider } from './NbSlider';
export { default as NbSegmented } from './NbSegmented';

// ----- Nb: chips, pills, options, tiles -----
export { default as NbChip } from './NbChip';
export { default as NbChipRow } from './NbChipRow';
export { default as NbIconChip } from './NbIconChip';
export { default as NbPill } from './NbPill';
export { default as NbOptionRow, NbOptionGrid } from './NbOptionRow';
export { default as NbTile } from './NbTile';

// ----- Nb: cards, lists, avatars, empty -----
export { default as NbCard } from './NbCard';
export { default as NbListRow } from './NbListRow';
export { default as NbAvatar } from './NbAvatar';
export { default as NbEmptyState } from './NbEmptyState';

// ----- Nb: progress, ring, skeleton -----
export { default as NbProgressBar } from './NbProgressBar';
export { default as NbProgressSteps } from './NbProgressSteps';
export { default as NbRing } from './NbRing';
export { default as NbSkeleton, NbSkeletonMessageRow } from './NbSkeleton';

// ----- Nb: sheets, toast, notice -----
export { default as NbSheet } from './NbSheet';
export { default as NbNoticeSheet } from './NbNoticeSheet';
export { default as NbToast } from './NbToast';

// ----- Nb: bottom nav -----
export { default as NbBottomNav } from './NbBottomNav';

// ----- Dev gallery — visual QA of the design system -----
export { default as NbComponentsPreview } from './NbComponentsPreview';
