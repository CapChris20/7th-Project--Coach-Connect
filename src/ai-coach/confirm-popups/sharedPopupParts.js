// Shared Design Law chrome for AI-coach confirm popups.
// Flow: CoachWantsBadge → title → editable chips/slider/fields → Not now / confirm.
// Used by: every confirm-popup in this folder. Visual law: screens/ai-coach-popups/*.png
//
// vocab: fill-selected = solid nbFill + onFill text (black chip), not brand gradient
// vocab: Coach wants badge = gradient pill naming the pending tool

import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbButton from '../../look-and-feel/NbButton';
import NbSlider from '../../look-and-feel/NbSlider';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import {
  lightColors,
  darkColors,
  spacing,
  borderRadius,
  nb,
  navAccentGradient,
  accentGradients,
} from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_CONFIRM_LABEL = 'Confirm';
// Design Law popups use “Not now” instead of Cancel on the ghost side
const CANCEL_LABEL = 'Not now';
const SPINNER_COLOR = lightColors.nbOnFill;

// ===== HELPERS =====

/** Theme tokens for popups — always app theme, never OS scheme alone. */
export function usePopupColors() {
  const { isDark } = useTheme();
  return isDark ? darkColors : lightColors;
}

/**
 * Date row text for a log popup: the tool's date, or "Today" when it omits one.
 * @param {object|undefined} params
 * @returns {string}
 */
export function logDateLabel(params) {
  const date = params?.date;
  return date ? String(date) : 'Today';
}

/**
 * Gradient “Coach wants to …” pill — Design Law top chrome on every confirm sheet.
 * @param {{ text: string }} props
 */
export function CoachWantsBadge({ text }) {
  const colors = usePopupColors();
  if (!text) return null;
  return (
    <View style={sharedStyles.badgeWrap}>
      <LinearGradient
        colors={navAccentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[sharedStyles.badge, { borderColor: colors.nbBorder }]}
      >
        <Text style={[sharedStyles.badgeText, { color: lightColors.nbInk }]} numberOfLines={1}>
          {text}
        </Text>
      </LinearGradient>
    </View>
  );
}

function ReasoningLine({ reasoning, colors }) {
  if (!reasoning) return null;
  return <Text style={[sharedStyles.reasoning, { color: colors.nbMuted }]}>{reasoning}</Text>;
}

/**
 * One labeled value. Hidden when empty so blank rows never show.
 * @param {{ label?: string, value?: * }} props
 */
export function DetailRow({ label, value }) {
  const colors = usePopupColors();
  const valueIsMissing = value == null || value === '';
  if (valueIsMissing) return null;

  return (
    <View style={sharedStyles.section}>
      {label ? <Text style={[sharedStyles.label, { color: colors.nbMuted }]}>{label}</Text> : null}
      <Text style={[sharedStyles.value, { color: colors.nbInk }]}>{String(value)}</Text>
    </View>
  );
}

/**
 * Uppercase field label (FOOD / NOTE / …).
 * @param {{ label: string }} props
 */
export function FieldLabel({ label }) {
  const colors = usePopupColors();
  if (!label) return null;
  return <Text style={[sharedStyles.label, { color: colors.nbMuted }]}>{label}</Text>;
}

/**
 * 3px bordered text field — editable draft before confirm.
 * @param {{ value: string, onChangeText: Function, placeholder?: string, multiline?: boolean }} props
 */
export function PopupTextField({ value, onChangeText, placeholder, multiline = false }) {
  const colors = usePopupColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.nbMuted}
      multiline={multiline}
      style={[
        sharedStyles.textField,
        multiline && sharedStyles.textFieldMulti,
        {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
          color: colors.nbInk,
        },
      ]}
    />
  );
}

/**
 * Fill-selected chip — solid black when on (Design Law popup chips, not brand gradient).
 * @param {{ label: string, selected?: boolean, onPress?: Function }} props
 */
