// Design Law Trainer Home blocks — layout matches docs/design/Design-Law/screens/trainer-home.
// Flow: header → welcome hero → needs you → client carousel → (parent paints tabs) → tools → weekly report.
// Used only by TrainerHomeContent. Nb* + handoff assets; no parallel chrome system.
// Hero visual law: screens/hero-and-welcome-redesign/05-06 (mirrored boxer welcome).

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
import HardShadow from '../../look-and-feel/HardShadow';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import {
  darkColors,
  lightColors,
  navAccentGradient,
  nb,
} from '../../look-and-feel/colorPalette';
import HomeWelcomeHero from '../../for-both/home-cards/HomeWelcomeHero';
import { getClientInitials, getClientRosterStats } from './trainerHomePieces';

// ===== NAMED CONSTANTS =====

const HANDOFF_WORKOUT = require('../../assets/icons/handoff/workout.png');
const HANDOFF_PEOPLE = require('../../assets/icons/handoff/people.png');
const HANDOFF_CHECKIN = require('../../assets/icons/handoff/checkin.png');
const HANDOFF_PICTURE = require('../../assets/icons/handoff/picture.png');
const HANDOFF_JOURNEY = require('../../assets/icons/handoff/journey.png');

const FALLBACK_TRAINER_NAME = 'Trainer';
const FALLBACK_CLIENT_NAME = 'Client';
const STRIPE_STATUS_PENDING = 'pending';

// Manipulate here: client carousel — wide enough that Sleep/Steps don’t clip; next card peeks.
const CLIENT_CHIP_MIN_WIDTH = 248;
const CLIENT_CHIP_MAX_WIDTH = 300;
const CLIENT_CHIP_PEEK = 48;
const CLIENT_CHIP_GAP = 12;
const CLIENT_CHIP_MIN_HEIGHT = 176;

// Manipulate here: top margin clears the 4 client tabs above Tools
const TOOLS_TOP_MARGIN = 28;

// Spreadsheet creator removed — use Google Sheets / upload .xlsx; keep doc maker.
const TOOL_DEFS = [
  { key: 'aiPlans', label: 'Workout plans', icon: HANDOFF_WORKOUT },
  { key: 'messages', label: 'Messages', icon: HANDOFF_PEOPLE },
  { key: 'document', label: 'Document maker', icon: HANDOFF_CHECKIN },
  { key: 'photos', label: 'Progress photos', icon: HANDOFF_PICTURE },
  { key: 'notes', label: 'Client notes & files', icon: HANDOFF_JOURNEY },
];

const WEEKLY_EMPTY_CELLS = [
  { value: '0', label: 'Sessions done' },
  { value: '0/0', label: 'Clients logged' },
];

// ===== THEME =====

/**
 * B/W/gray surfaces for trainer home (mirrors client Design Law tokens).
 * @param {boolean} isDark
 * @returns {object}
 */
export function trainerHomeThemeColors(isDark) {
  const palette = isDark ? darkColors : lightColors;
  return {
    solidBg: palette.nbBackground,
    cardBg: palette.nbSurface,
    cardBorder: palette.nbBorder,
    text: palette.nbInk,
    textMuted: palette.nbMuted,
    fill: palette.nbFill,
    onFill: palette.nbOnFill,
    pillBg: palette.nbSurfaceChip,
    pillBorder: palette.nbBorder,
    shadow: palette.nbShadow,
  };
}

// ===== HELPER FUNCTIONS =====

/**
 * First word of the trainer display name for “Good morning, Chris”.
 */
function firstNameFromDisplay(name) {
  const trimmed = String(name || '').trim();
  const words = trimmed.split(/\s+/);
  return words[0] || FALLBACK_TRAINER_NAME;
}

/**
 * Two-letter initials for the header avatar (reuses roster helper).
 */
function initialsFromName(name) {
  return getClientInitials(name || FALLBACK_TRAINER_NAME);
}

