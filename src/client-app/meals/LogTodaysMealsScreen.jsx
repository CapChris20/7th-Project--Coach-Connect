// Parallel Nutrition tab path — routes through Design Law DailyLogContent chrome.
// Flow: re-export the mapped daily-log shell so this entry cannot drift from PNG 01–04.
// Used by ClientAppStart (legacy import). Prefer DailyLogContent / ClientMainScreen nutrition tab.

import DailyLogContent from '../../nutrition/daily-log/DailyLogContent';

export default function LogTodaysMealsScreen(props) {
  return <DailyLogContent {...props} />;
}
