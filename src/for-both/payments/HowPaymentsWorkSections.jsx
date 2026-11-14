// Reusable payment education UI — how payouts work, Venmo comparison, earnings preview.
// Flow: checklist → mock earnings card → optional Venmo grid → single FAQ snippet.
// Used by: earnings screen, payout reminder popup, trainer payout setup.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import {
  HOW_PAYMENTS_WORK,
  VENMO_VS_COACHCONNECT,
  TRAINER_CLIENT_PAYMENT_FAQ,
  EARNINGS_MOCK,
  formatPaymentDollars,
} from './howPaymentsWorkText';
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_TEXT_COLOR = lightColors.white;
const DEFAULT_MUTED_COLOR = 'rgba(255,255,255,0.6)';
const DEFAULT_MUTED_PREVIEW = 'rgba(255,255,255,0.55)';
const DEFAULT_BORDER_COLOR = 'rgba(255,255,255,0.1)';
const DEFAULT_SURFACE_COLOR = 'rgba(255,255,255,0.04)';
// Manipulate here: checkmark / status colors on the education cards (not Design Law Nb tokens).
const CHECK_ICON_COLOR = '#34D399';
const STATUS_COMPLETED = 'Completed';
const STATUS_COMPLETED_COLOR = '#34D399';
const STATUS_PENDING_COLOR = '#FBBF24';
const HIGHLIGHT_BORDER = '#FF1493';
const COMPACT_BULLET_SIZE = 12;
const REGULAR_BULLET_SIZE = 13;
const ICON_CHECK = 'checkmark-circle';
const ICON_CHEVRON_UP = 'chevron-up';
const ICON_CHEVRON_DOWN = 'chevron-down';
const CHECK_ICON_SIZE = 16;
const CHEVRON_ICON_SIZE = 18;

// ===== HELPER FUNCTIONS =====

/**
 * Completed payouts are green; anything else (pending) is amber.
 * @param {string} status
 * @returns {string}
 */
function colorForTransactionStatus(status) {
  const isCompleted = status === STATUS_COMPLETED;
  if (isCompleted) {
    return STATUS_COMPLETED_COLOR;
  }
  return STATUS_PENDING_COLOR;
}

/**
 * Compact mode uses a smaller bullet font for tight popups.
 * @param {boolean} compact
 * @returns {number}
 */
function bulletFontSizeForMode(compact) {
  if (compact) {
    return COMPACT_BULLET_SIZE;
  }
  return REGULAR_BULLET_SIZE;
}

// ===== LAYOUT PIECES (no hooks) =====

function PaymentBulletLine({ line, mutedColor, fontSize }) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons
        name={ICON_CHECK}
        size={CHECK_ICON_SIZE}
        color={CHECK_ICON_COLOR}
        style={styles.bulletIcon}
      />
      <Text style={[styles.bulletText, { color: mutedColor, fontSize }]}>{line}</Text>
    </View>
  );
}

function EarningsTransactionRow({ transaction, inkColor, mutedColor, borderTopColor }) {
  const statusColor = colorForTransactionStatus(transaction.status);

  return (
    <View style={[styles.txRow, { borderTopColor }]}>
      <Text style={[styles.txDate, { color: mutedColor }]}>{transaction.date}</Text>
      <Text style={[styles.txName, { color: inkColor }]} numberOfLines={1}>
        {transaction.name}
      </Text>
      <Text style={[styles.txAmount, { color: inkColor }]}>
        {formatPaymentDollars(transaction.amount)}
      </Text>
      <Text style={[styles.txStatus, { color: statusColor }]}>{transaction.status}</Text>
    </View>
  );
}

