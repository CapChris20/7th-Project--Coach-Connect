// Design Law weekly report body — client (progress PNG) + trainer (trainees PNG) layouts.
// Flow: week picker → summary/averages → sleep bars → days or wins/priorities → export.
// Used by WeeklyReportScreen after weeks are loaded. No Firestore here.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbPill from '../../look-and-feel/NbPill';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from './reportColorSettings';
import { WeekPicker } from './WeekPicker';
import { StatCard } from './StatCard';
import { WeeklyChart, SLEEP_GOAL_HOURS } from './WeeklyChart';
import { DayCard } from './DayCard';
import { TrainerTipsForWeek } from './TrainerTipsForWeek';
import { WinsAndWorkOnsSection } from './WinsAndWorkOnsSection';
import { TipRow } from './TipRow';
import { ReportOptionsPopup } from './ReportOptionsPopup';
import { pickBestTips } from './pickBestTips';

// ===== NAMED CONSTANTS =====

const DARK_MODE = 'dark';
const ENERGY_MAX = '8';
const SECTION_GAP = 24;
const MAX_FOCUS = 5;

// ===== HELPER FUNCTIONS =====

function reportIsUsingDarkColors(colorMode) {
  return colorMode === DARK_MODE;
}

function weekPickerTitle(weekIndex) {
  return weekIndex === 0 ? 'This week' : 'Earlier week';
}

function EyebrowRow({ left, right, colors }) {
  return (
    <View style={styles.eyebrowRow}>
      <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{left}</Text>
      {right ? <Text style={[styles.eyebrowRight, { color: colors.textMuted }]}>{right}</Text> : null}
    </View>
  );
}

function SleepTrendCard({ week, colors }) {
  return (
    <View style={styles.sectionPad}>
      <EyebrowRow left="Sleep trend" right={`Goal ${SLEEP_GOAL_HOURS} h`} colors={colors} />
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.chartCard,
            { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
          ]}
        >
          <WeeklyChart days={week.days} metricKey="sleepHours" valueSuffix="h" />
        </View>
      </HardShadow>
    </View>
  );
}

function ClientStatGrid({ week }) {
  const display = week.stats?.display || {};
  return (
    <View style={styles.statsGrid}>
      <StatCard testID="stat-card-sleep" label="Sleep" value={display.sleep} suffix="h" />
      <StatCard
        testID="stat-card-energy"
        label="Energy"
        value={display.energy}
        max={ENERGY_MAX}
      />
      <StatCard label="Soreness" value={display.soreness} max={ENERGY_MAX} />
      <StatCard label="Stress" value={display.stress} max={ENERGY_MAX} />
      <StatCard label="Weight" value={display.weight} suffix="lb" />
      <StatCard label="Workout adherence" value={display.adherence} suffix="%" />
    </View>
  );
}

function TrainerStatGrid({ week }) {
  const display = week.stats?.display || {};
  return (
    <View style={styles.statsGrid}>
      <StatCard testID="stat-card-sleep" label="Avg sleep" value={display.sleep} suffix="h" />
      <StatCard testID="stat-card-water" label="Avg water" value={display.waterCups || display.water} suffix="cups" />
      <StatCard testID="stat-card-energy" label="Avg energy" value={display.energy} max={ENERGY_MAX} />
      <StatCard testID="stat-card-steps" label="Avg steps" value={display.steps} />
    </View>
  );
}

function DailyBreakdownCard({ days, colors }) {
  if (!days?.length) return null;
  return (
    <View style={styles.sectionPad}>
      <EyebrowRow left="Daily breakdown" colors={colors} />
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.listCard,
            { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
          ]}
        >
          {days.map((day, dayIndex) => (
            <DayCard
              key={day.date || `day-${dayIndex}`}
              day={day}
              index={dayIndex}
              showDivider={dayIndex < days.length - 1}
            />
          ))}
        </View>
      </HardShadow>
    </View>
  );
}

function ReadyBanner({ colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.readyWrap}>
      <View style={[styles.readyCard, { backgroundColor: colors.fill, borderColor: colors.border }]}>
        <View style={styles.readyLeft}>
          <View style={[styles.readyDot, { backgroundColor: colors.onFill }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.readyTitle, { color: colors.onFill }]}>Week in review</Text>
            <Text style={[styles.readySub, { color: colors.onFill, opacity: 0.75 }]}>
              Updated automatically after check-ins each week
            </Text>
          </View>
        </View>
        <View style={[styles.readyPill, { backgroundColor: accentGradients[2][0] }]}>
          <Text style={styles.readyPillText}>Ready</Text>
        </View>
      </View>
    </HardShadow>
  );
}

