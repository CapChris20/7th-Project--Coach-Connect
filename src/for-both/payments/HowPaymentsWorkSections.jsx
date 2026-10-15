// Reusable payment education UI — how payments work, Venmo comparison, earnings preview.
// Flow: bullet list of how payouts work → mock earnings card → optional Venmo vs Coach Connect grid → FAQ.
// Used by: earnings screen, payout reminder popup, and trainer payout setup.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  HOW_PAYMENTS_WORK,
  VENMO_VS_COACHCONNECT,
  TRAINER_CLIENT_PAYMENT_FAQ,
  EARNINGS_MOCK,
  formatPaymentDollars,
} from './howPaymentsWorkText';

// ===== NAMED CONSTANTS =====

const DEFAULT_TEXT_COLOR = '#FFFFFF';
const DEFAULT_MUTED_COLOR = 'rgba(255,255,255,0.6)';
const DEFAULT_MUTED_PREVIEW = 'rgba(255,255,255,0.55)';
const DEFAULT_BORDER_COLOR = 'rgba(255,255,255,0.1)';
const DEFAULT_SURFACE_COLOR = 'rgba(255,255,255,0.04)';
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

// ===== HELPER FUNCTIONS =====

/**
 * Completed payouts are green; anything else (pending) is amber.
 * @param {string} status
 * @returns {string}
 */
function transactionStatusColor(status) {
  return status === STATUS_COMPLETED ? STATUS_COMPLETED_COLOR : STATUS_PENDING_COLOR;
}

/**
 * @param {boolean} compact
 * @returns {number}
 */
function bulletFontSize(compact) {
  return compact ? COMPACT_BULLET_SIZE : REGULAR_BULLET_SIZE;
}

// ===== MAIN FUNCTION =====

/**
 * Checklist of how Coach Connect payments work.
 * @param {{ compact?: boolean, textColor?: string, mutedColor?: string }} props
 */
export function HowPaymentsWorkSection({
  compact = false,
  textColor = DEFAULT_TEXT_COLOR,
  mutedColor = DEFAULT_MUTED_COLOR,
}) {
  // 1. Draw the checklist of how payouts work (90% trainer / 10% platform).
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>How payments work</Text>
      {HOW_PAYMENTS_WORK.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <Ionicons name={ICON_CHECK} size={16} color={CHECK_ICON_COLOR} style={styles.bulletIcon} />
          <Text style={[styles.bulletText, { color: mutedColor, fontSize: bulletFontSize(compact) }]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Fake earnings rows so a trainer who has not been paid yet can see what the dashboard will look like.
 * @param {{ textColor?: string, mutedColor?: string, borderColor?: string, surfaceColor?: string }} props
 */
export function EarningsDashboardPreview({
  textColor = DEFAULT_TEXT_COLOR,
  mutedColor = DEFAULT_MUTED_PREVIEW,
  borderColor = DEFAULT_BORDER_COLOR,
  surfaceColor = DEFAULT_SURFACE_COLOR,
}) {
  // 1. Fake pending total + three example rows so a new trainer can see the dashboard.
  return (
    <View style={[styles.previewCard, { borderColor, backgroundColor: surfaceColor }]}>
      <Text style={[styles.previewLabel, { color: mutedColor }]}>After your first client pays, you will see:</Text>
      <View style={styles.previewRow}>
        <Text style={[styles.previewStat, { color: textColor }]}>{EARNINGS_MOCK.pendingLabel}</Text>
        <Text style={[styles.previewMeta, { color: mutedColor }]}>Next payout: {EARNINGS_MOCK.nextPayout}</Text>
      </View>
      {EARNINGS_MOCK.transactions.map((transaction) => (
        <View key={`${transaction.date}-${transaction.name}`} style={[styles.txRow, { borderTopColor: borderColor }]}>
          <Text style={[styles.txDate, { color: mutedColor }]}>{transaction.date}</Text>
          <Text style={[styles.txName, { color: textColor }]} numberOfLines={1}>
            {transaction.name}
          </Text>
          <Text style={[styles.txAmount, { color: textColor }]}>{formatPaymentDollars(transaction.amount)}</Text>
          <Text
            style={[
              styles.txStatus,
              { color: transactionStatusColor(transaction.status) },
            ]}
          >
            {transaction.status}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Collapsed by default. Open to compare Venmo vs Coach Connect side by side.
 * @param {{ textColor?: string, mutedColor?: string, borderColor?: string }} props
 */
export function VenmoComparisonSection({
  textColor = DEFAULT_TEXT_COLOR,
  mutedColor = DEFAULT_MUTED_COLOR,
  borderColor = DEFAULT_BORDER_COLOR,
}) {
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  const toggleComparisonOpen = () => {
    // 1. Flip the Venmo vs Coach Connect grid open or closed.
    setIsComparisonOpen((isCurrentlyOpen) => !isCurrentlyOpen);
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.collapseHeader}
        onPress={toggleComparisonOpen}
        activeOpacity={0.85}
      >
        <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>
          Coach Connect vs Venmo
        </Text>
        <Ionicons name={isComparisonOpen ? ICON_CHEVRON_UP : ICON_CHEVRON_DOWN} size={18} color={mutedColor} />
      </TouchableOpacity>
      {isComparisonOpen ? (
        <View style={styles.compareGrid}>
          <View style={[styles.compareCol, { borderColor }]}>
            <Text style={[styles.compareHeading, { color: mutedColor }]}>Venmo</Text>
            {VENMO_VS_COACHCONNECT.venmo.map((line) => (
              <Text key={line} style={[styles.compareLine, { color: mutedColor }]}>
                • {line}
              </Text>
            ))}
          </View>
          <View style={[styles.compareCol, styles.compareColHighlight, { borderColor: HIGHLIGHT_BORDER }]}>
            <Text style={[styles.compareHeading, { color: textColor }]}>Coach Connect</Text>
            {VENMO_VS_COACHCONNECT.coachConnect.map((line) => (
              <Text key={line} style={[styles.compareLine, { color: mutedColor }]}>
                • {line}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One trainer/client payment FAQ pulled from the shared copy file.
 * @param {{ textColor?: string, mutedColor?: string }} props
 */
export function TrainerPaymentFaqSnippet({
  textColor = DEFAULT_TEXT_COLOR,
  mutedColor = DEFAULT_MUTED_COLOR,
}) {
  // 1. One FAQ: tell clients to pay in the app, not Venmo.
  return (
    <View style={styles.faqBox}>
      <Text style={[styles.faqQ, { color: textColor }]}>{TRAINER_CLIENT_PAYMENT_FAQ.question}</Text>
      <Text style={[styles.faqA, { color: mutedColor }]}>{TRAINER_CLIENT_PAYMENT_FAQ.answer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10, textAlign: 'left', width: '100%' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bulletIcon: { marginTop: 1, marginRight: 8 },
  bulletText: { flex: 1, lineHeight: 18 },
  previewCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  previewLabel: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  previewStat: { fontSize: 18, fontWeight: '800' },
  previewMeta: { fontSize: 12, fontWeight: '600' },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
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
  compareHeading: { fontSize: 12, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' },
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
