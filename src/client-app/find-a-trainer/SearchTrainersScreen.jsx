// Find-a-Trainer marketplace: page trainers from Firestore, filter them, then request a connection.
// Flow: load a page → enrich photos/names from users → browse / profile → confirm → optional intro → send.
// Used by the client shell. Filters and paging stay here; BrowseTrainersScreen only paints the list.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
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
import { db, storage } from '../../app-start/cloudConnection';
import { trainerPhotoUri, resolveTrainerPhotoWithStorageFallback } from '../../helpers/trainerProfilePhoto';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import ConfirmRequestPopup from './ConfirmRequestPopup';
import RequestIntroPopup from './RequestIntroPopup';
import BrowseTrainersScreen from './BrowseTrainersScreen';
import FilterPopup from './FilterPopup';
import { TrainerProfileSheet } from './TrainerProfilePopup';
import { showTrainerRequestSentAlert } from './sendConnectionRequest';
import { useShellBottomNavInset, SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import {
  DEFAULT_FILTERS,
  filterTrainers,
  normalizeTrainer,
  getTheme,
} from './trainerFilters';

// ===== NAMED CONSTANTS =====

const MARKETPLACE_PAGE_SIZE = 30;
const FIRESTORE_TRAINER_PAGE_SIZE = 20;
const FIRESTORE_IN_CHUNK = 30;
const SHELL_NAV_INSET_FALLBACK = 24;
const LIST_PAD_WHEN_NO_NAV = 24;
const LIST_PAD_NO_NAV_EXTRA = 32;
const USERS_COLLECTION = 'users';
const TRAINERS_COLLECTION = 'trainers';
const ROLE_FIELD = 'role';
const ROLE_TRAINER = 'trainer';
const DEFAULT_QUICK_SPECIALTY = 'All';
const DEFAULT_TRAINER_NAME = 'Trainer';

// ===== HELPER FUNCTIONS =====

function photoFromUserDoc(userData) {
  return userData.photoURL || userData.photoUrl || userData.profilePhoto || userData.avatarUrl || userData.photo || null;
}

function mergeUserFieldsIntoTrainer(trainer, userData) {
  const fromUser = photoFromUserDoc(userData);
  const picked =
    trainerPhotoUri(trainer) ||
    (fromUser ? String(fromUser).trim() : null) ||
    trainer.photoURL ||
    trainer.photoUrl ||
    null;
  return {
    ...trainer,
    photoURL: picked || null,
    displayName: trainer.displayName || userData.displayName || userData.name || trainer.name || null,
    name: trainer.name || userData.name || userData.displayName || trainer.displayName || null,
  };
}

async function fillMissingNameFromUserDoc(trainer) {
  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, trainer.id));
    if (!userSnap.exists()) return trainer;
    const fallback = userSnap.data() || {};
    return {
      ...trainer,
      name: trainer.name || fallback.name || fallback.displayName || trainer.displayName,
      displayName: trainer.displayName || fallback.displayName || fallback.name,
    };
  } catch {
    return trainer;
  }
}

async function enrichOneTrainer(trainer, userMap) {
  let merged = { ...trainer };
  const userData = userMap.get(trainer.id);
  if (userData) {
    merged = mergeUserFieldsIntoTrainer(merged, userData);
  } else {
    merged = await fillMissingNameFromUserDoc(merged);
  }
  const normalizedUrl = trainerPhotoUri(merged);
  if (normalizedUrl && !merged.photoURL) merged = { ...merged, photoURL: normalizedUrl };
  return resolveTrainerPhotoWithStorageFallback(merged, storage);
}

async function loadUserDocsByIds(ids) {
  const userMap = new Map();
  for (let i = 0; i < ids.length; i += FIRESTORE_IN_CHUNK) {
    const chunk = ids.slice(i, i + FIRESTORE_IN_CHUNK);
    try {
      // vocab: documentId() + 'in' reads many user docs in one query. Firestore caps `in` at 30.
      const snap = await getDocs(
        query(collection(db, USERS_COLLECTION), where(documentId(), 'in', chunk)),
      );
      snap.docs.forEach((userDoc) => userMap.set(userDoc.id, userDoc.data() || {}));
    } catch {
      // fallback per-trainer below
    }
  }
  return userMap;
}