/**
 * morning / afternoon / evening from the device clock.
 */
function dayPartLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Format step counts for the client chip; empty / zero → em dash.
 */
function formatSteps(steps) {
  const stepCount = Number(steps);
  if (!Number.isFinite(stepCount) || stepCount <= 0) return '—';
  return stepCount.toLocaleString();
}

/**
 * Status pill copy on a client chip.
 */
function clientStatusLabel(hasWeekly, hints) {
  if (hints?.loggedToday) return 'Logged today';
  if (hasWeekly) return 'Weekly ready';
  return 'Tap to view';
}

/**
 * Odd chips get the PNG 01/03 “taller top-right” radius; even stay square-ish.
 */
function clientChipCornerStyle(chipIndex) {
  // Manipulate here: odd chips get the PNG 01/03 “taller top-right” radius.
  const isOddChip = chipIndex % 2 === 1;
  if (isOddChip) {
    return {
      borderTopLeftRadius: 10,
      borderTopRightRadius: 26,
      borderBottomRightRadius: 10,
      borderBottomLeftRadius: 10,
    };
  }
  return { borderRadius: 10 };
}

/**
 * Show COACH-XXXX when the stored code is the short token only.
 */
function formatInviteDisplay(code) {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw.includes('-')) return raw;
  return `COACH-${raw}`;
}

/**
 * Carousel subtitle: empty PNG “0 of 0”; filled “N of N · swipe”.
 */
function clientCarouselSubtitle(totalClients) {
  if (totalClients > 0) return `${totalClients} of ${totalClients} · swipe`;
  return '0 of 0';
}

/**
 * Chip width from window size with peek of the next card.
 */
function clientChipWidthForWindow(windowWidth) {
  const rawWidth = Math.round(windowWidth - nb.screenGutter * 2 - CLIENT_CHIP_PEEK);
  const cappedMax = Math.min(CLIENT_CHIP_MAX_WIDTH, rawWidth);
  return Math.max(CLIENT_CHIP_MIN_WIDTH, cappedMax);
}

/**
 * Default weekly metric cells when the parent did not pass metricCells.
 */
function defaultWeeklyMetricCells(clientsLogged, clientsTotal) {
  let clientsLoggedLabel = '—';
  if (clientsTotal) {
    clientsLoggedLabel = `${clientsLogged}/${clientsTotal}`;
  }
  return [
    { value: '—', label: 'Sessions done' },
    { value: clientsLoggedLabel, label: 'Clients logged' },
    { value: '—', label: 'Avg protein' },
    { value: '—', label: 'Avg sleep' },
  ];
}

/**
 * Clamp adherence to 0..1 for NbProgressBar; null when missing.
 */
function clampedAdherenceFraction(adherencePct) {
  if (typeof adherencePct !== 'number') return null;
  return Math.min(1, Math.max(0, adherencePct));
}

/**
 * Payout block title from Stripe Connect status.
 */
function payoutBlockTitle(stripeConnectStatus) {
  if (stripeConnectStatus === STRIPE_STATUS_PENDING) {
    return 'Payout verification in progress';
  }
  return 'Complete payout setup to accept clients';
}

/**
 * Payout CTA label from Stripe Connect status.
 */
function payoutButtonLabel(stripeConnectStatus) {
  if (stripeConnectStatus === STRIPE_STATUS_PENDING) return 'Manage payouts';
  return 'Set up payouts';
}

/**
 * Badge text: 9+ when count is large.
 */
function needsYouBadgeText(count) {
  if (count > 9) return '9+';
  return String(count);
}

/**
 * Messages tool badge: 99+ when count is large.
 */
function messagesToolBadgeText(messageBadge) {
  if (messageBadge > 99) return '99+';
  return String(messageBadge);
}

// ===== SECTION HEADER =====

/**
 * Uppercase section label with an optional right-side control (badge, Open report, …).
 */
