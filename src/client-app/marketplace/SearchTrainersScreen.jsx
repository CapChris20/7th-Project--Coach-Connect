/**
 * Trainer Search Screen
 *
 * Purpose: UI screen or component: Trainer Search Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/marketplace
 * Key exports: (see file)
 *
 * @file-header
 */
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db, storage } from '../../app-start/config';
import { trainerPhotoUri, resolveTrainerPhotoWithStorageFallback } from '../../shared-utils/getTrainerProfileMedia';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import TrainerRequestConfirmModal from './TrainerRequestConfirmModal';
import TrainerRequestIntroModal from './TrainerRequestIntroModal';
import BrowseTrainersScreen from './BrowseTrainersScreen';
import FilterModal from './FilterModal';
import { TrainerProfileSheet } from './MarketplaceTrainerProfileSheet';
import {
  DEFAULT_FILTERS,
  filterTrainers,
  normalizeTrainer,
  getTheme,
} from './marketplaceFilters';

const SearchTrainersScreen = ({
  onClose,
  onBack,
  title = 'Find a Trainer',
  showHeader = true,
  showBottomNav = true,
  onViewProfile,
  onRequestTrainer,
  onSelectTrainer,
  onProfilePress,
  onSettingsPress,
  isDark = true,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
}) => {
  const headerBack = onBack ?? onClose;
  const theme = getTheme(isDark);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [quickSpecialty, setQuickSpecialty] = useState('All');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTrainer, setProfileTrainer] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [requestConfirmTrainer, setRequestConfirmTrainer] = useState(null);
  const [requestIntroTrainer, setRequestIntroTrainer] = useState(null);
  const [requestIntroDraft, setRequestIntroDraft] = useState('');
  const [requestToast, setRequestToast] = useState('');

  useEffect(() => {
    if (!requestToast) return undefined;
    const t = setTimeout(() => setRequestToast(''), 2800);
    return () => clearTimeout(t);
  }, [requestToast]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let data = [];
        try {
          const trainersRef = collection(db, 'trainers');
          const snap = await getDocs(trainersRef);
          snap.docs.forEach((d) => data.push({ id: d.id, ...d.data() }));
        } catch (err) {
          console.warn('trainers collection failed, falling back to users:', err?.message);
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('role', '==', 'trainer'));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => data.push({ id: d.id, ...d.data() }));
        }
        data = await Promise.all(
          data.map(async (t) => {
            let merged = { ...t };
            try {
              const us = await getDoc(doc(db, 'users', t.id));
              if (us.exists()) {
                const ud = us.data() || {};
                const fromUser =
                  ud.photoURL || ud.photoUrl || ud.profilePhoto || ud.avatarUrl || ud.photo || null;
                const picked =
                  trainerPhotoUri(merged) ||
                  (fromUser ? String(fromUser).trim() : null) ||
                  merged.photoURL ||
                  merged.photoUrl ||
                  null;
                merged = {
                  ...merged,
                  photoURL: picked || null,
                  displayName: merged.displayName || ud.displayName || ud.name || merged.name || null,
                  name: merged.name || ud.name || ud.displayName || merged.displayName || null,
                };
              }
            } catch (_) {
              /* keep trainer doc */
            }
            const normalizedUrl = trainerPhotoUri(merged);
            if (normalizedUrl && !merged.photoURL) merged = { ...merged, photoURL: normalizedUrl };
            return merged;
          })
        );
        data = await Promise.all(data.map((t) => resolveTrainerPhotoWithStorageFallback(t, storage)));
        setTrainers(data);
      } catch (e) {
        console.error('SearchTrainersScreen load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const normalized = useMemo(
    () => trainers.map((t, i) => normalizeTrainer(t, i)),
    [trainers]
  );

  const filtered = useMemo(
    () => filterTrainers(normalized, filters, { query: search, quickSpecialty }),
    [normalized, filters, search, quickSpecialty]
  );

  const openProfile = (trainer) => {
    setProfileTrainer(trainer);
    setProfileOpen(true);
  };

  const closeProfile = () => {
    setProfileOpen(false);
    setProfileTrainer(null);
  };

  const firebaseTrainer = (uiTrainer) => uiTrainer?._firebase || uiTrainer;

  const openConnectFlow = (trainer) => {
    if (!trainer) return;
    setRequestConfirmTrainer(trainer);
    setRequestIntroDraft('');
  };

  const openMessageFlow = (trainer) => {
    if (!trainer) return;
    setRequestIntroTrainer(trainer);
    setRequestIntroDraft('');
  };

  const closeRequestIntro = () => {
    if (!requesting) {
      setRequestIntroTrainer(null);
      setRequestIntroDraft('');
    }
  };

  const closeRequestConfirm = () => {
    if (!requesting) {
      setRequestConfirmTrainer(null);
    }
  };

  const proceedFromConfirmToMessage = () => {
    if (!requestConfirmTrainer) return;
    setRequestIntroTrainer(requestConfirmTrainer);
    setRequestConfirmTrainer(null);
  };

  const runRequest = async (trainer) => {
    const raw = firebaseTrainer(trainer);
    if (!raw) return;
    if (onRequestTrainer) {
      setRequesting(true);
      try {
        const customIntro = String(requestIntroDraft || '').trim();
        await onRequestTrainer(raw, { clientIntro: customIntro || undefined });
        closeProfile();
        setRequestConfirmTrainer(null);
        setRequestIntroTrainer(null);
        setRequestIntroDraft('');
        const nm = raw.displayName || raw.name || 'your coach';
        setRequestToast(`Request sent to ${nm}! They'll respond soon.`);
      } catch (e) {
        console.error('Trainer request failed:', e);
        Alert.alert('Request failed', e?.message || 'Please try again.');
      } finally {
        setRequesting(false);
      }
      return;
    }
    if (onSelectTrainer) onSelectTrainer(raw);
    else if (onViewProfile) onViewProfile(raw);
  };

  const confirmSendRequest = () => {
    proceedFromConfirmToMessage();
  };

  const completeFromIntro = () => {
    const t = requestIntroTrainer || requestConfirmTrainer;
    if (t) runRequest(t);
  };

  const profileTitle =
    profileTrainer?.name || profileTrainer?.displayName || 'Trainer profile';
  const headerTitle = profileOpen ? profileTitle : title;
  const headerBackHandler = profileOpen ? closeProfile : headerBack;

  return (
    <SafeAreaView style={[s.shell, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {showHeader !== false ? (
        <View style={s.headerWrap}>
          <CoachConnectHeader
            title={headerTitle}
            isDark={isDark}
            skipTopSafeInset
            onBack={headerBackHandler}
            onProfilePress={onProfilePress}
            onSettingsPress={onSettingsPress}
          />
        </View>
      ) : null}

      <View style={s.body}>
      {profileOpen && profileTrainer ? (
        <TrainerProfileSheet
          embedded
          trainer={profileTrainer}
          visible
          onClose={closeProfile}
          onMessage={(t) => openMessageFlow(t)}
          onConnect={(t) => openConnectFlow(t)}
          isDark={isDark}
          requesting={requesting}
        />
      ) : (
        <BrowseTrainersScreen
          trainers={filtered}
          loading={loading}
          isDark={isDark}
          filters={filters}
          search={search}
          onSearchChange={setSearch}
          quickSpecialty={quickSpecialty}
          onQuickSpecialtyChange={setQuickSpecialty}
          onViewProfile={openProfile}
          onMessage={openMessageFlow}
          onConnect={openConnectFlow}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      )}

      <FilterModal
        visible={filtersOpen}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={setFilters}
        isDark={isDark}
      />

      <TrainerRequestIntroModal
        visible={!!requestIntroTrainer}
        trainerName={requestIntroTrainer?.name || requestIntroTrainer?.displayName || 'Trainer'}
        messageDraft={requestIntroDraft}
        onChangeMessage={setRequestIntroDraft}
        onSkip={completeFromIntro}
        onSendMessage={completeFromIntro}
        onClose={closeRequestIntro}
        isDark={isDark}
        busy={requesting}
      />

      <TrainerRequestConfirmModal
        visible={!!requestConfirmTrainer}
        trainer={firebaseTrainer(requestConfirmTrainer)}
        onCancel={closeRequestConfirm}
        onConfirm={confirmSendRequest}
        isDark={isDark}
        busy={requesting}
      />

      {requestToast ? (
        <View style={s.toastWrap} pointerEvents="none">
          <View
            style={[
              s.toastInner,
              {
                backgroundColor: isDark ? 'rgba(18,18,24,0.96)' : 'rgba(255,255,255,0.96)',
                borderColor: isDark ? 'rgba(240,107,168,0.35)' : 'rgba(240,107,168,0.4)',
              },
            ]}
          >
            <Text style={{ color: isDark ? '#fff' : '#0A0A0F', fontWeight: '700', textAlign: 'center' }}>
              {requestToast}
            </Text>
          </View>
        </View>
      ) : null}
      </View>

      {showBottomNav !== false ? (
        <BottomNavBar
          onHomePress={onHomePress}
          onPlusPress={onPlusPress}
          onVoicePress={onVoicePress}
          onNutritionPress={onNutritionPress}
          onWorkoutPress={onWorkoutPress}
          onMessagesPress={onMessagesPress}
          onProfilePress={onProfilePress}
        />
      ) : null}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  shell: { flex: 1 },
  headerWrap: {},
  body: { flex: 1, position: 'relative' },
  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastInner: {
    maxWidth: '92%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
});

export { TrainerProfileSheet };
export default SearchTrainersScreen;
