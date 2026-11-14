// Find-a-Trainer marketplace: page trainers from Firestore, filter them, then request a connection.
// Flow: load a page → enrich photos/names from users → browse / profile → confirm → optional intro → send.
// Used by the client shell. Filters and paging stay here; BrowseTrainersScreen paints the list chrome.
// Read order: helpers → layout (no data hooks) → screen main (hooks + handlers) → PLUMBING Firestore helpers.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
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
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import ConfirmRequestPopup from './ConfirmRequestPopup';
import RequestIntroPopup from './RequestIntroPopup';
import BrowseTrainersScreen from './BrowseTrainersScreen';
import FilterPopup from './FilterPopup';
import { TrainerProfileSheet } from './TrainerProfilePopup';
import { useShellBottomNavInset, SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import {
  DEFAULT_FILTERS,
  filterTrainers,
  normalizeTrainer,
  clientMatchPrefsFromProfile,
} from './trainerFilters';

// ===== NAMED CONSTANTS =====

// Manipulate here: how many filtered rows we show before “load more” expands the slice.
const MARKETPLACE_PAGE_SIZE = 30;
// Manipulate here: how many trainer docs one Firestore page asks for.
const FIRESTORE_TRAINER_PAGE_SIZE = 20;
// Manipulate here: Firestore `in` query max — keep at 30 (server hard cap).
const FIRESTORE_IN_CHUNK = 30;
const SHELL_NAV_INSET_FALLBACK = 24;
const LIST_PAD_WHEN_NO_NAV = 24;
const LIST_PAD_NO_NAV_EXTRA = 32;

// Firestore path / field letters stay frozen.
const USERS_COLLECTION = 'users';
const TRAINERS_COLLECTION = 'trainers';
const ROLE_FIELD = 'role';
const ROLE_TRAINER = 'trainer';

const DEFAULT_QUICK_SPECIALTY = 'All';
const DEFAULT_TRAINER_NAME = 'Trainer';
const OUTCOME_VARIANT_SENT = 'sent';
const OUTCOME_VARIANT_ERROR = 'error';
const SESSION_TYPE_REMOTE = 'Remote';

// ===== HELPER FUNCTIONS =====

function firestoreTrainerDoc(uiTrainer) {
  if (!uiTrainer) {
    return uiTrainer;
  }
  if (uiTrainer._firebase) {
    return uiTrainer._firebase;
  }
  return uiTrainer;
}

function trainerDisplayName(trainer) {
  if (!trainer) {
    return DEFAULT_TRAINER_NAME;
  }
  if (trainer.name) {
    return trainer.name;
  }
  if (trainer.displayName) {
    return trainer.displayName;
  }
  return DEFAULT_TRAINER_NAME;
}

function normalizeTrainerList(trainersList) {
  const normalizedRows = [];
  for (let index = 0; index < trainersList.length; index += 1) {
    normalizedRows.push(normalizeTrainer(trainersList[index], index));
  }
  return normalizedRows;
}

function sliceVisibleTrainers(filteredList, visibleCount) {
  return filteredList.slice(0, visibleCount);
}

function listBottomPadForShell(parentShowsBottomNav, shellNavInset) {
  if (parentShowsBottomNav) {
    return shellNavInset;
  }
  return Math.max(LIST_PAD_WHEN_NO_NAV, LIST_PAD_NO_NAV_EXTRA);
}

function resolveIsDark(isDarkProp, appIsDark) {
  if (typeof isDarkProp === 'boolean') {
    return isDarkProp;
  }
  return appIsDark;
}

function raiseVisibleCountWithinFiltered(currentCount, filteredLength) {
  return Math.min(currentCount + MARKETPLACE_PAGE_SIZE, filteredLength);
}

function customIntroFromDraft(requestIntroDraft) {
  const customIntro = String(requestIntroDraft || '').trim();
  if (customIntro) {
    return customIntro;
  }
  return undefined;
}

function ignoreUnusedProp(unusedValue) {
  void unusedValue;
}

// ===== LAYOUT (theme hook only — no screen data hooks) =====

function MarketplaceBrowseOrProfile({
  showProfileSheet,
  profileTrainer,
  closeProfile,
  openMessageFlow,
  openConnectFlow,
  isDark,
  requesting,
  profileShellInset,
  visibleTrainers,
  loading,
  loadingMore,
  listHasMore,
  loadMoreTrainers,
  filters,
  search,
  setSearch,
  quickSpecialty,
  setQuickSpecialty,
  openProfile,
  setFiltersOpen,
  clearFilters,
  showRemoteTrainers,
  browseBackHandler,
  listBottomPad,
}) {
  if (showProfileSheet) {
    return (
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
    );
  }

  return (
    <BrowseTrainersScreen
      trainers={visibleTrainers}
      loading={loading}
      loadingMore={loadingMore}
      hasMore={listHasMore}
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
      onClearFilters={clearFilters}
      onShowRemote={showRemoteTrainers}
      onBack={browseBackHandler}
      listBottomPad={listBottomPad}
    />
  );
}

function MarketplaceShellBottomNav({
  showShellBottomNav,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onProfilePress,
}) {
  if (!showShellBottomNav) {
    return null;
  }

  return (
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
  );
}

function SearchTrainersScreenLayout({
  clearFilters,
  closeOutcomeSheet,
  closeProfile,
  closeRequestConfirm,
  closeRequestIntro,
  completeFromIntro,
  confirmSendRequest,
  filtered,
  filters,
  filtersOpen,
  headerBackHandler,
  isDark,
  listBottomPad,
  loadMoreTrainers,
  loading,
  loadingMore,
  normalized,
  onHomePress,
  onMessagesPress,
  onNutritionPress,
  onPlusPress,
  onProfilePress,
  onVoicePress,
  onWorkoutPress,
  openConnectFlow,
  openMessageFlow,
  openProfile,
  outcomeTrainer,
  outcomeVariant,
  profileOpen,
  profileShellInset,
  profileTrainer,
  quickSpecialty,
  requestConfirmTrainer,
  requestIntroDraft,
  requestIntroTrainer,
  requesting,
  retryFailedRequest,
  search,
  setFilters,
  setFiltersOpen,
  setQuickSpecialty,
  setRequestIntroDraft,
  setSearch,
  showBottomNav,
  showHeader,
  showRemoteTrainers,
  visibleCount,
  visibleTrainers,
}) {
  const { colors } = useTheme();

  const showProfileSheet = profileOpen && profileTrainer;
  const introSheetVisible = Boolean(requestIntroTrainer);
  const confirmSheetVisible = Boolean(requestConfirmTrainer);
  const outcomeSheetVisible = Boolean(outcomeTrainer) && Boolean(outcomeVariant);
  const listHasMore = visibleCount < filtered.length;
  const showShellBottomNav = showBottomNav !== false;
  const showBrowseBack = showHeader !== false;

  let browseBackHandler = undefined;
  if (showBrowseBack) {
    browseBackHandler = headerBackHandler;
  }

  const introTrainerName = trainerDisplayName(requestIntroTrainer);
  const firestoreOutcomeTrainer = firestoreTrainerDoc(outcomeTrainer);
  const firestoreConfirmTrainer = firestoreTrainerDoc(requestConfirmTrainer);

  let outcomePopupVariant = OUTCOME_VARIANT_SENT;
  if (outcomeVariant) {
    outcomePopupVariant = outcomeVariant;
  }

  const shellBackgroundColor = colors.nbBackground;

  function openMessageFromOutcome() {
    const trainerForMessage = outcomeTrainer;
    closeOutcomeSheet();
    if (trainerForMessage) {
      openMessageFlow(trainerForMessage);
    }
  }

  return (
    <SafeAreaView
      style={[styles.shell, { backgroundColor: shellBackgroundColor }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <View style={styles.body}>
        <MarketplaceBrowseOrProfile
          showProfileSheet={showProfileSheet}
          profileTrainer={profileTrainer}
          closeProfile={closeProfile}
          openMessageFlow={openMessageFlow}
          openConnectFlow={openConnectFlow}
          isDark={isDark}
          requesting={requesting}
          profileShellInset={profileShellInset}
          visibleTrainers={visibleTrainers}
          loading={loading}
          loadingMore={loadingMore}
          listHasMore={listHasMore}
          loadMoreTrainers={loadMoreTrainers}
          filters={filters}
          search={search}
          setSearch={setSearch}
          quickSpecialty={quickSpecialty}
          setQuickSpecialty={setQuickSpecialty}
          openProfile={openProfile}
          setFiltersOpen={setFiltersOpen}
          clearFilters={clearFilters}
          showRemoteTrainers={showRemoteTrainers}
          browseBackHandler={browseBackHandler}
          listBottomPad={listBottomPad}
        />

        <FilterPopup
          visible={filtersOpen}
          filters={filters}
          onClose={() => setFiltersOpen(false)}
          onApply={setFilters}
          trainers={normalized}
          search={search}
          quickSpecialty={quickSpecialty}
        />

        <RequestIntroPopup
          visible={introSheetVisible}
          trainerName={introTrainerName}
          messageDraft={requestIntroDraft}
          onChangeMessage={setRequestIntroDraft}
          onSkip={completeFromIntro}
          onSendMessage={completeFromIntro}
          onClose={closeRequestIntro}
          busy={requesting}
        />

        <ConfirmRequestPopup
          visible={confirmSheetVisible}
          trainer={firestoreConfirmTrainer}
          onCancel={closeRequestConfirm}
          onConfirm={confirmSendRequest}
          busy={requesting}
          variant="confirm"
        />

        <ConfirmRequestPopup
          visible={outcomeSheetVisible}
          trainer={firestoreOutcomeTrainer}
          variant={outcomePopupVariant}
          onCancel={closeOutcomeSheet}
          onGotIt={closeOutcomeSheet}
          onRetry={retryFailedRequest}
          onMessage={openMessageFromOutcome}
        />
      </View>

      <MarketplaceShellBottomNav
        showShellBottomNav={showShellBottomNav}
        onHomePress={onHomePress}
        onPlusPress={onPlusPress}
        onVoicePress={onVoicePress}
        onNutritionPress={onNutritionPress}
        onWorkoutPress={onWorkoutPress}
        onMessagesPress={onMessagesPress}
        onProfilePress={onProfilePress}
      />
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Find-a-Trainer marketplace screen — pages trainers, filters locally, runs connect flow.
 * @param {object} props
 */
function SearchTrainersScreen({
  onClose,
  onBack,
  title: _title = 'Find a Trainer',
  showHeader = true,
  showBottomNav = true,
  reserveShellBottomNav = false,
  onViewProfile,
  onRequestTrainer,
  onSelectTrainer,
  onProfilePress,
  onSettingsPress: _onSettingsPress,
  isDark: isDarkProp,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  clientProfile = null,
}) {
  // Hook order is frozen — do not reorder these calls.
  ignoreUnusedProp(_title);
  ignoreUnusedProp(_onSettingsPress);

  const headerBack = onBack ?? onClose;
  const { isDark: appIsDark } = useTheme();
  const isDark = resolveIsDark(isDarkProp, appIsDark);
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET_FALLBACK);
  const parentShowsBottomNav = showBottomNav !== false || reserveShellBottomNav;
  const profileShellInset = parentShowsBottomNav ? shellNavInset : 0;
  const listBottomPad = listBottomPadForShell(parentShowsBottomNav, shellNavInset);

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
  const [outcomeVariant, setOutcomeVariant] = useState(null);
  const [outcomeTrainer, setOutcomeTrainer] = useState(null);
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
    if (page.isShortPage) {
      setHasMoreFromFirestore(false);
    }

    // 2. Fill photos and names from the matching users docs.
    return enrichTrainersFromUsers(page.rows);
  }, []);

  useEffect(() => {
    const loadFirstPage = async () => {
      setLoading(true);
      try {
        const data = await fetchTrainerPage(true);
        setTrainers(data);
        setVisibleCount(MARKETPLACE_PAGE_SIZE);
      } catch (error) {
        if (__DEV__) {
          console.error('SearchTrainersScreen load error:', error);
        }
      } finally {
        setLoading(false);
      }
    };
    loadFirstPage();
  }, [fetchTrainerPage]);

  const normalized = useMemo(
    () => normalizeTrainerList(trainers),
    [trainers],
  );

  const clientPrefs = useMemo(
    () => clientMatchPrefsFromProfile(clientProfile),
    [clientProfile],
  );

  const filtered = useMemo(
    () =>
      filterTrainers(normalized, filters, {
        query: search,
        quickSpecialty,
        clientPrefs,
      }),
    [normalized, filters, search, quickSpecialty, clientPrefs],
  );

  const visibleTrainers = useMemo(
    () => sliceVisibleTrainers(filtered, visibleCount),
    [filtered, visibleCount],
  );

  async function loadMoreTrainers() {
    if (loadingMore) {
      return;
    }

    // 1. Still have filtered rows we have not shown — just raise the slice.
    if (visibleCount < filtered.length) {
      setLoadingMore(true);
      setVisibleCount((currentCount) =>
        raiseVisibleCountWithinFiltered(currentCount, filtered.length),
      );
      setLoadingMore(false);
      return;
    }
    if (!hasMoreFromFirestore) {
      return;
    }

    // 2. Ask Firestore for the next page and append trainers we have not seen.
    setLoadingMore(true);
    try {
      const nextPage = await fetchTrainerPage(false);
      if (nextPage.length > 0) {
        setTrainers((previous) => mergeNewTrainerPage(previous, nextPage));
        setVisibleCount((currentCount) => currentCount + MARKETPLACE_PAGE_SIZE);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('SearchTrainersScreen loadMore error:', error);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  // Filters / search / specialty change → snap the visible window back to page one.
  useEffect(() => {
    setVisibleCount(MARKETPLACE_PAGE_SIZE);
  }, [filters, search, quickSpecialty]);

  function openProfile(trainer) {
    setProfileTrainer(trainer);
    setProfileOpen(true);
  }

  function closeProfile() {
    setProfileOpen(false);
    setProfileTrainer(null);
  }

  function openConnectFlow(trainer) {
    if (!trainer) {
      return;
    }
    setRequestConfirmTrainer(trainer);
    setRequestIntroDraft('');
  }

  function openMessageFlow(trainer) {
    if (!trainer) {
      return;
    }
    setRequestIntroTrainer(trainer);
    setRequestIntroDraft('');
  }

  function closeRequestIntro() {
    if (requesting) {
      return;
    }
    setRequestIntroTrainer(null);
    setRequestIntroDraft('');
  }

  function closeRequestConfirm() {
    if (requesting) {
      return;
    }
    setRequestConfirmTrainer(null);
  }

  function proceedFromConfirmToMessage() {
    if (!requestConfirmTrainer) {
      return;
    }
    setRequestIntroTrainer(requestConfirmTrainer);
    setRequestConfirmTrainer(null);
  }

  function closeOutcomeSheet() {
    const requestSucceeded = outcomeVariant === OUTCOME_VARIANT_SENT;
    setOutcomeVariant(null);
    setOutcomeTrainer(null);
    if (requestSucceeded) {
      closeProfile();
    }
  }

  async function runRequest(trainer) {
    const trainerFromFirestore = firestoreTrainerDoc(trainer);
    if (!trainerFromFirestore) {
      return;
    }

    // 1. Parent-owned request: send the optional intro, then clear the popups.
    if (onRequestTrainer) {
      setRequesting(true);
      try {
        const customIntro = customIntroFromDraft(requestIntroDraft);
        // Firebase request payload key stays `clientIntro` — do not rename for branding.
        await onRequestTrainer(trainerFromFirestore, {
          clientIntro: customIntro,
        });
        setRequestConfirmTrainer(null);
        setRequestIntroTrainer(null);
        setRequestIntroDraft('');
        setOutcomeTrainer(trainer);
        setOutcomeVariant(OUTCOME_VARIANT_SENT);
      } catch (error) {
        console.error('Trainer request failed:', error);
        setRequestConfirmTrainer(null);
        setRequestIntroTrainer(null);
        setOutcomeTrainer(trainer);
        setOutcomeVariant(OUTCOME_VARIANT_ERROR);
      } finally {
        setRequesting(false);
      }
      return;
    }

    // 2. No request handler — Design Law unable-to-connect sheet (PNG 21/22).
    setRequestConfirmTrainer(null);
    setRequestIntroTrainer(null);
    setOutcomeTrainer(trainer);
    setOutcomeVariant(OUTCOME_VARIANT_ERROR);
    if (onSelectTrainer) {
      onSelectTrainer(trainerFromFirestore);
      return;
    }
    if (onViewProfile) {
      onViewProfile(trainerFromFirestore);
    }
  }

  function confirmSendRequest() {
    proceedFromConfirmToMessage();
  }

  function completeFromIntro() {
    const introTrainer = requestIntroTrainer || requestConfirmTrainer;
    if (introTrainer) {
      runRequest(introTrainer);
    }
  }

  function retryFailedRequest() {
    const trainerToRetry = outcomeTrainer;
    setOutcomeVariant(null);
    setOutcomeTrainer(null);
    if (trainerToRetry) {
      runRequest(trainerToRetry);
    }
  }

  function clearFilters() {
    setFilters({ ...DEFAULT_FILTERS });
    setQuickSpecialty(DEFAULT_QUICK_SPECIALTY);
    setSearch('');
  }

  function showRemoteTrainers() {
    setFilters({ ...DEFAULT_FILTERS, sessionType: SESSION_TYPE_REMOTE });
    setQuickSpecialty(DEFAULT_QUICK_SPECIALTY);
  }

  let headerBackHandler = headerBack;
  if (profileOpen) {
    headerBackHandler = closeProfile;
  }

  const screenLayout = {
    clearFilters,
    closeOutcomeSheet,
    closeProfile,
    closeRequestConfirm,
    closeRequestIntro,
    completeFromIntro,
    confirmSendRequest,
    filtered,
    filters,
    filtersOpen,
    headerBackHandler,
    isDark,
    listBottomPad,
    loadMoreTrainers,
    loading,
    loadingMore,
    normalized,
    onHomePress,
    onMessagesPress,
    onNutritionPress,
    onPlusPress,
    onProfilePress,
    onVoicePress,
    onWorkoutPress,
    openConnectFlow,
    openMessageFlow,
    openProfile,
    outcomeTrainer,
    outcomeVariant,
    profileOpen,
    profileShellInset,
    profileTrainer,
    quickSpecialty,
    requestConfirmTrainer,
    requestIntroDraft,
    requestIntroTrainer,
    requesting,
    retryFailedRequest,
    search,
    setFilters,
    setFiltersOpen,
    setQuickSpecialty,
    setRequestIntroDraft,
    setSearch,
    showBottomNav,
    showHeader,
    showRemoteTrainers,
    visibleCount,
    visibleTrainers,
  };

  return <SearchTrainersScreenLayout {...screenLayout} />;
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  body: { flex: 1, position: 'relative' },
});

export { TrainerProfileSheet };
export default SearchTrainersScreen;

// ===== PLUMBING — skip unless debugging Firestore paging / photo enrich =====

const USER_PHOTO_FIELD_KEYS = [
  'photoURL',
  'photoUrl',
  'profilePhoto',
  'avatarUrl',
  'photo',
];

function photoFromUserDoc(userData) {
  for (let index = 0; index < USER_PHOTO_FIELD_KEYS.length; index += 1) {
    const fieldKey = USER_PHOTO_FIELD_KEYS[index];
    const value = userData[fieldKey];
    if (value) {
      return value;
    }
  }
  return null;
}

function mergeUserFieldsIntoTrainer(trainer, userData) {
  const fromUser = photoFromUserDoc(userData);
  let photoFromUserString = null;
  if (fromUser) {
    photoFromUserString = String(fromUser).trim();
  }

  let bestPhotoUrl = trainerPhotoUri(trainer);
  if (!bestPhotoUrl) {
    bestPhotoUrl = photoFromUserString;
  }
  if (!bestPhotoUrl) {
    bestPhotoUrl = trainer.photoURL;
  }
  if (!bestPhotoUrl) {
    bestPhotoUrl = trainer.photoUrl;
  }

  let displayName = trainer.displayName;
  if (!displayName) {
    displayName = userData.displayName;
  }
  if (!displayName) {
    displayName = userData.name;
  }
  if (!displayName) {
    displayName = trainer.name;
  }

  let name = trainer.name;
  if (!name) {
    name = userData.name;
  }
  if (!name) {
    name = userData.displayName;
  }
  if (!name) {
    name = trainer.displayName;
  }

  return {
    ...trainer,
    photoURL: bestPhotoUrl || null,
    displayName: displayName || null,
    name: name || null,
  };
}

async function fillMissingNameFromUserDoc(trainer) {
  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, trainer.id));
    if (!userSnap.exists()) {
      return trainer;
    }
    const fallback = userSnap.data() || {};
    let name = trainer.name;
    if (!name) {
      name = fallback.name;
    }
    if (!name) {
      name = fallback.displayName;
    }
    if (!name) {
      name = trainer.displayName;
    }

    let displayName = trainer.displayName;
    if (!displayName) {
      displayName = fallback.displayName;
    }
    if (!displayName) {
      displayName = fallback.name;
    }

    return {
      ...trainer,
      name,
      displayName,
    };
  } catch {
    return trainer;
  }
}

async function enrichOneTrainer(trainer, userMap) {
  let trainerWithUserFields = { ...trainer };
  const userData = userMap.get(trainer.id);

  if (userData) {
    trainerWithUserFields = mergeUserFieldsIntoTrainer(trainerWithUserFields, userData);
  } else {
    trainerWithUserFields = await fillMissingNameFromUserDoc(trainerWithUserFields);
  }

  const normalizedUrl = trainerPhotoUri(trainerWithUserFields);
  const needsPhotoUrlCopy = normalizedUrl && !trainerWithUserFields.photoURL;
  if (needsPhotoUrlCopy) {
    trainerWithUserFields = { ...trainerWithUserFields, photoURL: normalizedUrl };
  }

  return resolveTrainerPhotoWithStorageFallback(trainerWithUserFields, storage);
}

function putUserDocsIntoMap(userMap, snap) {
  for (let docIndex = 0; docIndex < snap.docs.length; docIndex += 1) {
    const userDoc = snap.docs[docIndex];
    userMap.set(userDoc.id, userDoc.data() || {});
  }
}

async function loadOneUserDocChunk(chunk) {
  return getDocs(
    query(collection(db, USERS_COLLECTION), where(documentId(), 'in', chunk)),
  );
}

async function loadUserDocsByIds(ids) {
  const userMap = new Map();
  for (let startIndex = 0; startIndex < ids.length; startIndex += FIRESTORE_IN_CHUNK) {
    const chunk = ids.slice(startIndex, startIndex + FIRESTORE_IN_CHUNK);
    try {
      const snap = await loadOneUserDocChunk(chunk);
      putUserDocsIntoMap(userMap, snap);
    } catch {
      // Per-trainer getDoc fallback lives in enrichOneTrainer → fillMissingNameFromUserDoc.
    }
  }
  return userMap;
}

async function enrichEachTrainerWithUserPhoto(trainersList, userMap) {
  // Promise.all keeps photo storage lookups concurrent (same as before — behavior freeze).
  const enrichJobs = [];
  for (let index = 0; index < trainersList.length; index += 1) {
    enrichJobs.push(enrichOneTrainer(trainersList[index], userMap));
  }
  return Promise.all(enrichJobs);
}

async function enrichTrainersFromUsers(trainersList) {
  const ids = [];
  for (let index = 0; index < trainersList.length; index += 1) {
    const trainerId = trainersList[index].id;
    if (trainerId) {
      ids.push(trainerId);
    }
  }
  const userMap = await loadUserDocsByIds(ids);
  return enrichEachTrainerWithUserPhoto(trainersList, userMap);
}

function trainerPageQuery(collectionRef, lastDoc, reset, withRoleFilter, pageSize) {
  if (withRoleFilter) {
    return trainerPageQueryWithRole(collectionRef, lastDoc, reset, pageSize);
  }
  return trainerPageQueryWithoutRole(collectionRef, lastDoc, reset, pageSize);
}

function trainerPageQueryWithRole(collectionRef, lastDoc, reset, pageSize) {
  if (reset || !lastDoc) {
    return query(
      collectionRef,
      where(ROLE_FIELD, '==', ROLE_TRAINER),
      orderBy(documentId()),
      limit(pageSize),
    );
  }
  return query(
    collectionRef,
    where(ROLE_FIELD, '==', ROLE_TRAINER),
    orderBy(documentId()),
    startAfter(lastDoc),
    limit(pageSize),
  );
}

function trainerPageQueryWithoutRole(collectionRef, lastDoc, reset, pageSize) {
  if (!reset && lastDoc) {
    return query(
      collectionRef,
      orderBy(documentId()),
      startAfter(lastDoc),
      limit(pageSize),
    );
  }
  return query(collectionRef, orderBy(documentId()), limit(pageSize));
}

async function loadTrainerRowsFromCollection(collName, withRoleFilter, lastDoc, reset, pageSize) {
  const base = collection(db, collName);
  const trainerQuery = trainerPageQuery(base, lastDoc, reset, withRoleFilter, pageSize);
  const snap = await getDocs(trainerQuery);
  const rows = [];
  for (let index = 0; index < snap.docs.length; index += 1) {
    const trainerDoc = snap.docs[index];
    rows.push({ id: trainerDoc.id, ...trainerDoc.data() });
  }

  let pageLastDoc = lastDoc;
  if (!snap.empty) {
    pageLastDoc = snap.docs[snap.docs.length - 1];
  }

  return {
    rows,
    lastDoc: pageLastDoc,
    isShortPage: snap.size < pageSize,
  };
}

async function loadTrainerPagePreferringTrainersCollection({
  useTrainersCollection,
  lastDoc,
  reset,
  pageSize,
}) {
  if (!useTrainersCollection) {
    return loadTrainerRowsFromCollection(
      USERS_COLLECTION,
      true,
      lastDoc,
      reset,
      pageSize,
    );
  }
  try {
    return await loadTrainerRowsFromCollection(
      TRAINERS_COLLECTION,
      false,
      lastDoc,
      reset,
      pageSize,
    );
  } catch {
    const usersPage = await loadTrainerRowsFromCollection(
      USERS_COLLECTION,
      true,
      null,
      reset,
      pageSize,
    );
    return { ...usersPage, switchedToUsers: true };
  }
}

function mergeNewTrainerPage(previous, nextPage) {
  const seen = new Set();
  for (let index = 0; index < previous.length; index += 1) {
    seen.add(previous[index].id);
  }
  const merged = [...previous];
  for (let index = 0; index < nextPage.length; index += 1) {
    const trainer = nextPage[index];
    if (!seen.has(trainer.id)) {
      merged.push(trainer);
    }
  }
  return merged;
}
