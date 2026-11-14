// Legacy “Log today’s meals” route — same chrome as the Nutrition tab daily log.
// Flow: take whatever the router passed → hand it straight to DailyLogContent.
// Used by: ClientAppStart (old import). Prefer DailyLogContent / ClientMainScreen nutrition tab.
// Why this file exists: older navigation still imports this name; we must not fork the Design Law UI.

import DailyLogContent from '../../nutrition/daily-log/DailyLogContent';

// ===== NAMED CONSTANTS =====

// No tweakable rules here — DailyLogContent owns calorie targets, meal slots, and chrome.

// ===== HELPER FUNCTIONS =====

/**
 * Render the Design Law daily-log body.
 * One job: forward every prop so navigation params stay intact.
 * @param {object} screenProps
 * @returns {JSX.Element}
 */
function showDesignLawDailyLog(screenProps) {
  // vocab: {...screenProps} = pass every key the router gave us (date, client id, etc.)
  return <DailyLogContent {...screenProps} />;
}

// ===== MAIN FUNCTION =====

/**
 * Legacy screen entry for “Log today’s meals.”
 * Same PNG 01–04 chrome as the nutrition tab — do not add a second layout here.
 * @param {object} props
 * @returns {JSX.Element}
 */
export default function LogTodaysMealsScreen(props) {
  // 1. Keep the legacy route name; show the shared daily-log shell (same as nutrition tab).
  const screenProps = props;
  return showDesignLawDailyLog(screenProps);
}
