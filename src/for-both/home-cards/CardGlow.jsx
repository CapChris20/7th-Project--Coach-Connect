// Legacy no-op — CardGlow used to paint a soft orange wash behind heroes.
// Flow: returns null. Call sites that still import it stay safe; visuals come from NbCard instead.
// Used by: nothing new. Prefer NbCard hard shadow.
//
// vocab: redesign bans glow/blur decoration — this stub exists only so stale imports do not crash.

import React from 'react';

/**
 * @param {{ isDark?: boolean, borderRadius?: number }} _props
 * @returns {null}
 */
export default function CardGlow(_props) {
  return null;
}