// ===== MAIN FUNCTION =====
// Exported layout blocks below — each is one Design Law region of trainer home.

export function TrainerSectionHeader({ label, right, themeColors }) {
  const labelText = String(label || '').toUpperCase();
  return (
    <View style={styles.secRow}>
      <Text style={[styles.secLabel, { color: themeColors.textMuted }]}>{labelText}</Text>
      {right || null}
    </View>
  );
}

// ===== HEADER + MOTIVATION (PNG 01 — .hi + .quote) =====

/**
 * Top row: avatar initials, “Good {period}, {name}”, notifications bell.
 */
export function TrainerHeader({
  themeColors,
  userName,
  greetingPeriod,
  onNotificationsPress,
}) {
  const firstName = firstNameFromDisplay(userName);
  const period = String(greetingPeriod || dayPartLabel());
  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  const periodLine = `${weekday} ${period}`;
  const greetingLine = `Good ${period}, ${firstName}`;
  const avatarInitials = initialsFromName(userName);

  return (
    <View style={styles.hi}>
      <LinearGradient
        colors={navAccentGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.sqAv, { borderColor: themeColors.cardBorder }]}
      >
        <Text style={[styles.sqAvText, { color: lightColors.nbInk }]}>{avatarInitials}</Text>
      </LinearGradient>
      <View style={styles.headerTextCol}>
        <Text style={{ fontSize: 13, color: themeColors.textMuted }}>{periodLine}</Text>
        <Text style={[styles.greetingTitle, { color: themeColors.text }]}>{greetingLine}</Text>
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

/**
 * Mirrored welcome hero (boxer on the left). Quote props kept so call sites don’t break.
 */
export function TrainerMotivationCard({ themeColors }) {
  return <HomeWelcomeHero themeColors={themeColors} variant="trainer" />;
}

// ===== NEEDS YOU (PNG 01, 07 — payout + request rows) =====

function NeedsYouCountBadge({ count, themeColors }) {
  if (!count || count < 1) return null;
  const badgeText = needsYouBadgeText(count);
  return (
    <View style={[styles.cntBadge, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.fill }]}>
      <Text style={[styles.cntBadgeText, { color: themeColors.onFill }]}>{badgeText}</Text>
    </View>
  );
}

