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
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  documentId,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import { db, storage } from '../../app-start/config';
import { trainerPhotoUri, resolveTrainerPhotoWithStorageFallback } from '../../shared-utils/getTrainerProfileMedia';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { useTheme } from '../../shared-ui/ThemeContext';
import TrainerRequestConfirmModal from './TrainerRequestConfirmModal';
import TrainerRequestIntroModal from './TrainerRequestIntroModal';
import BrowseTrainersScreen from './BrowseTrainersScreen';
import FilterModal from './FilterModal';
import { TrainerProfileSheet } from './MarketplaceTrainerProfileSheet';
import { showTrainerRequestSentAlert } from './useTrainerConnectFlow';
import { useShellBottomNavInset, SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomNavMetrics';
import {
  DEFAULT_FILTERS,
  filterTrainers,
  normalizeTrainer,
  getTheme,
} from './marketplaceFilters';

const MARKETPLACE_PAGE_SIZE = 30;
const FIRESTORE_TRAINER_PAGE_SIZE = 20;

async function enrichTrainersFromUsers(trainersList) {
  const userMap = new Map();
  const ids = trainersList.map((t) => t.id).filter(Boolean);
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where(documentId(), 'in', chunk)),
      );
      snap.docs.forEach((d) => userMap.set(d.id, d.data() || {}));
    } catch (_) {
      /* fallback per-trainer below */
    }
  }

  return Promise.all(
    trainersList.map(async (t) => {
      let merged = { ...t };
      const ud = userMap.get(t.id);
      if (ud) {
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
      } else {
        try {
          const us = await getDoc(doc(db, 'users', t.id));
          if (us.exists()) {
            const fallback = us.data() || {};
            merged = {
              ...merged,
              name: merged.name || fallback.name || fallback.displayName || merged.displayName,
              displayName: merged.displayName || fallback.displayName || fallback.name,
            };
          }
        } catch (_) {
          /* keep trainer doc */
        }
      }
      const normalizedUrl = trainerPhotoUri(merged);
      if (normalizedUrl && !merged.photoURL) merged = { ...merged, photoURL: normalizedUrl };
      return resolveTrainerPhotoWithStorageFallback(merged, storage);
    }),
  );
}

