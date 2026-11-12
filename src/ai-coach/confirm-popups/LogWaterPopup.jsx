// Design Law water confirm — cup taps + today/yesterday (screens/ai-coach-popups/09).
// Flow: convert oz ↔ cups → tap cups → confirm writes amount_oz (server key).
// Used by: ConfirmActionPopup when tool = logWater.

import React, { useMemo, useState } from 'react';
import { Image, Pressable, Text, View, StyleSheet } from 'react-native';
import {
  ToolModalBody,
  FillChipRow,
  ConfirmCancelRow,
  usePopupColors,
} from './sharedPopupParts';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to log water';
const TITLE = 'Water today';
const CONFIRM_LABEL = 'Log water';
// Manipulate here: cup goal + oz per cup (Body tab uses the same 8 oz cup)
const WATER_CUP_GOAL = 8;
const OZ_PER_CUP = 8;
const DAY_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
];
const HANDOFF_WATER = (() => {
  try {
    return require('../../assets/icons/handoff/hydration.png');
  } catch (_) {
    return null;
  }
})();

// ===== HELPERS =====

function readOz(params) {
  const keys = ['amount_oz', 'amountOz', 'ounces', 'amount'];
  for (const key of keys) {
    const n = Number(params?.[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Default two cups when the model forgot the amount
  return 16;
}

function ozToCups(oz) {
  return Math.max(1, Math.min(WATER_CUP_GOAL, Math.round(Number(oz) / OZ_PER_CUP) || 1));
}

function cupsToOz(cups) {
  return Math.max(0, Math.round(Number(cups) || 0) * OZ_PER_CUP);
}

function readDay(params) {
  const raw = String(params?.date || 'today').toLowerCase();
  if (raw === 'yesterday') return 'yesterday';
  return 'today';
}

// ===== MAIN FUNCTION =====

export default function LogWaterPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const colors = usePopupColors();
  const [cups, setCups] = useState(() => ozToCups(readOz(params)));
  const [day, setDay] = useState(() => readDay(params));
  const amountOz = cupsToOz(cups);

  const draftParams = useMemo(
    () => ({
      ...(params || {}),
      amount_oz: amountOz,
      amountOz,
      ounces: amountOz,
      amount: amountOz,
      date: day === 'yesterday' ? 'yesterday' : undefined,
    }),
    [params, amountOz, day],
  );

  return (
    <ToolModalBody title={TITLE} badge={BADGE} reasoning={reasoning}>
      <Text style={[styles.hero, { color: colors.nbInk }]}>
        <Text style={styles.heroBig}>{cups}</Text>
        {` of ${WATER_CUP_GOAL} cups`}
      </Text>
      <View style={styles.cupGrid}>
        {Array.from({ length: WATER_CUP_GOAL }, (_, index) => {
          const filled = index < cups;
          return (
            <Pressable
              key={`cup-${index}`}
              onPress={() => setCups(index + 1)}
              style={[
                styles.cup,
                {
                  borderColor: colors.nbBorder,
                  backgroundColor: filled ? colors.nbFill : colors.nbSurface,
                  shadowColor: colors.nbShadow,
                },
              ]}
            >
              {HANDOFF_WATER ? (
                <Image
                  source={HANDOFF_WATER}
                  style={{
                    width: 22,
                    height: 22,
                    tintColor: filled ? colors.nbOnFill : undefined,
                  }}
                  resizeMode="contain"
                />
              ) : (
                <Text style={{ color: filled ? colors.nbOnFill : colors.nbInk, fontWeight: '900' }}>
                  {index + 1}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      <FillChipRow options={DAY_OPTIONS} value={day} onChange={setDay} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(draftParams)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}

const styles = StyleSheet.create({
  hero: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  heroBig: {
    fontSize: 40,
    fontWeight: '900',
  },
  cupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.md,
  },
  cup: {
    width: 52,
    height: 52,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
});