export function FillChip({ label, selected = false, onPress }) {
  const colors = usePopupColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        sharedStyles.fillChip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: selected ? colors.nbFill : colors.nbSurface,
          opacity: pressed ? 0.92 : 1,
          transform: [{ translateX: pressed ? 2 : 0 }, { translateY: pressed ? 2 : 0 }],
          shadowColor: colors.nbShadow,
        },
      ]}
    >
      <Text
        style={[
          sharedStyles.fillChipText,
          { color: selected ? colors.nbOnFill : colors.nbInk },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Wrapping row of fill chips (mood / meal type / quality).
 * @param {{ options: Array<{id:string,label:string}>, value: string, onChange: Function }} props
 */
export function FillChipRow({ options, value, onChange }) {
  return (
    <View style={sharedStyles.chipWrap}>
      {(options || []).map((opt) => (
        <FillChip
          key={opt.id}
          label={opt.label}
          selected={value === opt.id}
          onPress={() => onChange?.(opt.id)}
        />
      ))}
    </View>
  );
}

/**
 * Three macro mini-cards (protein / carbs / fats) — Design Law meal sheet.
 * @param {{ protein?: string|number, carbs?: string|number, fats?: string|number }} props
 */
export function MacroStatCards({ protein, carbs, fats }) {
  const colors = usePopupColors();
  const cells = [
    { key: 'p', label: 'Protein', value: protein },
    { key: 'c', label: 'Carbs', value: carbs },
    { key: 'f', label: 'Fats', value: fats },
  ];
  return (
    <View style={sharedStyles.macroRow}>
      {cells.map((cell) => (
        <View
          key={cell.key}
          style={[
            sharedStyles.macroCard,
            {
              borderColor: colors.nbBorder,
              backgroundColor: colors.nbSurface,
              shadowColor: colors.nbShadow,
            },
          ]}
        >
          <Text style={[sharedStyles.macroValue, { color: colors.nbInk }]}>
            {cell.value == null || cell.value === '' ? '—' : String(cell.value)}
          </Text>
          <Text style={[sharedStyles.macroLabel, { color: colors.nbMuted }]}>{cell.label}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Big hero number above a slider (sleep hours, steps, energy).
 * @param {{ label?: string, valueLabel: string, children?: * }} props
 */
export function BigValueBlock({ label, valueLabel, children }) {
  const colors = usePopupColors();
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? (
        <Text style={[sharedStyles.heroLabel, { color: colors.nbInk }]}>{label}</Text>
      ) : null}
      <Text style={[sharedStyles.heroValue, { color: colors.nbInk }]}>{valueLabel}</Text>
      {children}
    </View>
  );
}

/**
 * NbSlider wrapper with Design Law accent ramp.
 * @param {object} props — forwarded to NbSlider
 */
export function PopupSlider(props) {
  return <NbSlider colors={props.colors || accentGradients[0]} {...props} />;
}

/**
 * Title, optional Coach-wants badge, optional reasoning, then popup fields.
 * @param {{ title: string, badge?: string, children?: *, reasoning?: string }} props
 */
export function ToolModalBody({ title, badge, children, reasoning }) {
  const colors = usePopupColors();
  return (
    <View>
      {badge ? <CoachWantsBadge text={badge} /> : null}
      <Text style={[sharedStyles.title, { color: colors.nbInk }]}>{title}</Text>
      <ReasoningLine reasoning={reasoning} colors={colors} />
      {children}
    </View>
  );
}

/**
 * Not now (ghost) + Confirm (fill). Confirm shows a spinner while the action runs.
 * @param {{ onConfirm: Function, onCancel: Function, loading?: boolean, confirmLabel?: string, cancelLabel?: string }} props
 */
export function ConfirmCancelRow({
  onConfirm,
  onCancel,
  loading,
  confirmLabel = DEFAULT_CONFIRM_LABEL,
  cancelLabel = CANCEL_LABEL,
}) {
  const confirmContent = loading ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <ActivityIndicator color={SPINNER_COLOR} size="small" />
      <Text style={{ color: lightColors.nbOnFill, fontWeight: '800' }}>{confirmLabel}</Text>
    </View>
  ) : (
    confirmLabel
  );

  return (
    <View style={sharedStyles.buttons}>
      <View style={{ flex: 1 }}>
        <NbButton variant="ghost" onPress={onCancel} disabled={loading}>
          {cancelLabel}
        </NbButton>
      </View>
      <View style={{ flex: 1 }}>
        <NbButton variant="fill" onPress={onConfirm} disabled={loading}>
          {confirmContent}
        </NbButton>
      </View>
    </View>
  );
}

const sharedStyles = StyleSheet.create({
  badgeWrap: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm + 2,
  },
  badge: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: spacing.sm,
  },
  reasoning: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.sm + 2 },
  label: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  value: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  textField: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  textFieldMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  fillChip: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  fillChipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  macroCard: {
    flex: 1,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  macroLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  heroLabel: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: spacing.sm,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.md + 4,
    width: '100%',
  },
});