function TrainerWinsAndPriorities({ week, colors }) {
  const wins = pickBestTips(week.pros || [], MAX_FOCUS);
  const priorities = pickBestTips(week.cons || week.focus || [], MAX_FOCUS);
  return (
    <View style={{ gap: SECTION_GAP }}>
      {wins.length ? (
        <View style={styles.sectionPad}>
          <View style={styles.eyebrowRow}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>What went well</Text>
            <NbPill variant="plain">Wins</NbPill>
          </View>
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
            <View
              style={[
                styles.listCard,
                { borderColor: colors.border, backgroundColor: colors.surfacePrimary, gap: spacing.sm + 2 },
              ]}
            >
              {wins.map((text, i) => (
                <View key={`win-${i}`} style={styles.bulletRow}>
                  <View style={[styles.bullet, { backgroundColor: colors.fill, borderColor: colors.border }]} />
                  <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{text}</Text>
                </View>
              ))}
            </View>
          </HardShadow>
        </View>
      ) : null}

      <View style={styles.sectionPad}>
        <EyebrowRow left="Coaching priorities" right="Your focus" colors={colors} />
        <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
          <View
            style={[
              styles.listCard,
              { borderColor: colors.border, backgroundColor: colors.surfacePrimary, gap: spacing.md },
            ]}
          >
            {priorities.map((text, i) => (
              <TipRow key={`pri-${i}`} index={i + 1} text={text} />
            ))}
            <Pressable
              style={[
                styles.addPriority,
                { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
              ]}
            >
              <Ionicons name="add" size={18} color={colors.textPrimary} />
              <Text style={[styles.addPriorityText, { color: colors.textPrimary }]}>Add a priority</Text>
            </Pressable>
          </View>
        </HardShadow>
      </View>
    </View>
  );
}

function TrainerSignOff({ week, clientName, colors, onExport }) {
  const signOff = String(week.signOff || '').trim();
  const firstName = String(clientName || week.clientName || 'client').split(' ')[0] || 'client';
  return (
    <View style={[styles.sectionPad, { gap: spacing.md }]}>
      <EyebrowRow left="Sign-off" colors={colors} />
      {signOff ? (
        <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
          <View
            style={[
              styles.listCard,
              { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
            ]}
          >
            <Text style={[styles.signOff, { color: colors.textPrimary }]}>{signOff}</Text>
          </View>
        </HardShadow>
      ) : null}
      <Text style={[styles.generated, { color: colors.textMuted }]}>
        Generated from logged check-ins (no AI). Keep logging daily for sharper trends next week.
      </Text>
      <NbButton variant="fill" onPress={onExport}>
        {`Send to ${firstName}`}
      </NbButton>
      <NbButton variant="ghost" onPress={onExport}>
        Open weekly report
      </NbButton>
    </View>
  );
}

function ClientExportButton({ onExport, onOpenSettings }) {
  return (
    <View style={[styles.sectionPad, { marginTop: SECTION_GAP, gap: spacing.sm }]}>
      <NbButton
        variant="ghost"
        onPress={() => {
          if (typeof onExport === 'function') onExport();
          else onOpenSettings?.();
        }}
      >
        Export weekly report
      </NbButton>
    </View>
  );
}

// ===== SCREEN LAYOUT =====

function WeeklyReportScrollLayout({
  week,
  weeks,
  weekIndex,
  colors,
  colorMode,
  clientDisplayName,
  isClientSelfView,
  onPreviousWeek,
  onNextWeek,
  onOpenSettings,
  onCloseSettings,
  settingsPopupIsOpen,
  onExport,
  contentBottomPad,
}) {
  const usingDarkColors = reportIsUsingDarkColors(colorMode);
  const phoneStatusBarStyle = usingDarkColors ? 'light' : 'dark';
  const canGoToOlderWeek = weekIndex < weeks.length - 1;
  const canGoToNewerWeek = weekIndex > 0;
  const scrollContentStyle = [styles.scrollContent, { paddingBottom: contentBottomPad }];
  const allDays = week.days || [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="weekly-report-screen">
      <StatusBar style={phoneStatusBarStyle} />

      <WeekPicker
        label={week.label}
        title={weekPickerTitle(weekIndex)}
        canPrev={canGoToOlderWeek}
        canNext={canGoToNewerWeek}
        onPrev={onPreviousWeek}
        onNext={onNextWeek}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
      >
        {isClientSelfView ? (
          <>
            <TrainerTipsForWeek week={week} />
            <ClientStatGrid week={week} />
            <SleepTrendCard week={week} colors={colors} />
            <DailyBreakdownCard days={allDays} colors={colors} />
            <WinsAndWorkOnsSection week={week} animationKey={`coaching-${week.id}-${colorMode}`} />
            <ClientExportButton onExport={onOpenSettings} onOpenSettings={onOpenSettings} />
          </>
        ) : (
          <>
            {clientDisplayName ? (
              <Text style={[styles.clientLine, { color: colors.textMuted }]}>
                {`${clientDisplayName} · ${week.label}`}
              </Text>
            ) : null}
            <View style={styles.sectionPad}>
              <ReadyBanner colors={colors} />
            </View>
            <View style={styles.sectionPad}>
              <EyebrowRow left="Week averages" colors={colors} />
            </View>
            <TrainerStatGrid week={week} />
            <View style={styles.sectionPad}>
              <EyebrowRow left="Weekly trends" right="Sleep rhythm" colors={colors} />
              <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
                <View
                  style={[
                    styles.chartCard,
                    { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
                  ]}
                >
                  <WeeklyChart days={week.days} metricKey="sleepHours" valueSuffix="h" />
                  <Text style={[styles.chartCaption, { color: colors.textMuted }]}>
                    Seven-day breakdown from their daily check-ins. Dashed line is 8 hours.
                  </Text>
                </View>
              </HardShadow>
            </View>
            <TrainerWinsAndPriorities week={week} colors={colors} />
            <TrainerSignOff
              week={week}
              clientName={clientDisplayName}
              colors={colors}
              onExport={onExport}
            />
          </>
        )}
      </ScrollView>

      <ReportOptionsPopup
        visible={settingsPopupIsOpen}
        onClose={onCloseSettings}
        onExport={onExport}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

export function WeeklyReportBody({
  weeks,
  weekIndex,
  onWeekIndexChange,
  clientName = '',
  isClientSelfView = true,
  onExport,
  openOptionsSignal = 0,
  contentBottomPad = 32,
}) {
  const { colors, mode } = useTheme();
  const [settingsPopupIsOpen, setSettingsPopupIsOpen] = useState(false);

  // Header “…” bumps openOptionsSignal — open the same Design Law options sheet
  useEffect(() => {
    if (!openOptionsSignal) return undefined;
    setSettingsPopupIsOpen(true);
    return undefined;
  }, [openOptionsSignal]);

  const week = weeks[weekIndex];
  if (!week) return null;

  const clientDisplayName = clientName || week.clientName || '';
  const olderWeekExists = weekIndex < weeks.length - 1;
  const newerWeekExists = weekIndex > 0;

  function showOlderWeek() {
    if (olderWeekExists) onWeekIndexChange(weekIndex + 1);
  }

  function showNewerWeek() {
    if (newerWeekExists) onWeekIndexChange(weekIndex - 1);
  }

  return (
    <WeeklyReportScrollLayout
      week={week}
      weeks={weeks}
      weekIndex={weekIndex}
      colors={colors}
      colorMode={mode}
      clientDisplayName={clientDisplayName}
      isClientSelfView={isClientSelfView}
      onPreviousWeek={showOlderWeek}
      onNextWeek={showNewerWeek}
      onOpenSettings={() => setSettingsPopupIsOpen(true)}
      onCloseSettings={() => setSettingsPopupIsOpen(false)}
      settingsPopupIsOpen={settingsPopupIsOpen}
      onExport={onExport}
      contentBottomPad={contentBottomPad}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: spacing.xs, gap: 0 },
  clientLine: {
    paddingHorizontal: nb.screenGutter,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  sectionPad: {
    paddingHorizontal: nb.screenGutter,
    marginTop: SECTION_GAP,
    gap: spacing.sm,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  eyebrowRight: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statsGrid: {
    paddingHorizontal: nb.screenGutter,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  chartCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: nb.cardPadding,
    overflow: 'hidden',
  },
  chartCaption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  listCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingHorizontal: nb.cardPadding,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  readyWrap: { width: '100%' },
  readyCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: nb.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  readyLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  readyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  readyTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  readySub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  readyPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    borderColor: '#0A0A0A',
  },
  readyPillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0A0A',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    paddingVertical: 4,
  },
  bullet: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: nb.borderWidth,
    marginTop: 3,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  addPriority: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: nb.minTouchTarget,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
  },
  addPriorityText: {
    fontSize: 14,
    fontWeight: '800',
  },
  signOff: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    paddingVertical: spacing.sm,
  },
  generated: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