function VenmoCompareColumn({
  heading,
  lines,
  textColor,
  mutedColor,
  borderColor,
  highlighted,
}) {
  const columnBorderColor = highlighted ? HIGHLIGHT_BORDER : borderColor;
  const columnStyles = [
    styles.compareCol,
    highlighted ? styles.compareColHighlight : null,
    { borderColor: columnBorderColor },
  ];
  const headingColor = highlighted ? textColor : mutedColor;

  return (
    <View style={columnStyles}>
      <Text style={[styles.compareHeading, { color: headingColor }]}>{heading}</Text>
      {lines.map((line) => (
        <Text key={line} style={[styles.compareLine, { color: mutedColor }]}>
          • {line}
        </Text>
      ))}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Checklist of how Coach Connect splits trainer vs platform fee.
 * @param {{ compact?: boolean, textColor?: string, mutedColor?: string }} props
 */
export function HowPaymentsWorkSection({
  compact = false,
  textColor = DEFAULT_TEXT_COLOR,
  mutedColor = DEFAULT_MUTED_COLOR,
}) {
  const bulletFontSize = bulletFontSizeForMode(compact);

  // 1. Draw the shared HOW_PAYMENTS_WORK copy as checkmark rows.
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>How payments work</Text>
      {HOW_PAYMENTS_WORK.map((line) => (
        <PaymentBulletLine
          key={line}
          line={line}
          mutedColor={mutedColor}
          fontSize={bulletFontSize}
        />
      ))}
    </View>
  );
}

/**
 * Fake pending total + example rows so a new trainer sees the dashboard shape.
 * @param {{ textColor?: string, mutedColor?: string, borderColor?: string, surfaceColor?: string }} props
 */
export function EarningsDashboardPreview({
  textColor = DEFAULT_TEXT_COLOR,
  mutedColor = DEFAULT_MUTED_PREVIEW,
  borderColor = DEFAULT_BORDER_COLOR,
  surfaceColor = DEFAULT_SURFACE_COLOR,
}) {
  // vocab: useTheme = Design Law light/dark color tokens for NbCard ink/muted/border
  // Caller props (textColor / mutedColor / …) stay on the signature for older call sites;
  // the live card paints from theme tokens so it matches Design Law shells.
  const { colors } = useTheme();

  // 1. Mock pending label + next payout + sample transaction rows inside NbCard.
  return (
    <NbCard>
      <Text style={[styles.previewLabel, { color: colors.nbMuted }]}>
        After your first client pays, you will see:
      </Text>
      <View style={styles.previewRow}>
        <Text style={[styles.previewStat, { color: colors.nbInk }]}>
          {EARNINGS_MOCK.pendingLabel}
        </Text>
        <Text style={[styles.previewMeta, { color: colors.nbMuted }]}>
          Next payout: {EARNINGS_MOCK.nextPayout}
        </Text>
      </View>
      {EARNINGS_MOCK.transactions.map((transaction) => (
        <EarningsTransactionRow
          key={`${transaction.date}-${transaction.name}`}
          transaction={transaction}
          inkColor={colors.nbInk}
          mutedColor={colors.nbMuted}
          borderTopColor={colors.nbBorder}
        />
      ))}
    </NbCard>
  );
}

/**
 * Collapsible Venmo vs Coach Connect comparison grid.
 * @param {{ textColor?: string, mutedColor?: string, borderColor?: string }} props
 */
export function VenmoComparisonSection({
  textColor = DEFAULT_TEXT_COLOR,
  mutedColor = DEFAULT_MUTED_COLOR,
  borderColor = DEFAULT_BORDER_COLOR,
}) {
  // vocab: useState = React hook that holds a value across renders
  const [isGridOpen, setIsGridOpen] = useState(false);

  const toggleGridOpen = () => {
    // 1. Collapsed by default — tap header to show Venmo vs Coach Connect columns.
    setIsGridOpen((wasOpen) => !wasOpen);
  };

  const chevronName = isGridOpen ? ICON_CHEVRON_UP : ICON_CHEVRON_DOWN;

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.collapseHeader}
        onPress={toggleGridOpen}
        activeOpacity={0.85}
      >
        <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>
          Coach Connect vs Venmo
        </Text>
        <Ionicons name={chevronName} size={CHEVRON_ICON_SIZE} color={mutedColor} />
      </TouchableOpacity>
      {isGridOpen ? (
        <View style={styles.compareGrid}>
          <VenmoCompareColumn
            heading="Venmo"
            lines={VENMO_VS_COACHCONNECT.venmo}
            textColor={textColor}
            mutedColor={mutedColor}
            borderColor={borderColor}
            highlighted={false}
          />
          <VenmoCompareColumn
            heading="Coach Connect"
            lines={VENMO_VS_COACHCONNECT.coachConnect}
            textColor={textColor}
            mutedColor={mutedColor}
            borderColor={borderColor}
            highlighted
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * One FAQ from shared copy — clients pay in-app, not Venmo.
 * @param {{ textColor?: string, mutedColor?: string }} props
 */
export function TrainerPaymentFaqSnippet({
  textColor = DEFAULT_TEXT_COLOR,
  mutedColor = DEFAULT_MUTED_COLOR,
}) {
  // 1. Single question + answer from TRAINER_CLIENT_PAYMENT_FAQ.
  return (
    <View style={styles.faqBox}>
      <Text style={[styles.faqQ, { color: textColor }]}>
        {TRAINER_CLIENT_PAYMENT_FAQ.question}
      </Text>
      <Text style={[styles.faqA, { color: mutedColor }]}>
        {TRAINER_CLIENT_PAYMENT_FAQ.answer}
      </Text>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  section: { width: '100%', marginBottom: 16 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'left',
    width: '100%',
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bulletIcon: { marginTop: 1, marginRight: 8 },
  bulletText: { flex: 1, lineHeight: 18 },
  previewLabel: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewStat: { fontSize: 18, fontWeight: '800' },
  previewMeta: { fontSize: 12, fontWeight: '600' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 2.5,
    gap: 6,
  },
  txDate: { width: 44, fontSize: 11, fontWeight: '600' },
  txName: { flex: 1, fontSize: 12, fontWeight: '600' },
  txAmount: { fontSize: 12, fontWeight: '700', width: 44, textAlign: 'right' },
  txStatus: { fontSize: 10, fontWeight: '800', width: 72, textAlign: 'right' },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  compareGrid: { flexDirection: 'row', gap: 8 },
  compareCol: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  compareColHighlight: { backgroundColor: 'rgba(255,20,147,0.08)' },
  compareHeading: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  compareLine: { fontSize: 11, lineHeight: 16, marginBottom: 4 },
  faqBox: {
    width: '100%',
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  faqQ: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  faqA: { fontSize: 12, lineHeight: 17 },
});
