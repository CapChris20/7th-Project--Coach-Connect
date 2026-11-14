// Attach sheet — Choose an option: camera, library, analyze progress photo, or paste text.
// Flow: + opens NbSheet → row tap closes sheet → short delay → parent runs picker / paste.
// Used by CoachConversationScreen. Visual law: screens/ai-coach/07–08 PNGs.

import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NbSheet from '../../look-and-feel/NbSheet';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHEET_TITLE = 'Choose an option';
const ROW_ICON_PIXELS = 26;
const ROW_CHEVRON_SIZE = 18;
const ROW_MIN_HEIGHT = 64;
const ROW_BORDER_WHEN_NOT_LAST = 2;
const ROW_PRESS_OPACITY = 0.88;

// Manipulate here: wait for NbSheet dismiss animation before ImagePicker / paste UI
const DISMISS_BEFORE_CALLBACK_MS = 120;

const OPTION_ID_CAMERA = 'camera';
const OPTION_ID_LIBRARY = 'library';
const OPTION_ID_ANALYZE = 'analyze';
const OPTION_ID_PASTE = 'paste';

const ATTACH_OPTIONS = [
  {
    id: OPTION_ID_CAMERA,
    title: 'Take a photo',
    subtitle: 'Use the camera',
    icon: require('../../assets/icons/handoff/picture.png'),
    gradient: accentGradients[0],
  },
  {
    id: OPTION_ID_LIBRARY,
    title: 'Choose from library',
    subtitle: 'Pick up to 4 photos',
    icon: require('../../assets/icons/handoff/progress.png'),
    gradient: accentGradients[3],
  },
  {
    id: OPTION_ID_ANALYZE,
    title: 'Analyze a progress photo',
    subtitle: 'Physique feedback',
    icon: require('../../assets/icons/handoff/scales.png'),
    gradient: accentGradients[2],
  },
  {
    id: OPTION_ID_PASTE,
    title: 'Paste text',
    subtitle: 'A workout, a label, a message',
    icon: require('../../assets/icons/handoff/week.png'),
    gradient: accentGradients[4],
  },
];

// ===== HELPER FUNCTIONS =====

function parentHandlerForOptionId(optionId, attachCallbacks) {
  if (optionId === OPTION_ID_CAMERA) {
    return attachCallbacks.onCamera;
  }
  if (optionId === OPTION_ID_LIBRARY) {
    return attachCallbacks.onLibrary;
  }
  if (optionId === OPTION_ID_ANALYZE) {
    return attachCallbacks.onAnalyze;
  }
  if (optionId === OPTION_ID_PASTE) {
    return attachCallbacks.onPaste;
  }
  return null;
}

function closeSheetThenRunParentHandler(optionId, onCloseSheet, attachCallbacks) {
  if (onCloseSheet) {
    onCloseSheet();
  }

  setTimeout(() => {
    const runParentHandler = parentHandlerForOptionId(optionId, attachCallbacks);
    if (runParentHandler) {
      runParentHandler();
    }
  }, DISMISS_BEFORE_CALLBACK_MS);
}

function bottomBorderWidthForRow(optionIndex, optionCount) {
  const isLastRow = optionIndex >= optionCount - 1;
  if (isLastRow) {
    return 0;
  }
  return ROW_BORDER_WHEN_NOT_LAST;
}

function AttachOptionRow({ option, optionIndex, optionCount, themeColors, onPickOption }) {
  const bottomBorderWidth = bottomBorderWidthForRow(optionIndex, optionCount);
  const borderColor = themeColors.nbBorder;
  const titleInkColor = themeColors.nbInk;
  const subtitleMutedColor = themeColors.nbMuted;

  function handleRowPress() {
    onPickOption(option.id);
  }

  function rowStyleWhilePressed(pressed) {
    let opacity = 1;
    if (pressed) {
      opacity = ROW_PRESS_OPACITY;
    }
    return [
      styles.row,
      {
        borderBottomWidth: bottomBorderWidth,
        borderBottomColor: borderColor,
        opacity,
      },
    ];
  }

  const iconImageStyle = { width: ROW_ICON_PIXELS, height: ROW_ICON_PIXELS };

  return (
    <Pressable
      onPress={handleRowPress}
      style={({ pressed }) => rowStyleWhilePressed(pressed)}
      accessibilityRole="button"
      accessibilityLabel={option.title}
    >
      <View style={[styles.iconChip, { borderColor }]}>
        <LinearGradient
          colors={option.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconFill}
        >
          <Image source={option.icon} style={iconImageStyle} resizeMode="contain" />
        </LinearGradient>
      </View>

      <View style={styles.rowTextWrap}>
        <Text style={[styles.rowTitle, { color: titleInkColor }]}>{option.title}</Text>
        <Text style={[styles.rowSub, { color: subtitleMutedColor }]}>{option.subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={ROW_CHEVRON_SIZE} color={subtitleMutedColor} />
    </Pressable>
  );
}

function buildAttachOptionRows(themeColors, onPickOption) {
  const optionCount = ATTACH_OPTIONS.length;
  const rows = [];

  for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
    const option = ATTACH_OPTIONS[optionIndex];
    rows.push(
      <AttachOptionRow
        key={option.id}
        option={option}
        optionIndex={optionIndex}
        optionCount={optionCount}
        themeColors={themeColors}
        onPickOption={onPickOption}
      />,
    );
  }

  return rows;
}

// ===== MAIN FUNCTION =====

/**
 * NbSheet listing camera / library / analyze / paste.
 * Flow: 1. theme  2. pack callbacks  3. on pick → dismiss then run  4. render rows
 */
export default function CoachAttachSheet({
  visible,
  onClose,
  onCamera,
  onLibrary,
  onAnalyze,
  onPaste,
}) {
  const { colors: themeColors } = useTheme();

  // 1. Pack the four parent handlers so row picks do not close over four separate props.
  const attachCallbacks = {
    onCamera,
    onLibrary,
    onAnalyze,
    onPaste,
  };

  // 2. Row tap → close sheet → delayed parent callback.
  function handleOptionPicked(optionId) {
    closeSheetThenRunParentHandler(optionId, onClose, attachCallbacks);
  }

  // 3. Build rows before return so JSX is a short story.
  const optionRows = buildAttachOptionRows(themeColors, handleOptionPicked);

  // 4. PNG 07: rows sit on the sheet — no second bordered frame around the list.
  return (
    <NbSheet visible={visible} onClose={onClose} title={SHEET_TITLE}>
      <View style={styles.list}>{optionRows}</View>
    </NbSheet>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  list: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    minHeight: ROW_MIN_HEIGHT,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.nbIconChip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  iconFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  rowSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: spacing.xs / 2,
  },
});