const SearchTrainersScreen = ({
  onClose,
  onBack,
  title = 'Find a Trainer',
  showHeader = true,
  showBottomNav = true,
  /** When false, this screen skips its own nav but parent shell still shows BottomNavBar. */
  reserveShellBottomNav = false,
  onViewProfile,
  onRequestTrainer,
  onSelectTrainer,
  onProfilePress,
  onSettingsPress,
  isDark: isDarkProp,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
}) => {
  const headerBack = onBack ?? onClose;
  const { isDark: appIsDark } = useTheme();
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : appIsDark;
  const theme = getTheme(isDark);
  const shellNavInset = useShellBottomNavInset(24);
  const profileShellInset =
    showBottomNav !== false || reserveShellBottomNav ? shellNavInset : 0;
  const listBottomPad =
    showBottomNav !== false || reserveShellBottomNav ? shellNavInset : Math.max(24, 32);
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
  const [visibleCount, setVisibleCount] = useState(MARKETPLACE_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreFromFirestore, setHasMoreFromFirestore] = useState(true);
  const lastTrainerDocRef = useRef(null);
  const useTrainersCollectionRef = useRef(true);

  const fetchTrainerPage = useCallback(async (reset) => {
    if (reset) {
      lastTrainerDocRef.current = null;
      setHasMoreFromFirestore(true);
    }

    let rows = [];
    const pageSize = FIRESTORE_TRAINER_PAGE_SIZE;

    const loadFromCollection = async (collName, withRoleFilter) => {
      const base = collection(db, collName);
      let q = query(base, orderBy(documentId()), limit(pageSize));
      if (!reset && lastTrainerDocRef.current) {
        q = query(base, orderBy(documentId()), startAfter(lastTrainerDocRef.current), limit(pageSize));
      }
      if (withRoleFilter) {
        q = reset || !lastTrainerDocRef.current
          ? query(base, where('role', '==', 'trainer'), orderBy(documentId()), limit(pageSize))
          : query(
              base,
              where('role', '==', 'trainer'),
              orderBy(documentId()),
              startAfter(lastTrainerDocRef.current),
              limit(pageSize),
            );
      }
      const snap = await getDocs(q);
      if (!snap.empty) {
        lastTrainerDocRef.current = snap.docs[snap.docs.length - 1];
      }
      if (snap.size < pageSize) {
        setHasMoreFromFirestore(false);
      }
      snap.docs.forEach((d) => rows.push({ id: d.id, ...d.data() }));
    };

    try {
      if (useTrainersCollectionRef.current) {
        await loadFromCollection('trainers', false);
      } else {
        await loadFromCollection('users', true);
      }
    } catch (err) {
      if (useTrainersCollectionRef.current) {
        useTrainersCollectionRef.current = false;
        lastTrainerDocRef.current = null;
        await loadFromCollection('users', true);
      } else {
        throw err;
      }
    }

    return enrichTrainersFromUsers(rows);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchTrainerPage(true);
        setTrainers(data);
        setVisibleCount(MARKETPLACE_PAGE_SIZE);
      } catch (e) {
        if (__DEV__) console.error('SearchTrainersScreen load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchTrainerPage]);

  const normalized = useMemo(
    () => trainers.map((t, i) => normalizeTrainer(t, i)),
    [trainers]
  );

  const filtered = useMemo(
    () => filterTrainers(normalized, filters, { query: search, quickSpecialty }),
    [normalized, filters, search, quickSpecialty]
  );

  const visibleTrainers = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const loadMoreTrainers = async () => {
    if (loadingMore) return;
    if (visibleCount < filtered.length) {
      setLoadingMore(true);
      setVisibleCount((c) => Math.min(c + MARKETPLACE_PAGE_SIZE, filtered.length));
      setLoadingMore(false);
      return;
    }
    if (!hasMoreFromFirestore) return;

    setLoadingMore(true);
    try {
      const nextPage = await fetchTrainerPage(false);
      if (nextPage.length > 0) {
        setTrainers((prev) => {
          const seen = new Set(prev.map((t) => t.id));
          const merged = [...prev];
          nextPage.forEach((t) => {
            if (!seen.has(t.id)) merged.push(t);
          });
          return merged;
        });
        setVisibleCount((c) => c + MARKETPLACE_PAGE_SIZE);
      }
    } catch (e) {
      if (__DEV__) console.error('SearchTrainersScreen loadMore error:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setVisibleCount(MARKETPLACE_PAGE_SIZE);
  }, [filters, search, quickSpecialty]);

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
        setRequestConfirmTrainer(null);
        setRequestIntroTrainer(null);
        setRequestIntroDraft('');
        showTrainerRequestSentAlert(raw, () => closeProfile());
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
    <SafeAreaView style={[s.shell, { backgroundColor: theme.background }]} edges={SHELL_SAFE_AREA_EDGES}>
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
          shellBottomInset={profileShellInset}
        />
      ) : (
        <BrowseTrainersScreen
          trainers={visibleTrainers}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={visibleCount < filtered.length}
          onLoadMore={loadMoreTrainers}
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
          listBottomPad={listBottomPad}
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

      </View>

      {showBottomNav !== false ? (
        <ShellBottomNavAnchor>
          <BottomNavBar
            onHomePress={onHomePress}
            onPlusPress={onPlusPress}
            onVoicePress={onVoicePress}
            onNutritionPress={onNutritionPress}
            onWorkoutPress={onWorkoutPress}
            onMessagesPress={onMessagesPress}
            onProfilePress={onProfilePress}
          />
        </ShellBottomNavAnchor>
      ) : null}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  shell: { flex: 1 },
  headerWrap: {},
  body: { flex: 1, position: 'relative' },
});

export { TrainerProfileSheet };
export default SearchTrainersScreen;
