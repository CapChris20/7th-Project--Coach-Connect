/**
 * Reusable payment education UI — how payments work, Venmo comparison, earnings preview.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  HOW_PAYMENTS_WORK,
  VENMO_VS_COACHCONNECT,
  TRAINER_CLIENT_PAYMENT_FAQ,
  EARNINGS_MOCK,
  formatPaymentDollars,
} from './paymentEducationCopy';

export function HowPaymentsWorkSection({ compact = false, textColor = '#FFFFFF', mutedColor = 'rgba(255,255,255,0.6)' }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>How payments work</Text>
      {HOW_PAYMENTS_WORK.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <Ionicons name="checkmark-circle" size={16} color="#34D399" style={styles.bulletIcon} />
          <Text style={[styles.bulletText, { color: mutedColor, fontSize: compact ? 12 : 13 }]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function EarningsDashboardPreview({
  textColor = '#FFFFFF',
  mutedColor = 'rgba(255,255,255,0.55)',
  borderColor = 'rgba(255,255,255,0.1)',
}) {
  return (
    <View style={[styles.previewCard, { borderColor }]}>
      <Text style={[styles.previewLabel, { color: mutedColor }]}>After your first client pays, you will see:</Text>
      <View style={styles.previewRow}>
        <Text style={[styles.previewStat, { color: textColor }]}>{EARNINGS_MOCK.pendingLabel}</Text>
        <Text style={[styles.previewMeta, { color: mutedColor }]}>Next payout: {EARNINGS_MOCK.nextPayout}</Text>
      </View>
      {EARNINGS_MOCK.transactions.map((row) => (
        <View key={`${row.date}-${row.name}`} style={[styles.txRow, { borderTopColor: borderColor }]}>
          <Text style={[styles.txDate, { color: mutedColor }]}>{row.date}</Text>
          <Text style={[styles.txName, { color: textColor }]} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={[styles.txAmount, { color: textColor }]}>{formatPaymentDollars(row.amount)}</Text>
          <Text
            style={[
              styles.txStatus,
              { color: row.status === 'Completed' ? '#34D399' : '#FBBF24' },
            ]}
          >
            {row.status}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function VenmoComparisonSection({
  textColor = '#FFFFFF',
  mutedColor = 'rgba(255,255,255,0.6)',
  borderColor = 'rgba(255,255,255,0.1)',
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.collapseHeader} onPress={() => setOpen((v) => !v)} activeOpacity={0.85}>
        <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>
          Coach Connect vs Venmo
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={mutedColor} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.compareGrid}>
          <View style={[styles.compareCol, { borderColor }]}>
            <Text style={[styles.compareHeading, { color: mutedColor }]}>Venmo</Text>
            {VENMO_VS_COACHCONNECT.venmo.map((line) => (
              <Text key={line} style={[styles.compareLine, { color: mutedColor }]}>
                • {line}
              </Text>
            ))}
          </View>
          <View style={[styles.compareCol, styles.compareColHighlight, { borderColor: '#FF1493' }]}>
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

export function TrainerPaymentFaqSnippet({ textColor = '#FFFFFF', mutedColor = 'rgba(255,255,255,0.6)' }) {
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  faqQ: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  faqA: { fontSize: 12, lineHeight: 17 },
});
