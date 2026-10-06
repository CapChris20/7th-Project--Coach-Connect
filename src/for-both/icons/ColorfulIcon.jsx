// Brand-colored icons drawn as SVG paths, so we do not need MaskedView.
// Flow: look up the path → build a gradient from the brand stops → stroke or fill each path.
// Used by nav and brand marks. MaskedView plus icon fonts flickered on iOS dev builds.

import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
} from '../../look-and-feel/brandColors';
import { BRAND_GRADIENT_ICON_PATHS } from './iconShapes';

// ===== NAMED CONSTANTS =====

// Manipulate here: every path in iconShapes was drawn on a 24 by 24 grid.
const ICON_VIEWBOX_SIZE = 24;
const DEFAULT_ICON_SIZE = 36;
const DEFAULT_STROKE_WIDTH = 2.1;

const GRADIENT_FALLBACK_X = 0.5;
const GRADIENT_FALLBACK_START_Y = 0;
const GRADIENT_FALLBACK_END_Y = 1;

// ===== HELPER FUNCTIONS =====

// vocab/symbol: ?? = keep 0 as a real coordinate. || would treat 0 as missing and jump to the fallback.
function toSvgCoord(fraction, fallback) {
  const fractionOrFallback = fraction ?? fallback;
  return String(fractionOrFallback * ICON_VIEWBOX_SIZE);
}

// One color sits at the start. Two or more are spaced evenly from 0 to 1.
function gradientStopOffset(colorIndex, colorCount) {
  if (colorCount === 1) return '0';
  return String(colorIndex / (colorCount - 1));
}

function isStrokeIcon(icon) {
  return icon.style !== 'fill';
}

// ===== MAIN FUNCTION =====

/**
 * Draw one brand icon by name. Returns null when that name has no paths.
 * @param {{ name: string, size?: number, colors?: string[], start?: { x?: number, y?: number }, end?: { x?: number, y?: number }, strokeWidth?: number }} props
 * @returns {import('react').ReactElement|null}
 */
export default function ColorfulIcon({
  name,
  size = DEFAULT_ICON_SIZE,
  colors = BRAND_NAV_ICON_GRADIENT,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
  strokeWidth = DEFAULT_STROKE_WIDTH,
}) {
  const icon = BRAND_GRADIENT_ICON_PATHS[name];
  if (!icon?.paths?.length) return null;

  const gradientId = `cc-brand-${name}`;
  const paint = `url(#${gradientId})`;
  const isStroke = isStrokeIcon(icon);

  return (
    // vocab: collapsable={false} keeps Android from merging this SVG away. Merged icons disappeared.
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_VIEWBOX_SIZE} ${ICON_VIEWBOX_SIZE}`}
      collapsable={false}
    >
      <Defs>
        <LinearGradient
          id={gradientId}
          x1={toSvgCoord(start?.x, GRADIENT_FALLBACK_X)}
          y1={toSvgCoord(start?.y, GRADIENT_FALLBACK_START_Y)}
          x2={toSvgCoord(end?.x, GRADIENT_FALLBACK_X)}
          y2={toSvgCoord(end?.y, GRADIENT_FALLBACK_END_Y)}
          // vocab: userSpaceOnUse = the gradient is measured in the 24px viewBox, not a 0–1 box.
          gradientUnits="userSpaceOnUse"
        >
          {colors.map((color, colorIndex) => (
            <Stop
              key={`${color}-${colorIndex}`}
              offset={gradientStopOffset(colorIndex, colors.length)}
              stopColor={color}
            />
          ))}
        </LinearGradient>
      </Defs>
      {icon.paths.map((pathData) => (
        <Path
          key={pathData}
          d={pathData}
          fill={isStroke ? 'none' : paint}
          stroke={isStroke ? paint : 'none'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