function NeedsYouRow({ iconSource, iconIndex, title, subtitle, right, onPress, themeColors }) {
  const defaultChevron = <Ionicons name="chevron-forward" size={18} color={themeColors.text} />;
  const rightSlot = right || defaultChevron;

  let subtitleElement = null;
  if (subtitle) {
    subtitleElement = (
      <Text style={[styles.needSub, { color: themeColors.textMuted }]} numberOfLines={2}>
        {subtitle}
      </Text>
    );
  }

  const inner = (
    <View style={[styles.needRow, { borderTopColor: themeColors.cardBorder }]}>
      <NbIconChip source={iconSource} index={iconIndex} size={40} />
      <View style={styles.flexMinZero}>
        <Text style={[styles.needTitle, { color: themeColors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitleElement}
      </View>
      {rightSlot}
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

function NeedsYouPayoutBlock({
  themeColors,
  stripeConnectStatus,
  payoutSubcopy,
  onOpenPayments,
}) {
  const title = payoutBlockTitle(stripeConnectStatus);
  const buttonLabel = payoutButtonLabel(stripeConnectStatus);

  let subcopyElement = null;
  if (payoutSubcopy) {
    subcopyElement = (
      <Text style={[styles.needPayoutSub, { color: themeColors.onFill }]}>{payoutSubcopy}</Text>
    );
  }

  return (
    <View style={[styles.needPayout, { backgroundColor: themeColors.fill }]}>
      <Text style={[styles.needPayoutTitle, { color: themeColors.onFill }]}>{title}</Text>
      {subcopyElement}
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
        <Text style={{ color: themeColors.fill, fontSize: 14, fontWeight: '900' }}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function NeedsYouCaughtUpMessage({ themeColors }) {
  return (
    <View style={styles.caughtUpPad}>
      <Text style={{ fontSize: 14, color: themeColors.textMuted, textAlign: 'center' }}>
        You&apos;re caught up. New requests and messages will show here.
      </Text>
    </View>
  );
}

/**
 * Needs-you shell: payout CTA, pending requests, unread messages, or caught-up copy.
 */
export function TrainerNeedsYou({
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
  const showPendingRequests = pendingRequestsCount > 0;
  const showUnreadMessages = unreadMessageCount > 0;
  const showCaughtUp =
    !showPayoutBlock && pendingRequestsCount < 1 && unreadMessageCount < 1;

  let pendingRequestsTitle = '';
  if (showPendingRequests) {
    const requestWord = pendingRequestsCount === 1 ? '' : 's';
    pendingRequestsTitle = `${pendingRequestsCount} new client request${requestWord}`;
  }

  let pendingRequestsRight = null;
  if (showPendingRequests) {
    pendingRequestsRight = (
      <View style={[styles.cntBadge, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.fill }]}>
        <Text style={[styles.cntBadgeText, { color: themeColors.onFill }]}>{pendingRequestsCount}</Text>
      </View>
    );
  }

  let unreadSubtitle = '';
  if (showUnreadMessages) {
    unreadSubtitle = `${unreadMessageCount} unread — open inbox`;
  }

  return (
    <View style={{ marginBottom: nb.blockGap }}>
      <TrainerSectionHeader
        label="Needs you"
        themeColors={themeColors}
        right={<NeedsYouCountBadge count={needsCount} themeColors={themeColors} />}
      />
      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <View style={[styles.needShell, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}>
          {showPayoutBlock ? (
            <NeedsYouPayoutBlock
              themeColors={themeColors}
              stripeConnectStatus={stripeConnectStatus}
              payoutSubcopy={payoutSubcopy}
              onOpenPayments={onOpenPayments}
            />
          ) : null}

          {showPendingRequests ? (
            <NeedsYouRow
              themeColors={themeColors}
              iconSource={HANDOFF_PEOPLE}
              iconIndex={1}
              title={pendingRequestsTitle}
              subtitle="Tap to review and approve"
              right={pendingRequestsRight}
              onPress={onClientRequestsPress}
            />
          ) : null}

          {showUnreadMessages ? (
            <NeedsYouRow
              themeColors={themeColors}
              iconSource={HANDOFF_JOURNEY}
              iconIndex={4}
              title="New client messages"
              subtitle={unreadSubtitle}
              onPress={onMessagesPress}
            />
          ) : null}

          {showCaughtUp ? <NeedsYouCaughtUpMessage themeColors={themeColors} /> : null}
        </View>
      </HardShadow>
    </View>
  );
}

// ===== CLIENT CAROUSEL (PNG 01, 03 — .hs3 .chip.cc) =====

function TrainerClientChipCard({
  client,
  chipIndex,
  chipWidth,
  isSelected,
  themeColors,
  weeklySummaryMap,
  dailyHints,
  onSelectClient,
  onRemoveClient,
}) {
  const rosterStats = getClientRosterStats(client);
  const displayName = client.name || client.displayName || FALLBACK_CLIENT_NAME;
  const hasWeeklyReport = !!weeklySummaryMap[client.id];
  const dayHints = dailyHints[client.id] || {};

  // Goal · experience line under the name.
  const goalPieces = [rosterStats.goal, client.experience || client.level].filter(Boolean);
  const goalLine = goalPieces.join(' · ');

  // Selected chip flips to fill/onFill ink (Design Law selected state).
  let surfaceColor = themeColors.cardBg;
  let inkColor = themeColors.text;
  let mutedColor = themeColors.textMuted;
  if (isSelected) {
    surfaceColor = themeColors.fill;
    inkColor = themeColors.onFill;
    mutedColor = themeColors.onFill;
  }

  const cornerStyle = clientChipCornerStyle(chipIndex);
  const statusText = clientStatusLabel(hasWeeklyReport, dayHints);

  let sleepHours = '—';
  if (dayHints.sleep != null) {
    sleepHours = `${dayHints.sleep} h`;
  }
  const stepsLabel = formatSteps(dayHints.steps);
  const statCells = [
    { cap: 'Sleep', val: sleepHours },
    { cap: 'Steps', val: stepsLabel },
  ];

  const canRemove = typeof onRemoveClient === 'function';
  const goalOpacity = isSelected ? 0.85 : 1;
  const avatarBorderStyle = isSelected ? { borderColor: themeColors.onFill } : undefined;

  let goalElement = null;
  if (goalLine) {
    goalElement = (
      <Text
        style={[styles.clientGoal, { color: mutedColor, opacity: goalOpacity }]}
        numberOfLines={2}
      >
        {goalLine}
      </Text>
    );
  }

  const statCellElements = [];
  for (let index = 0; index < statCells.length; index += 1) {
    const cell = statCells[index];
    statCellElements.push(
      <View key={cell.cap} style={[styles.statCell, { borderColor: inkColor }]}>
        <Text style={[styles.statCap, { color: mutedColor }]}>{cell.cap}</Text>
        <Text style={[styles.statVal, { color: inkColor }]} numberOfLines={1}>
          {cell.val}
        </Text>
      </View>,
    );
  }

  let moreButton = null;
  if (canRemove) {
    moreButton = (
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
    );
  }

  return (
    <View style={{ width: chipWidth, marginRight: CLIENT_CHIP_GAP, position: 'relative' }}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={10}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onSelectClient?.(client.id)}
          style={[
            styles.clientChip,
            cornerStyle,
            {
              backgroundColor: surfaceColor,
              borderColor: themeColors.cardBorder,
              minHeight: CLIENT_CHIP_MIN_HEIGHT,
            },
          ]}
        >
          <View style={styles.clientChipTop}>
            <NbAvatar
              initials={getClientInitials(displayName)}
              size={40}
              style={avatarBorderStyle}
            />
            <View style={styles.flexMinZero}>
              <Text style={[styles.clientName, { color: inkColor }]} numberOfLines={1}>
                {displayName}
              </Text>
              {goalElement}
            </View>
          </View>
          <View style={[styles.whyPill, { borderColor: inkColor }]}>
            <Text style={[styles.whyPillText, { color: inkColor }]} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
          <View style={styles.statPair}>{statCellElements}</View>
        </TouchableOpacity>
      </HardShadow>
      {moreButton}
    </View>
  );
}

function EmptyClientsBlock({
  themeColors,
  subtitle,
  inviteCode,
  onCopyInvite,
  onListMe,
}) {
  const codeLabel = formatInviteDisplay(inviteCode);

  let inviteCodeBox = null;
  if (codeLabel) {
    inviteCodeBox = (
      <View
        style={[
          styles.inviteCodeBox,
          { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg },
        ]}
      >
        <Text style={[styles.inviteCodeText, { color: themeColors.text }]}>{codeLabel}</Text>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: nb.blockGap }}>
      <TrainerSectionHeader
        label="Your clients"
        right={
          <Text style={[styles.carouselSubText, { color: themeColors.textMuted }]}>{subtitle}</Text>
        }
        themeColors={themeColors}
      />
      <View
        style={[
          styles.emptyClients,
          {
            borderColor: themeColors.cardBorder,
            backgroundColor: themeColors.cardBg,
            borderStyle: 'dashed',
          },
        ]}
      >
        <Text style={[styles.emptyClientsTitle, { color: themeColors.text }]}>No clients yet</Text>
        <Text style={[styles.emptyClientsBody, { color: themeColors.textMuted }]}>
          Clients you already train join with your invite code. New clients find you in the marketplace.
        </Text>
        {inviteCodeBox}
        <View style={styles.emptyClientsActions}>
          <NbButton
            variant="ghost"
            sm
            style={styles.flexOne}
            onPress={() => onCopyInvite?.(inviteCode)}
          >
            Copy code
          </NbButton>
          <NbButton variant="fill" sm style={styles.flexOne} onPress={() => onListMe?.()}>
            List me
          </NbButton>
        </View>
      </View>
    </View>
  );
}

/**
 * Horizontal client chips, or the empty invite-code state when the roster is empty.
 */
export function TrainerClientCarousel({
  themeColors,
  clients,
  selectedClientId,
  weeklySummaryMap,
  dailyHints = {},
  onSelectClient,
  onRemoveClient,
  inviteCode = null,
  onCopyInvite,
  onListMe,
}) {
  // vocab: useWindowDimensions = live window width for chip sizing
  const { width: windowWidth } = useWindowDimensions();
  // Leave gutter + peek of the next card (PNG 01/03 carousel feel).
  const clientChipWidth = clientChipWidthForWindow(windowWidth);
  const total = clients?.length || 0;
  const subtitle = clientCarouselSubtitle(total);

  if (total === 0) {
    return (
      <EmptyClientsBlock
        themeColors={themeColors}
        subtitle={subtitle}
        inviteCode={inviteCode}
        onCopyInvite={onCopyInvite}
        onListMe={onListMe}
      />
    );
  }

  const chipElements = [];
  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index];
    chipElements.push(
      <TrainerClientChipCard
        key={client.id}
        client={client}
        chipIndex={index}
        chipWidth={clientChipWidth}
        isSelected={client.id === selectedClientId}
        themeColors={themeColors}
        weeklySummaryMap={weeklySummaryMap}
        dailyHints={dailyHints}
        onSelectClient={onSelectClient}
        onRemoveClient={onRemoveClient}
      />,
    );
  }

  const snapInterval = clientChipWidth + CLIENT_CHIP_GAP;

  return (
    <View style={{ marginBottom: nb.blockGap }}>
      <TrainerSectionHeader
        label="Your clients"
        themeColors={themeColors}
        right={<Text style={[styles.carouselSubText, { color: themeColors.textMuted }]}>{subtitle}</Text>}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselScroll}
        decelerationRate="fast"
        snapToInterval={snapInterval}
      >
        {chipElements}
      </ScrollView>
    </View>
  );
}

/**
 * “{Name} · today” eyebrow above the selected client’s daily tabs.
 */
export function TrainerClientTodayLabel({ clientName, themeColors }) {
  const trimmed = String(clientName || FALLBACK_CLIENT_NAME).trim();
  const name = trimmed || FALLBACK_CLIENT_NAME;
  return (
    <Text style={[styles.todayEyebrow, { color: themeColors.textMuted }]}>
      <Text style={{ color: themeColors.text, fontWeight: '900' }}>{name}</Text>
      {' · today'}
    </Text>
  );
}

// ===== TOOLS GRID (PNG 01, 03 — .tools) =====

function ToolTile({ tool, toolIndex, themeColors, onToolPress, messageBadge }) {
  const showMessagesBadge = tool.key === 'messages' && messageBadge > 0;

  let badgeElement = null;
  if (showMessagesBadge) {
    badgeElement = (
      <View style={[styles.toolBadge, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.fill }]}>
        <Text style={{ fontSize: 11, fontWeight: '900', color: themeColors.onFill }}>
          {messagesToolBadgeText(messageBadge)}
        </Text>
      </View>
    );
  }

  // Manipulate here: chipIndex = idx * 3 so handoff colors stagger across the grid
  const chipIndex = toolIndex * 3;

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={10} style={styles.toolShadow}>
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
        <NbIconChip source={tool.icon} index={chipIndex} size={40} />
        <Text style={[styles.toolLabel, { color: themeColors.text }]} numberOfLines={2}>
          {tool.label}
        </Text>
        {badgeElement}
      </TouchableOpacity>
    </HardShadow>
  );
}

