// Gradient chat-bubbles shortcut — color from ColorfulIcon mask, not a tinted bitmap.
// Flow: gather size + optional gradient stops → hand them to ColorfulIcon as chatbubbles.
// Used by: navigation rows and home cards that open chat.

import React from 'react';
import ColorfulIcon from './ColorfulIcon';

// ===== NAMED CONSTANTS =====

// Manipulate here: default edge length when the parent omits size.
const DEFAULT_CHAT_ICON_SIZE = 32;
// Letter-locked ionicon-style name ColorfulIcon maps to the chat SVG paths.
const CHAT_BUBBLES_NAME = 'chatbubbles';

// ===== HELPER FUNCTIONS =====

// Bundle the props ColorfulIcon expects so the main stays a short checklist.
function buildChatColorfulIconProps(edgeLength, gradientColors, gradientStart, gradientEnd) {
  return {
    name: CHAT_BUBBLES_NAME,
    size: edgeLength,
    colors: gradientColors,
    start: gradientStart,
    end: gradientEnd,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Chat shortcut painted through ColorfulIcon (gradient fill via mask, not a PNG tint).
 * @param {{ size?: number, colors?: string[], start?: object, end?: object }} props
 * @returns {import('react').ReactElement}
 */
export default function ChatIcon({
  size = DEFAULT_CHAT_ICON_SIZE,
  colors,
  start,
  end,
}) {
  // 1. Build the ColorfulIcon bag: fixed chat name + caller size/gradient overrides.
  const chatIconProps = buildChatColorfulIconProps(size, colors, start, end);

  // 2. Paint through ColorfulIcon — it owns the brand gradient + SVG mask path.
  // vocab: ColorfulIcon = shared wrapper that maps an icon name to SVG paths + gradient fill.
  return (
    <ColorfulIcon
      name={chatIconProps.name}
      size={chatIconProps.size}
      colors={chatIconProps.colors}
      start={chatIconProps.start}
      end={chatIconProps.end}
    />
  );
}
