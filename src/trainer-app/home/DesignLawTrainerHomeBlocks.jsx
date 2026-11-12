// Design Law Trainer Home blocks — layout matches docs/design/Design-Law/screens/trainer-home.
// Flow: header → motivation → needs you → client carousel → (parent paints tabs) → tools → weekly report.
// Used only by TrainerHomeContent. Nb* + handoff assets; no parallel chrome system.

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbIconChip from '../../look-and-feel/NbIconChip';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import {
  darkColors,
  lightColors,
  navAccentGradient,
  nb,
} from '../../look-and-feel/colorPalette';
import { getClientInitials, getClientRosterStats } from './trainerHomePieces';

// ===== NAMED CONSTANTS =====

const HANDOFF_WORKOUT = require('../../assets/icons/handoff/workout.png');
const HANDOFF_PEOPLE = require('../../assets/icons/handoff/people.png');
const HANDOFF_CHECKIN = require('../../assets/icons/handoff/checkin.png');
const HANDOFF_WEEK = require('../../assets/icons/handoff/week.png');
const HANDOFF_PICTURE = require('../../assets/icons/handoff/picture.png');
const HANDOFF_JOURNEY = require('../../assets/icons/handoff/journey.png');
const HANDOFF_LIFTER_LOTTIE = require('../../assets/animations/handoff/zlifter-noyellow.json');

// Manipulate here: client carousel — wide enough that Sleep/Steps don’t clip; next card peeks.
const CLIENT_CHIP_MIN_WIDTH = 248;
const CLIENT_CHIP_MAX_WIDTH = 300;
const CLIENT_CHIP_PEEK = 48;
const CLIENT_CHIP_GAP = 12;
const CLIENT_CHIP_MIN_HEIGHT = 176;

// ===== THEME =====

/** B/W/gray surfaces for trainer home (mirrors client Design Law tokens). */
export function trainerHomeThemeColors(isDark) {
  const c = isDark ? darkColors : lightColors;
  return {
    solidBg: c.nbBackground,
    cardBg: c.nbSurface,
    cardBorder: c.nbBorder,
    text: c.nbInk,
    textMuted: c.nbMuted,
    fill: c.nbFill,
    onFill: c.nbOnFill,
    pillBg: c.nbSurfaceChip,
    pillBorder: c.nbBorder,
    shadow: c.nbShadow,
  };
}

// ===== HELPERS =====

function firstNameFromDisplay(name) {
  const trimmed = String(name || '').trim();
  return trimmed.split(/\s+/)[0] || 'Trainer';
}

function initialsFromName(name) {
  return getClientInitials(name || 'Trainer');
}

function dayPartLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function formatSteps(steps) {
  const n = Number(steps);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toLocaleString();
}

function clientStatusLabel(hasWeekly, hints) {
  if (hints?.loggedToday) return 'Logged today';
  if (hasWeekly) return 'Weekly ready';
  return 'Tap to view';
}

// ===== SECTION HEADER =====

export function DesignLawTrainerSectionHeader({ label, right, themeColors }) {
  return (
    <View style={styles.secRow}>
      <Text style={[styles.secLabel, { color: themeColors.textMuted }]}>{String(label || '').toUpperCase()}</Text>
      {right || null}
    </View>
  );
}

// ===== HEADER + MOTIVATION (PNG 01 — .hi + .quote) =====

export function DesignLawTrainerHeader({
  themeColors,
  userName,
  greetingPeriod,
  onNotificationsPress,
}) {
  const firstName = firstNameFromDisplay(userName);
  const period = String(greetingPeriod || dayPartLabel());
  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <View style={styles.hi}>
      <LinearGradient
        colors={navAccentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.sqAv, { borderColor: themeColors.cardBorder }]}
      >
        <Text style={[styles.sqAvText, { color: lightColors.nbInk }]}>{initialsFromName(userName)}</Text>
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13, color: themeColors.textMuted }}>
          {`${weekday} ${period}`}
        </Text>
        <Text style={{ fontSize: 19, fontWeight: '900', letterSpacing: -0.3, color: themeColors.text }}>
          {`Good ${period}, ${firstName}`}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityLabel="Notifications"
        onPress={onNotificationsPress}
        style={[styles.sqBell, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}
      >
        <Ionicons name="notifications-outline" size={22} color={themeColors.text} />
      </TouchableOpacity>
    </View>
  );
}