/**
 * 2-column tools grid under the client tabs.
 */
export function TrainerToolsGrid({ themeColors, onToolPress, messageBadge }) {
  const toolElements = [];
  for (let index = 0; index < TOOL_DEFS.length; index += 1) {
    const tool = TOOL_DEFS[index];
    toolElements.push(
      <ToolTile
        key={tool.key}
        tool={tool}
        toolIndex={index}
        themeColors={themeColors}
        onToolPress={onToolPress}
        messageBadge={messageBadge}
      />,
    );
  }

  return (
    <View style={{ marginTop: TOOLS_TOP_MARGIN, marginBottom: nb.blockGap }}>
      <TrainerSectionHeader label="Tools" themeColors={themeColors} />
      <View style={styles.toolsGrid}>{toolElements}</View>
    </View>
  );
}

// ===== WEEKLY REPORT (PNG 01, 03 — .wr grid + adherence) =====

/**
 * empty-vs-data PNG 03 — dashed weekly report before any client exists.
 */
export function TrainerWeeklyReportEmpty({ themeColors }) {
  const emptyCellElements = [];
  for (let index = 0; index < WEEKLY_EMPTY_CELLS.length; index += 1) {
    const cell = WEEKLY_EMPTY_CELLS[index];
    emptyCellElements.push(
      <View
        key={cell.label}
        style={[styles.wrCell, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg, flex: 1 }]}
      >
        <Text style={[styles.wrValue, { color: themeColors.text }]}>{cell.value}</Text>
        <Text style={[styles.wrCap, { color: themeColors.textMuted }]}>{cell.label}</Text>
      </View>,
    );
  }

  return (
    <View style={{ marginBottom: nb.blockGap }}>
      <TrainerSectionHeader label="Weekly report" themeColors={themeColors} />
      <View
        style={[
          styles.wrEmpty,
          {
            borderColor: themeColors.cardBorder,
            backgroundColor: themeColors.cardBg,
            borderStyle: 'dashed',
          },
        ]}
      >
        <Text style={{ fontSize: 17, fontWeight: '900', color: themeColors.text }}>Starts after your first week</Text>
        <Text style={{ fontSize: 13, color: themeColors.textMuted, lineHeight: 18 }}>
          Sessions, client logs and plan adherence show up here once a client is training with you.
        </Text>
        <View style={styles.wrEmptyGrid}>{emptyCellElements}</View>
      </View>
    </View>
  );
}