async function enrichEachTrainerWithUserPhoto(trainersList, userMap) {
  return Promise.all(trainersList.map((trainer) => enrichOneTrainer(trainer, userMap)));
}

async function enrichTrainersFromUsers(trainersList) {
  const ids = trainersList.map((trainer) => trainer.id).filter(Boolean);
  const userMap = await loadUserDocsByIds(ids);
  return enrichEachTrainerWithUserPhoto(trainersList, userMap);
}

/**
 * vocab: startAfter = next page after the last doc we already have. orderBy(documentId()) is a stable cursor.
 */
function trainerPageQuery(collectionRef, lastDoc, reset, withRoleFilter, pageSize) {
  if (withRoleFilter) {
    if (reset || !lastDoc) {
      return query(collectionRef, where(ROLE_FIELD, '==', ROLE_TRAINER), orderBy(documentId()), limit(pageSize));
    }
    return query(
      collectionRef,
      where(ROLE_FIELD, '==', ROLE_TRAINER),
      orderBy(documentId()),
      startAfter(lastDoc),
      limit(pageSize),
    );
  }
  if (!reset && lastDoc) {
    return query(collectionRef, orderBy(documentId()), startAfter(lastDoc), limit(pageSize));
  }
  return query(collectionRef, orderBy(documentId()), limit(pageSize));
}

async function loadTrainerRowsFromCollection(collName, withRoleFilter, lastDoc, reset, pageSize) {
  const base = collection(db, collName);
  const trainerQuery = trainerPageQuery(base, lastDoc, reset, withRoleFilter, pageSize);
  const snap = await getDocs(trainerQuery);
  const rows = [];
  snap.docs.forEach((trainerDoc) => rows.push({ id: trainerDoc.id, ...trainerDoc.data() }));
  return {
    rows,
    lastDoc: snap.empty ? lastDoc : snap.docs[snap.docs.length - 1],
    isShortPage: snap.size < pageSize,
  };
}

/**
 * Prefer the `trainers` collection. If that query fails, switch to `users` with role=trainer.
 */
async function loadTrainerPagePreferringTrainersCollection({
  useTrainersCollection,
  lastDoc,
  reset,
  pageSize,
}) {
  if (!useTrainersCollection) {
    return loadTrainerRowsFromCollection(USERS_COLLECTION, true, lastDoc, reset, pageSize);
  }
  try {
    return await loadTrainerRowsFromCollection(TRAINERS_COLLECTION, false, lastDoc, reset, pageSize);
  } catch {
    const usersPage = await loadTrainerRowsFromCollection(USERS_COLLECTION, true, null, reset, pageSize);
    return { ...usersPage, switchedToUsers: true };
  }
}

function mergeNewTrainerPage(previous, nextPage) {
  const seen = new Set(previous.map((trainer) => trainer.id));
  const merged = [...previous];
  nextPage.forEach((trainer) => {
    if (!seen.has(trainer.id)) merged.push(trainer);
  });
  return merged;
}

function firebaseTrainer(uiTrainer) {
  return uiTrainer?._firebase || uiTrainer;
}

function trainerDisplayName(trainer) {
  return trainer?.name || trainer?.displayName || DEFAULT_TRAINER_NAME;
}

