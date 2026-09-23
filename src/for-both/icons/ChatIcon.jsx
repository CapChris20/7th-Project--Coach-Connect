/**
 * Gradient Chat Bubbles Icon — SVG gradient (no MaskedView).
 */
import React from 'react';
import ColorfulIcon from './ColorfulIcon';

export default function ChatIcon({ size = 32, colors, start, end }) {
  return <ColorfulIcon name="chatbubbles" size={size} colors={colors} start={start} end={end} />;
}
