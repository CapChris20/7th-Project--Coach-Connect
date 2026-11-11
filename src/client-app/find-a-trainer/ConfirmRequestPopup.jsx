// Confirm-before-send sheet when a client taps Request on a trainer profile.
// Flow: show the trainer → explain the 3–5 day trial → show the first monthly price → Cancel or Confirm.
// Used by SearchTrainersScreen. Price is read from price, then pricing.perMonth, then rate.
//
// vocab: neobrutalist = thick borders, hard shadows, gradient only for confirm button

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
import { trainerPhotoUri } from '../../helpers/trainerProfilePhoto';

// ===== NAMED CONSTANTS =====

const { width: SCREEN_W } = Dimensions.get('window');
const MODAL_MAX_WIDTH_PX = 400;
const MODAL_MAX_W = Math.min(SCREEN_W * 0.9, MODAL_MAX_WIDTH_PX);
const TRAINER_NAME_DEFAULT = 'Trainer';
const SCALE_HIDDEN = 0.94;
const FADE_MS = 220;

// ===== HELPER FUNCTIONS =====

/**
 * Marketplace cards store the monthly rate in three different fields. First one that exists wins.
 * @param {object} trainer
 * @returns {*}
 */
function getTrainerPrice(trainer) {
  if (!trainer) return null;
  if (trainer.price != null) return trainer.price;
  const perMonth = trainer.pricing && trainer.pricing.perMonth != null ? trainer.pricing.perMonth : null;
  if (perMonth != null) return perMonth;
  return trainer.rate != null ? trainer.rate : null;
}

/**
 * @param {object} trainer
 * @returns {{ name: string, firstName: string, initial: string, photoUri: string, price: *, hasPrice: boolean }}
 */
function trainerConfirmFields(trainer) {
  const name = trainer.displayName || trainer.name || TRAINER_NAME_DEFAULT;
  const firstName = name.trim().split(/\s+/)[0] || name;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const photoUri = trainerPhotoUri(trainer);
  const price = getTrainerPrice(trainer);
  const hasPrice = price != null && price !== '' && Number.isFinite(Number(price)) && Number(price) > 0;
  return { name, firstName, initial, photoUri, price, hasPrice };
}

function TrainerAvatar({ photoUri, initial, colors }) {
  return (
    <View style={[styles.avatarRing, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.avatarImg} resizeMode="cover" />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={[styles.avatarInitial, { color: colors.nbInk }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

function TrialCard({ firstName, colors }) {
  return (
    <View style={[styles.cardBlock, { backgroundColor: colors.nbSurfaceChip, borderColor: colors.nbBorder }]}>
      <View style={styles.rowStart}>
        <Ionicons name="calendar-outline" size={20} color={colors.nbMuted} style={styles.rowIcon} />
        <View style={styles.rowBody}>
          <Text style={[styles.sectionLabel, { color: colors.nbInk }]}>FREE TRIAL PERIOD: 3–5 DAYS</Text>
          <Text style={[styles.bodyText, { color: colors.nbMuted }]}>
            You can message {firstName} and discuss your fitness goals, training style, recovery needs, and anything else
            you want to cover. Get to know each other first — no commitment yet.
          </Text>
        </View>
      </View>
    </View>
  );
}

function AfterTrialCard({ hasPrice, price, colors }) {
  return (
    <View style={[styles.cardBlock, { backgroundColor: colors.nbSurfaceChip, borderColor: colors.nbBorder }]}>
      <View style={styles.rowStart}>
        <Ionicons name="card-outline" size={20} color={colors.nbMuted} style={styles.rowIcon} />
        <View style={styles.rowBody}>
          <Text style={[styles.sectionLabel, { color: colors.nbInk }]}>AFTER YOUR TRIAL</Text>
          {hasPrice ? (
            <Text style={[styles.bodyText, { color: colors.nbMuted }]}>
              Your first payment of{' '}
              <Text style={[styles.priceAccent, { color: colors.nbInk }]}>${Number(price)}</Text>
              /month will be charged. You can cancel anytime before your trial ends with no charge.
            </Text>
          ) : (
            <Text style={[styles.bodyText, { color: colors.nbMuted }]}>
              Your first payment will follow your coach's listed rate. You can cancel anytime before your trial ends
              with no charge.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trial + payment confirmation modal when a client requests a trainer.
 * Neobrutalist redesign: NbCard, NbButton, thick borders, one gradient moment (Confirm button).
 * @param {object} props
 */
export default function ConfirmRequestPopup({
  visible,
  trainer,
  busy,
  onConfirm,
  onCancel,
}) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const scale = useRef(new Animated.Value(SCALE_HIDDEN)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      fade.setValue(0);
      scale.setValue(SCALE_HIDDEN);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 65, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fade, scale]);

  const { name, firstName, initial, photoUri, price, hasPrice } = trainerConfirmFields(trainer);
  const closeIfNotBusy = busy ? undefined : onCancel;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeIfNotBusy}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdropPress} onPress={closeIfNotBusy} />
        <View style={styles.centerWrap} pointerEvents="box-none">
          <Animated.View
            style={{
              opacity: fade,
              transform: [{ scale }],
              width: MODAL_MAX_W,
              maxWidth: '90%',
            }}
          >
            <NbCard style={styles.card}>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.header}>
                  <TrainerAvatar photoUri={photoUri} initial={initial} colors={colors} />
                  <Text style={[styles.title, { color: colors.nbInk }]}>Connect with {name}?</Text>
                  <Text style={[styles.subtitle, { color: colors.nbMuted }]}>Start your free trial</Text>
                </View>

                <TrialCard firstName={firstName} colors={colors} />
                <AfterTrialCard hasPrice={hasPrice} price={price} colors={colors} />

                <View style={styles.actions}>
                  <NbButton variant="plain" onPress={onCancel} disabled={busy}>
                    Cancel
                  </NbButton>
                  <NbButton variant="brand" onPress={onConfirm} disabled={busy}>
                    {busy ? <ActivityIndicator size="small" color="#0A0A0F" /> : 'Confirm'}
                  </NbButton>
                </View>
              </ScrollView>
            </NbCard>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    maxHeight: '85%',
  },
  scroll: {
    maxHeight: 600,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  title: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  cardBlock: {
    borderRadius: 12,
    borderWidth: 2.5,
    padding: 16,
    marginBottom: 16,
  },
  rowStart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  priceAccent: {
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
});