function SearchTrainersScreenLayout({
  closeProfile,
  closeRequestConfirm,
  closeRequestIntro,
  completeFromIntro,
  confirmSendRequest,
  filtered,
  filters,
  filtersOpen,
  headerBackHandler,
  headerTitle,
  isDark,
  listBottomPad,
  loadMoreTrainers,
  loading,
  loadingMore,
  onHomePress,
  onMessagesPress,
  onNutritionPress,
  onPlusPress,
  onProfilePress,
  onSettingsPress,
  onVoicePress,
  onWorkoutPress,
  openConnectFlow,
  openMessageFlow,
  openProfile,
  profileOpen,
  profileShellInset,
  profileTrainer,
  quickSpecialty,
  requestConfirmTrainer,
  requestIntroDraft,
  requestIntroTrainer,
  requesting,
  search,
  setFilters,
  setFiltersOpen,
  setQuickSpecialty,
  setRequestIntroDraft,
  setSearch,
  showBottomNav,
  showHeader,
  theme,
  visibleCount,
  visibleTrainers,
}) {
  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: theme.background }]} edges={SHELL_SAFE_AREA_EDGES}>
      {showHeader !== false ? (
        <View style={styles.headerWrap}>
          <TopHeader
            title={headerTitle}
            isDark={isDark}
            skipTopSafeInset
            onBack={headerBackHandler}
            onProfilePress={onProfilePress}
            onSettingsPress={onSettingsPress}
          />
        </View>
      ) : null}

      <View style={styles.body}>
      {profileOpen && profileTrainer ? (
        <TrainerProfileSheet
          embedded
          trainer={profileTrainer}
          visible
          onClose={closeProfile}
          onMessage={(trainer) => openMessageFlow(trainer)}
          onConnect={(trainer) => openConnectFlow(trainer)}
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

      <FilterPopup
        visible={filtersOpen}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={setFilters}
        isDark={isDark}
      />

      <RequestIntroPopup
        visible={!!requestIntroTrainer}
        trainerName={trainerDisplayName(requestIntroTrainer)}
        messageDraft={requestIntroDraft}
        onChangeMessage={setRequestIntroDraft}
        onSkip={completeFromIntro}
        onSendMessage={completeFromIntro}
        onClose={closeRequestIntro}
        isDark={isDark}
        busy={requesting}
      />

      <ConfirmRequestPopup
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
          <BottomMenuBar
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
}

// ===== MAIN FUNCTION =====

/**
 * Find-a-Trainer screen: load pages, filter, open a profile, then send a connection request.
 * vocab: useRef holds the Firestore cursor and whether we are still on the trainers collection.
 * @param {object} props
 */
const SearchTrainersScreen = ({
  onClose,
  onBack,
  title = 'Find a Trainer',
  showHeader = true,
  showBottomNav = true,
  /** When false, this screen skips its own nav but parent shell still shows BottomMenuBar. */
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
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET_FALLBACK);
  const profileShellInset =
    showBottomNav !== false || reserveShellBottomNav ? shellNavInset : 0;
  const listBottomPad =
    showBottomNav !== false || reserveShellBottomNav ? shellNavInset : Math.max(LIST_PAD_WHEN_NO_NAV, LIST_PAD_NO_NAV_EXTRA);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [quickSpecialty, setQuickSpecialty] = useState(DEFAULT_QUICK_SPECIALTY);
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

    // 1. Prefer the trainers collection; fall back to users with role=trainer.
    const page = await loadTrainerPagePreferringTrainersCollection({
      useTrainersCollection: useTrainersCollectionRef.current,
      lastDoc: lastTrainerDocRef.current,
      reset,
      pageSize: FIRESTORE_TRAINER_PAGE_SIZE,
    });
    if (page.switchedToUsers) {
      useTrainersCollectionRef.current = false;
    }
    lastTrainerDocRef.current = page.lastDoc;
    if (page.isShortPage) setHasMoreFromFirestore(false);

    // 2. Fill photos and names from the matching users docs.
    return enrichTrainersFromUsers(page.rows);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchTrainerPage(true);
        setTrainers(data);
        setVisibleCount(MARKETPLACE_PAGE_SIZE);
      } catch (error) {
        if (__DEV__) console.error('SearchTrainersScreen load error:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchTrainerPage]);

  const normalized = useMemo(
    () => trainers.map((trainer, index) => normalizeTrainer(trainer, index)),
    [trainers],
  );

  const filtered = useMemo(
    () => filterTrainers(normalized, filters, { query: search, quickSpecialty }),
    [normalized, filters, search, quickSpecialty],
  );

  const visibleTrainers = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const loadMoreTrainers = async () => {
    if (loadingMore) return;

    // 1. Still have filtered rows we have not shown — just raise the slice.
    if (visibleCount < filtered.length) {
      setLoadingMore(true);
      setVisibleCount((currentCount) => Math.min(currentCount + MARKETPLACE_PAGE_SIZE, filtered.length));
      setLoadingMore(false);
      return;
    }
    if (!hasMoreFromFirestore) return;

    // 2. Ask Firestore for the next page and append trainers we have not seen.
    setLoadingMore(true);
    try {
      const nextPage = await fetchTrainerPage(false);
      if (nextPage.length > 0) {
        setTrainers((previous) => mergeNewTrainerPage(previous, nextPage));
        setVisibleCount((currentCount) => currentCount + MARKETPLACE_PAGE_SIZE);
      }
    } catch (error) {
      if (__DEV__) console.error('SearchTrainersScreen loadMore error:', error);
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

    // 1. Parent-owned request: send the optional intro, then clear the popups.
    if (onRequestTrainer) {
      setRequesting(true);
      try {
        const customIntro = String(requestIntroDraft || '').trim();
        await onRequestTrainer(raw, { clientIntro: customIntro || undefined });
        setRequestConfirmTrainer(null);
        setRequestIntroTrainer(null);
        setRequestIntroDraft('');
        showTrainerRequestSentAlert(raw, () => closeProfile());
      } catch (error) {
        console.error('Trainer request failed:', error);
        Alert.alert('Request failed', error?.message || 'Please try again.');
      } finally {
        setRequesting(false);
      }
      return;
    }

    // 2. No request handler — fall back to select or view-profile.
    if (onSelectTrainer) onSelectTrainer(raw);
    else if (onViewProfile) onViewProfile(raw);
  };

  const confirmSendRequest = () => {
    proceedFromConfirmToMessage();
  };

  const completeFromIntro = () => {
    const introTrainer = requestIntroTrainer || requestConfirmTrainer;
    if (introTrainer) runRequest(introTrainer);
  };

  const profileTitle =
    profileTrainer?.name || profileTrainer?.displayName || 'Trainer profile';
  const headerTitle = profileOpen ? profileTitle : title;
  const headerBackHandler = profileOpen ? closeProfile : headerBack;

  const screenLayout = {
    closeProfile,
    closeRequestConfirm,
    closeRequestIntro,
    completeFromIntro,
    confirmSendRequest,
    filtered,
    filters,
    filtersOpen,
    headerBackHandler,
    headerTitle,
    isDark,
    listBottomPad,
    loadMoreTrainers,
    loading,
    loadingMore,
    onHomePress,
    onMessagesPress,
    onNutritionPress,
    onPlusPress,
    onProfilePress,
    onSettingsPress,
    onVoicePress,
    onWorkoutPress,
    openConnectFlow,
    openMessageFlow,
    openProfile,
    profileOpen,
    profileShellInset,
    profileTrainer,
    quickSpecialty,
    requestConfirmTrainer,
    requestIntroDraft,
    requestIntroTrainer,
    requesting,
    search,
    setFilters,
    setFiltersOpen,
    setQuickSpecialty,
    setRequestIntroDraft,
    setSearch,
    showBottomNav,
    showHeader,
    theme,
    visibleCount,
    visibleTrainers,
  };
  return <SearchTrainersScreenLayout {...screenLayout} />;
};

const styles = StyleSheet.create({
  shell: { flex: 1 },
  headerWrap: {},
  body: { flex: 1, position: 'relative' },
});

export { TrainerProfileSheet };
export default SearchTrainersScreen;
