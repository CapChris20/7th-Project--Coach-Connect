// Gradient chat-bubbles icon. The color comes from ColorfulIcon, not a mask.
// Flow: pass the size and gradient stops through to ColorfulIcon.
// Used by: navigation and home cards that show the chat shortcut.

import React from 'react';
import ColorfulIcon from './ColorfulIcon';

// ===== NAMED CONSTANTS =====

const DEFAULT_ICON_SIZE = 32;
const CHAT_ICON_NAME = 'chatbubbles';

// ===== HELPER FUNCTIONS =====

function chatIconSettings(size, colors, start, end) {
  return {
    name: CHAT_ICON_NAME,
    size,
    colors,
    start,
    end,
  };
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ size?: number, colors?: string[], start?: object, end?: object }} props
 */
export default function ChatIcon({ size = DEFAULT_ICON_SIZE, colors, start, end }) {
  const iconSettings = chatIconSettings(size, colors, start, end);

  // 1. Hand the chat-bubbles name and size to ColorfulIcon. Color comes from there, not a mask.
  return (
    <ColorfulIcon
      name={iconSettings.name}
      size={iconSettings.size}
      colors={iconSettings.colors}
      start={iconSettings.start}
      end={iconSettings.end}
    />
  );
}