/**
 * Week-range caption under the Weekly report header (only when a report exists).
 */
function weeklyReportWeekRangeElement(weekRangeLabel, hasReport, themeColors) {
  const showWeekRange = weekRangeLabel && hasReport;
  if (!showWeekRange) {
    return null;
  }
  return (
    <Text style={{ fontSize: 12, color: themeColors.textMuted, marginBottom: 8 }}>
      {`Latest ${weekRangeLabel}`}
    </Text>
  );
}

/**
 * Metric cells for the weekly report card grid.
 */
function buildWeeklyReportMetricCellElements(cells, themeColors) {
  const metricCellElements = [];
  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    metricCellElements.push(
      <View
        key={cell.label}
        style={[styles.wrCell, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg }]}
      >
        <Text style={[styles.wrValue, { color: themeColors.text }]}>{cell.value}</Text>
        <Text style={[styles.wrCap, { color: themeColors.textMuted }]}>{cell.label}</Text>
      </View>,
    );
  }
  return metricCellElements;
}

/**
 * Plan-adherence bar when we have a fraction; otherwise a short hint.
 */
function weeklyReportAdherenceOrHint(adherence, hasReport, themeColors) {
  if (adherence != null) {
    const percentLabel = `${Math.round(adherence * 100)}%`;
    return (
      <View style={{ marginTop: 12, gap: 6 }}>
        <View style={styles.adherenceRow}>
          <Text style={[styles.adherenceLabel, { color: themeColors.textMuted }]}>Plan adherence</Text>
          <Text style={{ fontSize: 13, fontWeight: '900', color: themeColors.text }}>{percentLabel}</Text>
        </View>
        <NbProgressBar progress={adherence} index={7} />
      </View>
    );
  }

  let hintText = 'Reports appear after clients log check-ins and the weekly summary job runs.';
  if (hasReport) {
    hintText = 'Open the report for daily breakdowns and coaching notes.';
  }
  return (
    <Text style={{ marginTop: 10, fontSize: 13, color: themeColors.textMuted, lineHeight: 18 }}>
      {hintText}
    </Text>
  );
}

