// Gradient chat-bubbles icon. The color comes from ColorfulIcon, not a mask.
// Flow: pass the size and gradient stops through to ColorfulIcon.
// Used by: navigation and home cards that show the chat shortcut.

import React from 'react';
import ColorfulIcon from './ColorfulIcon';

// ===== NAMED CONSTANTS =====

const DEFAULT_ICON_SIZE = 32;
const CHAT_ICON_NAME = 'chatbubbles';

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {{ size?: number, colors?: string[], start?: object, end?: object }} props
 */
export default function ChatIcon({ size = DEFAULT_ICON_SIZE, colors, start, end }) {
  return <ColorfulIcon name={CHAT_ICON_NAME} size={size} colors={colors} start={start} end={end} />;
}
