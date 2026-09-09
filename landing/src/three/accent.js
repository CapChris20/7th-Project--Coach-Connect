import { palette } from '../config/palette';

export const ACCENT = {
  pink: palette.pink,
  purple: palette.purple,
  cyan: palette.cyan,
  cyanLight: palette.cyanLight,
  orange: palette.orange,
  green: palette.green,
  greenLight: palette.greenLight,
};

export function accentColor(name) {
  return ACCENT[name] || ACCENT.cyan;
}
