/**
 * Brand-gradient icons via react-native-svg (no MaskedView).
 * MaskedView + icon fonts/PNGs often vanish or flicker on iOS dev builds.
 */
import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
} from '../../../shared-ui/brandGradients';
import { BRAND_GRADIENT_ICON_PATHS } from './brandGradientSvgPaths';

const VIEWBOX = 24;

function toSvgCoord(fraction, fallback) {
  return String((fraction ?? fallback) * VIEWBOX);
}

export default function BrandGradientIcon({
  name,
  size = 36,
  colors = BRAND_NAV_ICON_GRADIENT,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
  strokeWidth = 2.1,
}) {
  const icon = BRAND_GRADIENT_ICON_PATHS[name];
  if (!icon?.paths?.length) return null;

  const gradId = `cc-brand-${name}`;
  const paint = `url(#${gradId})`;
  const isStroke = icon.style !== 'fill';

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} collapsable={false}>
      <Defs>
        <LinearGradient
          id={gradId}
          x1={toSvgCoord(start?.x, 0.5)}
          y1={toSvgCoord(start?.y, 0)}
          x2={toSvgCoord(end?.x, 0.5)}
          y2={toSvgCoord(end?.y, 1)}
          gradientUnits="userSpaceOnUse"
        >
          {colors.map((color, i) => (
            <Stop
              key={`${color}-${i}`}
              offset={colors.length === 1 ? '0' : String(i / (colors.length - 1))}
              stopColor={color}
            />
          ))}
        </LinearGradient>
      </Defs>
      {icon.paths.map((d) => (
        <Path
          key={d}
          d={d}
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
