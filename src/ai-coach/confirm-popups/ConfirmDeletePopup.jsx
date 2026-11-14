// Design Law delete-entry confirm — InfoTable + coral “Cannot be undone” pill.
// Flow: read tool params → name the entry in a table → Keep it (ghost) / Delete (fill).
// Used by: ConfirmActionPopup when the coach tool is deleteLog.

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ToolModalBody,
  InfoTable,
  ConfirmCancelRow,
  usePopupColors,
} from './sharedPopupParts';
import { accentGradients, spacing, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE_TEXT = 'Coach wants to delete an entry';
const HEADLINE = 'Delete this entry?';
const KEEP_BUTTON_LABEL = 'Keep it';
const DELETE_BUTTON_LABEL = 'Delete';
const WARN_PILL_TEXT = 'Cannot be undone';

// Manipulate here: warn pill uses coral→red (same family as DeleteChatSheet)
// vocab: accentGradients[1] = second accent pair from the design token sheet
const WARN_GRADIENT_FALLBACK = ['#FB7185', '#EF4444'];
const WARN_GRADIENT_FROM_PALETTE = accentGradients[1];

let WARN_GRADIENT_COLORS = WARN_GRADIENT_FALLBACK;
if (WARN_GRADIENT_FROM_PALETTE) {
  WARN_GRADIENT_COLORS = WARN_GRADIENT_FROM_PALETTE;
}

// Manipulate here: human labels for each logType key the coach may send
const LABEL_FOR_LOG_TYPE = {
  nutrition: 'Food / nutrition entry',
  sleep: 'Sleep log',
  water: 'Water log',
  steps: 'Step count',
  energy: 'Energy rating',
  mood: 'Mood log',
  workout: 'Workout entry',
  restDay: 'Rest day entry',
};

const FALLBACK_LOG_TYPE = 'nutrition';
const FALLBACK_DATE_LABEL = 'Today';

// ===== HELPER FUNCTIONS =====

/**
 * Pull the fields ConfirmDelete cares about out of the raw coach tool args.
 * Why: the modal never reads params.foo inline — one place owns the defaults.
 * @param {object} coachParams
 * @returns {{ logTypeKey: string, dateLabel: *, foodName: *, coachAskedToDeleteAll: boolean }}
 */
function foodNameFromCoachParams(coachParams) {
  if (coachParams.foodName) {
    return coachParams.foodName;
  }
  if (coachParams.food) {
    return coachParams.food;
  }
  return undefined;
}

function readDeleteFieldsFromCoachParams(coachParams) {
  if (!coachParams) {
    return {
      logTypeKey: FALLBACK_LOG_TYPE,
      dateLabel: FALLBACK_DATE_LABEL,
      foodName: undefined,
      coachAskedToDeleteAll: false,
    };
  }

  let logTypeRaw = FALLBACK_LOG_TYPE;
  if (coachParams.logType) {
    logTypeRaw = coachParams.logType;
  }

  let dateLabel = FALLBACK_DATE_LABEL;
  if (coachParams.date) {
    dateLabel = coachParams.date;
  }

  const foodName = foodNameFromCoachParams(coachParams);
  const logTypeKey = String(logTypeRaw).toLowerCase();
  // vocab: Boolean(...) turns truthy deleteAll/all flags into a real true/false
  const coachAskedToDeleteAll = Boolean(coachParams.deleteAll || coachParams.all);

  return {
    logTypeKey,
    dateLabel,
    foodName,
    coachAskedToDeleteAll,
  };
}

/**
 * Map a raw logType key to the sentence shown in the InfoTable “Type” row.
 * @param {string} logTypeKey
 * @returns {string}
 */
function humanLabelForLogType(logTypeKey) {
  const knownLabel = LABEL_FOR_LOG_TYPE[logTypeKey];
  if (knownLabel) {
    return knownLabel;
  }
  return logTypeKey;
}

/**
 * Build the bordered InfoTable rows (Food only when the coach named one).
 * @param {object} deleteFields
 * @param {string} typeLabel
 * @returns {Array<{ label: string, value: string }>}
 */
function buildInfoTableRows(deleteFields, typeLabel) {
  const rows = [];

  if (deleteFields.foodName) {
    rows.push({ label: 'Food', value: String(deleteFields.foodName) });
  }

  rows.push({ label: 'Type', value: typeLabel });
  rows.push({ label: 'Date', value: String(deleteFields.dateLabel) });

  return rows;
}

/**
 * Coral pill that sits above Keep / Delete — Design Law “Cannot be undone”.
 */
function CannotBeUndonePill({ borderColor }) {
  const pillShellStyle = [styles.warnPill, { borderColor }];

  return (
    <View style={pillShellStyle}>
      <LinearGradient
        colors={WARN_GRADIENT_COLORS}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.warnFill}
      >
        <Text style={styles.warnText}>{WARN_PILL_TEXT}</Text>
      </LinearGradient>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Confirm deleting one (or all) log entries the coach proposed.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function ConfirmDeletePopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Theme tokens — warn pill border must match the rest of the popup chrome.
  // vocab: usePopupColors = shared hook; returns nbBorder / nbInk / etc for light+dark
  const popupColors = usePopupColors();

  // 2. Turn coach tool args into table labels.
  const deleteFields = readDeleteFieldsFromCoachParams(params);
  const typeLabel = humanLabelForLogType(deleteFields.logTypeKey);
  const infoTableRows = buildInfoTableRows(deleteFields, typeLabel);

  // 3. Keep it cancels; Delete forwards the original tool params unchanged.
  function handleKeepEntry() {
    onCancel();
  }

  function handleDeleteEntry() {
    onConfirm(params);
  }

  // 4. Paint table → warn pill → Keep / Delete (Keep is left — matches DeleteChatSheet PNG).
  const warnPillBorderColor = popupColors.nbBorder;

  return (
    <ToolModalBody title={HEADLINE} badge={BADGE_TEXT} reasoning={reasoning}>
      <InfoTable rows={infoTableRows} />
      <CannotBeUndonePill borderColor={warnPillBorderColor} />
      <ConfirmCancelRow
        onConfirm={handleDeleteEntry}
        onCancel={handleKeepEntry}
        loading={loading}
        cancelLabel={KEEP_BUTTON_LABEL}
        confirmLabel={DELETE_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  warnPill: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidthPill || nb.borderWidth,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  warnFill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  warnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0A0A',
  },
});