export function DesignLawTrainerMotivationCard({ themeColors, quoteText, quoteAuthor }) {
  const line = String(quoteText || 'Keep showing up.').trim();
  const author = String(quoteAuthor || '').trim();

  return (
    <HardShadow offset={nb.shadowOffsetHero} radius={10} style={{ marginBottom: nb.blockGap }}>
      <View
        style={[
          styles.quoteCard,
          {
            backgroundColor: themeColors.fill,
            borderColor: themeColors.cardBorder,
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <Text style={[styles.quoteBody, { color: themeColors.onFill }]} numberOfLines={4}>
            {line}
          </Text>
          {author ? (
            <Text style={[styles.quoteAuthor, { color: themeColors.onFill }]} numberOfLines={1}>
              {`— ${author}`}
            </Text>
          ) : null}
          <Text style={[styles.quoteKicker, { color: themeColors.onFill }]}>Daily motivation</Text>
        </View>
        <LottieView source={HANDOFF_LIFTER_LOTTIE} autoPlay loop style={{ width: 84, height: 84 }} />
      </View>
    </HardShadow>
  );
}

// ===== NEEDS YOU (PNG 01, 07 — payout + request rows) =====

function NeedsYouCountBadge({ count, themeColors }) {
  if (!count || count < 1) return null;
  return (
    <View style={[styles.cntBadge, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.fill }]}>
      <Text style={[styles.cntBadgeText, { color: themeColors.onFill }]}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

function NeedsYouRow({ iconSource, iconIndex, title, subtitle, right, onPress, themeColors }) {
  const inner = (
    <View style={[styles.needRow, { borderTopColor: themeColors.cardBorder }]}>
      <NbIconChip source={iconSource} index={iconIndex} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.needTitle, { color: themeColors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.needSub, { color: themeColors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right || <Ionicons name="chevron-forward" size={18} color={themeColors.text} />}
    </View>
  );

  if (typeof onPress === 'function') {
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={onPress} accessibilityRole="button">
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

export function DesignLawTrainerNeedsYou({
  themeColors,
  needsCount,
  showPayoutBlock,
  stripeConnectStatus,
  pendingRequestsCount,
  unreadMessageCount,
  payoutSubcopy,
  onOpenPayments,
  onClientRequestsPress,
  onMessagesPress,
}) {
  const payoutTitle =
    stripeConnectStatus === 'pending'
      ? 'Payout verification in progress'
      : 'Complete payout setup to accept clients';

  return (
    <View style={{ marginBottom: nb.blockGap }}>
      <DesignLawTrainerSectionHeader
        label="Needs you"
        themeColors={themeColors}
        right={<NeedsYouCountBadge count={needsCount} themeColors={themeColors} />}
      />
      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <View style={[styles.needShell, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}>
          {showPayoutBlock ? (
            <View style={[styles.needPayout, { backgroundColor: themeColors.fill }]}>
              <Text style={[styles.needPayoutTitle, { color: themeColors.onFill }]}>{payoutTitle}</Text>
              {payoutSubcopy ? (
                <Text style={[styles.needPayoutSub, { color: themeColors.onFill }]}>{payoutSubcopy}</Text>
              ) : null}
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onOpenPayments}
                style={[
                  styles.needPayoutBtn,
                  {
                    borderColor: themeColors.onFill,
                    backgroundColor: themeColors.onFill,
                  },
                ]}
              >
                <Text style={{ color: themeColors.fill, fontSize: 14, fontWeight: '900' }}>
                  {stripeConnectStatus === 'pending' ? 'Manage payouts' : 'Set up payouts'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {pendingRequestsCount > 0 ? (
            <NeedsYouRow
              themeColors={themeColors}
              iconSource={HANDOFF_PEOPLE}
              iconIndex={1}
              title={`${pendingRequestsCount} new client request${pendingRequestsCount === 1 ? '' : 's'}`}
              subtitle="Tap to review and approve"
              right={
                <View style={[styles.cntBadge, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.fill }]}>
                  <Text style={[styles.cntBadgeText, { color: themeColors.onFill }]}>{pendingRequestsCount}</Text>
                </View>
              }
              onPress={onClientRequestsPress}
            />
          ) : null}

          {unreadMessageCount > 0 ? (
            <NeedsYouRow
              themeColors={themeColors}
              iconSource={HANDOFF_JOURNEY}
              iconIndex={4}
              title="New client messages"
              subtitle={`${unreadMessageCount} unread — open inbox`}
              onPress={onMessagesPress}
            />
          ) : null}

          {!showPayoutBlock && pendingRequestsCount < 1 && unreadMessageCount < 1 ? (
            <View style={{ padding: 14 }}>
              <Text style={{ fontSize: 14, color: themeColors.textMuted, textAlign: 'center' }}>
                You&apos;re caught up. New requests and messages will show here.
              </Text>
            </View>
          ) : null}
        </View>
      </HardShadow>
    </View>
  );
}

// ===== CLIENT CAROUSEL (PNG 01, 03 — .hs3 .chip.cc) =====

export function DesignLawTrainerClientCarousel({
  themeColors,
  clients,
  selectedClientId,
  weeklySummaryMap,
  dailyHints = {},
  onSelectClient,
  onRemoveClient,
}) {
  const { width: windowWidth } = useWindowDimensions();
  // Leave gutter + peek of the next card (PNG 01/03 carousel feel).
  const clientChipWidth = Math.max(
    CLIENT_CHIP_MIN_WIDTH,
    Math.min(CLIENT_CHIP_MAX_WIDTH, Math.round(windowWidth - nb.screenGutter * 2 - CLIENT_CHIP_PEEK)),
  );
  const total = clients?.length || 0;
  const sub = total > 0 ? `${total} active · swipe` : '';

  if (total === 0) {
    return (
      <View style={{ marginBottom: nb.blockGap }}>
        <DesignLawTrainerSectionHeader label="Your clients" right={<Text style={{ fontSize: 12, color: themeColors.textMuted }}>{sub}</Text>} themeColors={themeColors} />
        <HardShadow offset={nb.shadowOffsetCard} radius={10}>
          <View style={[styles.emptyClients, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}>
            <NbIconChip source={HANDOFF_PEOPLE} index={2} size={44} />
            <Text style={{ fontSize: 16, fontWeight: '900', color: themeColors.text }}>No clients yet</Text>
            <Text style={{ fontSize: 13, color: themeColors.textMuted, textAlign: 'center', lineHeight: 18 }}>
              Approve requests from Client Requests — each client appears here.
            </Text>
          </View>
        </HardShadow>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: nb.blockGap }}>
      <DesignLawTrainerSectionHeader
        label="Your clients"
        themeColors={themeColors}
        right={<Text style={{ fontSize: 12, fontWeight: '800', color: themeColors.textMuted }}>{sub}</Text>}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselScroll}
        decelerationRate="fast"
        snapToInterval={clientChipWidth + CLIENT_CHIP_GAP}
      >
        {clients.map((client, index) => {
          const selected = client.id === selectedClientId;
          const stats = getClientRosterStats(client);
          const displayName = client.name || client.displayName || 'Client';
          const hasWeekly = !!weeklySummaryMap[client.id];
          const hints = dailyHints[client.id] || {};
          const goalLine = [stats.goal, client.experience || client.level].filter(Boolean).join(' · ');
          const surface = selected ? themeColors.fill : themeColors.cardBg;
          const ink = selected ? themeColors.onFill : themeColors.text;
          const muted = selected ? themeColors.onFill : themeColors.textMuted;
          const radius =
            index % 2 === 1
              ? { borderTopLeftRadius: 10, borderTopRightRadius: 26, borderBottomRightRadius: 10, borderBottomLeftRadius: 10 }
              : { borderRadius: 10 };

          return (
            <View
              key={client.id}
              style={{ width: clientChipWidth, marginRight: CLIENT_CHIP_GAP, position: 'relative' }}
            >
              <HardShadow offset={nb.shadowOffsetSmall} radius={10}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => onSelectClient?.(client.id)}
                  style={[
                    styles.clientChip,
                    radius,
                    {
                      backgroundColor: surface,
                      borderColor: themeColors.cardBorder,
                      minHeight: CLIENT_CHIP_MIN_HEIGHT,
                    },
                  ]}
                >
                  <View style={styles.clientChipTop}>
                    <NbAvatar
                      initials={getClientInitials(displayName)}
                      size={40}
                      style={selected ? { borderColor: themeColors.onFill } : undefined}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.clientName, { color: ink }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      {goalLine ? (
                        <Text style={[styles.clientGoal, { color: muted, opacity: selected ? 0.85 : 1 }]} numberOfLines={2}>
                          {goalLine}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View
                    style={[
                      styles.whyPill,
                      {
                        borderColor: ink,
                      },
                    ]}
                  >
                    <Text style={[styles.whyPillText, { color: ink }]} numberOfLines={1}>
                      {clientStatusLabel(hasWeekly, hints)}
                    </Text>
                  </View>
                  <View style={styles.statPair}>
                    {[
                      { cap: 'Sleep', val: hints.sleep != null ? `${hints.sleep} h` : '—' },
                      { cap: 'Steps', val: formatSteps(hints.steps) },
                    ].map((cell) => (
                      <View key={cell.cap} style={[styles.statCell, { borderColor: ink }]}>
                        <Text style={[styles.statCap, { color: muted }]}>{cell.cap}</Text>
                        <Text style={[styles.statVal, { color: ink }]} numberOfLines={1}>
                          {cell.val}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              </HardShadow>
              {typeof onRemoveClient === 'function' ? (
                <TouchableOpacity
                  accessibilityLabel={`Options for ${displayName}`}
                  onPress={() => onRemoveClient(client)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.clientMore,
                    {
                      backgroundColor: themeColors.cardBg,
                      borderColor: themeColors.cardBorder,
                    },
                  ]}
                >
                  <Ionicons name="ellipsis-horizontal" size={16} color={themeColors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function DesignLawTrainerClientTodayLabel({ clientName, themeColors }) {
  const name = String(clientName || 'Client').trim() || 'Client';
  return (
    <Text style={[styles.todayEyebrow, { color: themeColors.textMuted }]}>
      <Text style={{ color: themeColors.text, fontWeight: '900' }}>{name}</Text>
      {' · today'}
    </Text>
  );
}

// ===== TOOLS GRID (PNG 01, 03 — .tools) =====

const TOOL_DEFS = [
  { key: 'aiPlans', label: 'Workout plans', icon: HANDOFF_WORKOUT },
  { key: 'messages', label: 'Messages', icon: HANDOFF_PEOPLE },
  { key: 'document', label: 'Document maker', icon: HANDOFF_CHECKIN },
  { key: 'spreadsheet', label: 'Spreadsheet creator', icon: HANDOFF_WEEK },
  { key: 'photos', label: 'Progress photos', icon: HANDOFF_PICTURE },
  { key: 'notes', label: 'Client notes & files', icon: HANDOFF_JOURNEY },
];

export function DesignLawTrainerToolsGrid({ themeColors, onToolPress, messageBadge }) {
  return (
    // Manipulate here: top margin clears the 4 client tabs above Tools
    <View style={{ marginTop: 28, marginBottom: nb.blockGap }}>
      <DesignLawTrainerSectionHeader label="Tools" themeColors={themeColors} />
      <View style={styles.toolsGrid}>
        {TOOL_DEFS.map((tool, idx) => (
          <HardShadow key={tool.key} offset={nb.shadowOffsetSmall} radius={10} style={styles.toolShadow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onToolPress?.(tool.key)}
              style={[
                styles.toolTile,
                {
                  backgroundColor: themeColors.cardBg,
                  borderColor: themeColors.cardBorder,
                },
              ]}
            >
              <NbIconChip source={tool.icon} index={idx * 3} size={40} />
              <Text style={[styles.toolLabel, { color: themeColors.text }]} numberOfLines={2}>
                {tool.label}
              </Text>
              {tool.key === 'messages' && messageBadge > 0 ? (
                <View style={[styles.toolBadge, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.fill }]}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: themeColors.onFill }}>
                    {messageBadge > 99 ? '99+' : messageBadge}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </HardShadow>
        ))}
      </View>
    </View>
  );
}

// ===== WEEKLY REPORT (PNG 01, 03 — .wr grid + adherence) =====

export function DesignLawTrainerWeeklyReportPanel({
  themeColors,
  loading,
  hasReport,
  weekRangeLabel,
  clientsLogged,
  clientsTotal,
  adherencePct,
  metricCells,
  onOpenReport,
}) {
  const cells = metricCells?.length
    ? metricCells
    : [
        { value: '—', label: 'Sessions done' },
        { value: clientsTotal ? `${clientsLogged}/${clientsTotal}` : '—', label: 'Clients logged' },
        { value: '—', label: 'Avg protein' },
        { value: '—', label: 'Avg sleep' },
      ];

  const adherence = typeof adherencePct === 'number' ? Math.min(1, Math.max(0, adherencePct)) : null;

  return (
    <View style={{ marginBottom: nb.blockGap }}>
      <DesignLawTrainerSectionHeader
        label="Weekly report"
        themeColors={themeColors}
        right={
          <TouchableOpacity
            onPress={onOpenReport}
            disabled={loading || !hasReport}
            style={[
              styles.openChip,
              {
                borderColor: themeColors.cardBorder,
                backgroundColor: themeColors.pillBg,
                opacity: loading || !hasReport ? 0.55 : 1,
              },
            ]}
          >
            <Text style={{ fontSize: 13, fontWeight: '900', color: themeColors.text }}>Open report</Text>
          </TouchableOpacity>
        }
      />
      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <View style={[styles.wrCard, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}>
          {weekRangeLabel && hasReport ? (
            <Text style={{ fontSize: 12, color: themeColors.textMuted, marginBottom: 8 }}>{`Latest ${weekRangeLabel}`}</Text>
          ) : null}
          <View style={styles.wrGrid}>
            {cells.map((cell) => (
              <View
                key={cell.label}
                style={[styles.wrCell, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg }]}
              >
                <Text style={[styles.wrValue, { color: themeColors.text }]}>{cell.value}</Text>
                <Text style={[styles.wrCap, { color: themeColors.textMuted }]}>{cell.label}</Text>
              </View>
            ))}
          </View>
          {adherence != null ? (
            <View style={{ marginTop: 12, gap: 6 }}>
              <View style={styles.adherenceRow}>
                <Text style={[styles.adherenceLabel, { color: themeColors.textMuted }]}>Plan adherence</Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: themeColors.text }}>{`${Math.round(adherence * 100)}%`}</Text>
              </View>
              <NbProgressBar progress={adherence} index={7} />
            </View>
          ) : (
            <Text style={{ marginTop: 10, fontSize: 13, color: themeColors.textMuted, lineHeight: 18 }}>
              {hasReport
                ? 'Open the report for daily breakdowns and coaching notes.'
                : 'Reports appear after clients log check-ins and the weekly summary job runs.'}
            </Text>
          )}
        </View>
      </HardShadow>
    </View>
  );
}

// ===== STYLES =====

const styles = StyleSheet.create({
  hi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: nb.blockGap,
  },
  sqAv: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sqAvText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    fontWeight: '900',
  },
  sqBell: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteCard: {
    borderWidth: nb.borderWidth,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 130,
  },
  quoteBody: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  quoteAuthor: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.75,
  },
  quoteKicker: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.7,
  },
  secRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Manipulate here: gap under YOUR CLIENTS / TOOLS labels
    marginBottom: 14,
    gap: 8,
  },
  secLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  cntBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cntBadgeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  needShell: {
    borderWidth: nb.borderWidth,
    borderRadius: 6,
    overflow: 'hidden',
  },
  needPayout: {
    padding: 14,
    gap: 8,
  },
  needPayoutTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  needPayoutSub: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
    lineHeight: 18,
  },
  needPayoutBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  needRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 2,
    minHeight: 64,
  },
  needTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  needSub: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 17,
  },
  carouselScroll: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  clientChip: {
    borderWidth: nb.borderWidth,
    padding: 12,
    gap: 8,
  },
  clientChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  clientGoal: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  whyPill: {
    alignSelf: 'flex-start',
    borderWidth: 2.5,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 26,
    justifyContent: 'center',
  },
  whyPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  statPair: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  statCell: {
    flex: 1,
    minWidth: 0,
    borderWidth: 2.5,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  statCap: {
    fontSize: 12,
    fontWeight: '800',
  },
  statVal: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
    flexShrink: 1,
  },
  clientMore: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyClients: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  todayEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  toolShadow: {
    width: '48%',
  },
  toolTile: {
    minHeight: 92,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  toolLabel: {
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 17,
  },
  toolBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  openChip: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  wrCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
  },
  wrGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  wrCell: {
    width: '47%',
    borderWidth: nb.borderWidth,
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  wrValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  wrCap: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  adherenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adherenceLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