/**
 * “Open report” chip in the Weekly report section header.
 */
function weeklyReportOpenChip(onOpenReport, openChipDisabled, openChipOpacity, themeColors) {
  return (
    <TouchableOpacity
      onPress={onOpenReport}
      disabled={openChipDisabled}
      style={[
        styles.openChip,
        {
          borderColor: themeColors.cardBorder,
          backgroundColor: themeColors.pillBg,
          opacity: openChipOpacity,
        },
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: '900', color: themeColors.text }}>Open report</Text>
    </TouchableOpacity>
  );
}

/**
 * Filled weekly report card: metric grid + optional plan-adherence bar.
 */
export function TrainerWeeklyReportPanel({
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
  // 1. Pick metric cells (caller override or default from logged/total).
  let cells = defaultWeeklyMetricCells(clientsLogged, clientsTotal);
  if (metricCells?.length) {
    cells = metricCells;
  }

  // 2. Name open-chip + adherence decisions before JSX.
  const adherence = clampedAdherenceFraction(adherencePct);
  const openChipDisabled = loading || !hasReport;
  const openChipOpacity = openChipDisabled ? 0.55 : 1;
  const weekRangeElement = weeklyReportWeekRangeElement(weekRangeLabel, hasReport, themeColors);
  const metricCellElements = buildWeeklyReportMetricCellElements(cells, themeColors);
  const adherenceOrHint = weeklyReportAdherenceOrHint(adherence, hasReport, themeColors);
  const openChip = weeklyReportOpenChip(onOpenReport, openChipDisabled, openChipOpacity, themeColors);

  // 3. Paint header + card.
  return (
    <View style={{ marginBottom: nb.blockGap }}>
      <TrainerSectionHeader label="Weekly report" themeColors={themeColors} right={openChip} />
      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <View style={[styles.wrCard, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.cardBg }]}>
          {weekRangeElement}
          <View style={styles.wrGrid}>{metricCellElements}</View>
          {adherenceOrHint}
        </View>
      </HardShadow>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  hi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: nb.blockGap,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  greetingTitle: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  flexMinZero: {
    flex: 1,
    minWidth: 0,
  },
  flexOne: {
    flex: 1,
  },
  caughtUpPad: {
    padding: 14,
  },
  carouselSubText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyClientsTitle: {
    fontSize: 17,
    fontWeight: '900',
    alignSelf: 'stretch',
  },
  emptyClientsBody: {
    fontSize: 13,
    lineHeight: 18,
    alignSelf: 'stretch',
  },
  emptyClientsActions: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'stretch',
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
    alignItems: 'flex-start',
    gap: 12,
  },
  inviteCodeBox: {
    alignSelf: 'stretch',
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  inviteCodeText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.4,
    fontVariant: ['tabular-nums'],
  },
  wrEmpty: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  wrEmptyGrid: {
    flexDirection: 'row',
    gap: 10,
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
