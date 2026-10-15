// Progress photo gallery for one client: grid, filters, fullscreen, upload.
// Flow: listen to users/{clientId}/progressPhotos → filter/sort → tap to open → client can add a photo.
// Used by the client gallery tab and the trainer viewing a client's photos.

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AnimatedRe, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  clamp,
  runOnJS,
} from 'react-native-reanimated';
import { db, storage, auth } from '../../app-start/cloudConnection';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import TopHeader from '../loading-and-header/TopHeader';
import { BOTTOM_NAV_BAR_HEIGHT, SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

const GRADIENT_PRIMARY = ['#C1265A', '#D84315'];
const GRADIENT_CARD_BORDER = ['#C1265A', '#663399'];
const TABLET_MIN_WIDTH = 768;
const GRID_BOTTOM_EXTRA = 24;
const USERS_COLLECTION = 'users';
const PROGRESS_PHOTOS_COLLECTION = 'progressPhotos';

// Manipulate here: body-part chips and sort rows on the gallery.
const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'chest', label: 'Chest' },
  { id: 'legs', label: 'Legs' },
  { id: 'arms', label: 'Arms' },
  { id: 'full_body', label: 'Full Body' },
  { id: 'back', label: 'Back' },
];

const SORT_OPTIONS = [
  { id: 'date_desc', label: 'By Date (Newest)' },
  { id: 'date_asc', label: 'By Date (Oldest)' },
  { id: 'name', label: 'By Name' },
];

// ===== HELPER FUNCTIONS =====

function parsePhotoDate(photo) {
  // vocab: Firestore Timestamp has toDate(); a plain Date is already usable.
  if (photo.date?.toDate) return photo.date.toDate();
  if (photo.date instanceof Date) return photo.date;
  return new Date();
}

function isKnownFilterId(rawBodyPart) {
  for (const option of FILTER_OPTIONS) {
    if (option.id === rawBodyPart) return true;
  }
  return false;
}

function photoBodyPart(photo) {
  const raw = (photo.bodyPart || photo.category || photo.tag || '').toString().toLowerCase().replace(/\s+/g, '_');
  if (!raw) return 'other';
  if (isKnownFilterId(raw)) return raw;
  if (raw === 'fullbody' || raw === 'full-body') return 'full_body';
  return raw;
}

function photosFromSnapshot(snapshot) {
  const list = [];
  snapshot.forEach((photoDoc) => list.push({ id: photoDoc.id, ...photoDoc.data() }));
  return list;
}

function decoratePhoto(photo) {
  return {
    ...photo,
    _date: parsePhotoDate(photo),
    _body: photoBodyPart(photo),
    _name: (photo.storagePath || photo.url || photo.id || '').toString(),
  };
}

function decoratePhotoList(photoList) {
  const decorated = [];
  for (const photo of photoList) {
    decorated.push(decoratePhoto(photo));
  }
  return decorated;
}

function photosMatchingFilter(decoratedPhotos, filterId) {
  if (filterId === 'all') return [...decoratedPhotos];
  const matched = [];
  for (const photo of decoratedPhotos) {
    if (photo._body === filterId) matched.push(photo);
  }
  return matched;
}

function sortProgressPhotos(photoList, sortId) {
  const sorted = [...photoList];
  if (sortId === 'date_desc') {
    sorted.sort((leftPhoto, rightPhoto) => rightPhoto._date - leftPhoto._date);
    return sorted;
  }
  if (sortId === 'date_asc') {
    sorted.sort((leftPhoto, rightPhoto) => leftPhoto._date - rightPhoto._date);
    return sorted;
  }
  sorted.sort((leftPhoto, rightPhoto) => leftPhoto._name.localeCompare(rightPhoto._name));
  return sorted;
}

function pickedImageUri(pickerResult) {
  if (pickerResult.canceled) return null;
  const firstAsset = pickerResult.assets && pickerResult.assets[0];
  return firstAsset && firstAsset.uri ? firstAsset.uri : null;
}

async function uploadProgressPhoto({ clientId, localUri, uploadedByUid }) {
  const filename = `${Date.now()}.jpg`;
  const storageRef = ref(storage, `progressPhotos/${clientId}/${filename}`);
  const response = await fetch(localUri);
  const blob = await response.blob();
  await uploadBytes(storageRef, blob);
  const downloadUrl = await getDownloadURL(storageRef);
  const colRef = collection(db, USERS_COLLECTION, clientId, PROGRESS_PHOTOS_COLLECTION);
  await addDoc(colRef, {
    url: downloadUrl,
    date: serverTimestamp(),
    uploadedBy: uploadedByUid || null,
    clientId,
    storagePath: storageRef.fullPath,
  });
}

async function deleteProgressPhoto({ photo, clientId }) {
  if (photo.storagePath && storage) {
    await deleteObject(ref(storage, photo.storagePath));
  }
  if (db && clientId && photo.id) {
    await deleteDoc(doc(db, USERS_COLLECTION, clientId, PROGRESS_PHOTOS_COLLECTION, photo.id));
  }
}

function formatPhotoDateLine(dateObj) {
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function findSortLabel(sortId) {
  for (const option of SORT_OPTIONS) {
    if (option.id === sortId) return option.label.replace(/^By /, '');
  }
  return 'Date';
}

function findFilterLabel(filterId) {
  for (const option of FILTER_OPTIONS) {
    if (option.id === filterId) return option.label;
  }
  return 'All';
}

function getTheme(isDark) {
  if (isDark) {
    return {
      bg: '#0A0A0F',
      cardBg: '#141419',
      text: '#FFFFFF',
      muted: 'rgba(255,255,255,0.65)',
      chipBg: 'rgba(255,255,255,0.06)',
      chipBorder: 'rgba(255,255,255,0.12)',
      overlay: 'rgba(0,0,0,0.94)',
      overlayBar: 'rgba(10,10,15,0.88)',
      navBtnBg: 'rgba(255,255,255,0.12)',
      shadow: 'rgba(193,38,90,0.3)',
      menuBg: '#1A1A22',
    };
  }
  return {
    bg: '#FFFFFF',
    cardBg: '#F5F5F5',
    text: '#0A0A0F',
    muted: 'rgba(10,10,15,0.65)',
    chipBg: 'rgba(0,0,0,0.04)',
    chipBorder: 'rgba(10,10,15,0.1)',
    overlay: 'rgba(10,10,15,0.92)',
    overlayBar: 'rgba(245,245,247,0.95)',
    navBtnBg: 'rgba(0,0,0,0.08)',
    shadow: 'rgba(0,0,0,0.12)',
    menuBg: '#FFFFFF',
  };
}

/** Pinch + double-tap zoom. Notifies JS when zoomed so horizontal FlatList can lock scroll. */
function ZoomablePhoto({ uri, width, height, onZoomChange }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const startScale = useSharedValue(1);

  const notify = (isZoomed) => {
    onZoomChange?.(isZoomed);
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = savedScale.value;
    })
    .onUpdate((e) => {
      scale.value = clamp(startScale.value * e.scale, 1, 3);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        runOnJS(notify)(false);
      } else {
        runOnJS(notify)(true);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      if (savedScale.value > 1.25) {
        scale.value = withTiming(1, { duration: 200 });
        savedScale.value = 1;
        runOnJS(notify)(false);
      } else {
        scale.value = withTiming(2, { duration: 200 });
        savedScale.value = 2;
        runOnJS(notify)(true);
      }
    });

  const composed = Gesture.Simultaneous(pinch, doubleTap);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composed}>
      <AnimatedRe.View style={[{ width, height, justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
        <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
      </AnimatedRe.View>
    </GestureDetector>
  );
}

function DropdownChip({ label, valueLabel, isDark, theme, focused, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ flex: 1, minWidth: 0 }}
    >
      <LinearGradient
        colors={focused ? GRADIENT_PRIMARY : isDark ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)'] : ['rgba(193,38,90,0.35)', 'rgba(216,67,21,0.2)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 12, padding: focused ? 1.5 : 1 }}
      >
        <View
          style={{
            borderRadius: 11,
            backgroundColor: theme.chipBg,
            paddingVertical: 10,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }} numberOfLines={1}>
            {label}: {valueLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.muted} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function PhotoGridCard({ item, cellSize, theme, isDark, onOpen, onMenu }) {
  const scale = useRef(new Animated.Value(1)).current;
  const dateObj = parsePhotoDate(item);
  const dateLine = formatPhotoDateLine(dateObj);

  const pressIn = () => {
    Animated.timing(scale, { toValue: 1.02, duration: 100, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  };

  return (
    <View style={{ width: cellSize, marginBottom: 10 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable onPress={() => onOpen(item)} onPressIn={pressIn} onPressOut={pressOut}>
        <LinearGradient
          colors={GRADIENT_CARD_BORDER}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 12,
            padding: 2,
            shadowColor: isDark ? '#C1265A' : '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.3 : 0.12,
            shadowRadius: isDark ? 24 : 12,
            elevation: isDark ? 10 : 4,
          }}
        >
          <View style={{ borderRadius: 10, overflow: 'hidden', backgroundColor: theme.cardBg }}>
            <View style={{ width: cellSize - 4, height: cellSize - 4 }}>
              <Image source={{ uri: item.url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: 'rgba(0,0,0,0)' },
                ]}
              />
            </View>
          </View>
        </LinearGradient>
        </Pressable>
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 }}>
        <Text style={{ fontSize: 12, color: theme.muted, flex: 1 }} numberOfLines={1}>
          {dateLine}
        </Text>
        <TouchableOpacity onPress={() => onMenu(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-down" size={18} color={theme.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Progress photo grid for one client. Listeners stay on users/{id}/progressPhotos.
 * @param {object} props
 */
export default function MyProgressPhotosScreen({
  route,
  navigation,
  onRegisterAddHandler,
  useShellHeader = false,
  onBack,
  reserveShellBottomNav = false,
}) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { isDark: appIsDark } = useTheme();
  const clientId = route?.params?.clientId;
  const clientName = route?.params?.clientName || 'Client';
  /** Trainers only view; clients upload from the gallery. */
  const allowUpload = route?.params?.allowUpload !== false;
  const reserveNav =
    reserveShellBottomNav === true || route?.params?.reserveShellBottomNav === true;

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalIndex, setModalIndex] = useState(null);
  const [sortId, setSortId] = useState('date_desc');
  const [filterId, setFilterId] = useState('all');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [fullscreenZoomed, setFullscreenZoomed] = useState(false);
  const [galleryReloadKey, setGalleryReloadKey] = useState(0);
  const listRef = useRef(null);

  const theme = useMemo(() => getTheme(appIsDark), [appIsDark]);
  const isDark = appIsDark;

  const cols = winW >= TABLET_MIN_WIDTH ? 3 : 2;
  const gridPad = 16;
  const gridGap = 8;
  const cellSize = (winW - gridPad * 2 - gridGap * (cols - 1)) / cols;

  useEffect(() => {
    if (!clientId || !db) return;
    setLoading(true);
    setError(null);
    const colRef = collection(db, USERS_COLLECTION, clientId, PROGRESS_PHOTOS_COLLECTION);
    // vocab: onSnapshot = live Firestore listener. Cleanup must stay return () => unsub().
    const photosQuery = query(colRef, orderBy('date', 'desc'));
    const unsub = onSnapshot(
      photosQuery,
      (snap) => {
        setPhotos(photosFromSnapshot(snap));
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError?.message || 'Failed to load photos');
        setPhotos([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [clientId, galleryReloadKey]);

  const processed = useMemo(() => decoratePhotoList(photos), [photos]);

  const filteredSorted = useMemo(() => {
    const matched = photosMatchingFilter(processed, filterId);
    return sortProgressPhotos(matched, sortId);
  }, [processed, filterId, sortId]);

  const sortLabel = findSortLabel(sortId);
  const filterLabel = findFilterLabel(filterId);

  const handleAddPhoto = useCallback(async () => {
    // 1. Trainers in view-only mode cannot upload.
    if (!allowUpload) {
      Alert.alert('View only', 'Your trainer can add photos here when upload is enabled for this view.');
      return;
    }

    // 2. Need a client id to know which profile folder to write.
    if (!clientId) {
      Alert.alert('Something went wrong', 'We could not tell which profile to save this photo to. Go back and open Progress Photos again.');
      return;
    }

    // 3. Need Firestore and Storage. Offline / misconfigured installs stop here.
    if (!db || !storage) {
      Alert.alert('Upload unavailable', 'Photo backup is not available right now. Check your internet connection and that the app is configured with Firebase Storage, then try again.');
      return;
    }

    // 4. Ask for the photo library. Denied → stop.
    // vocab: ImagePicker = Expo photo library. status !== 'granted' means they tapped Don't Allow.
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to add progress pictures.');
      return;
    }

    // 5. Pick a square image. Cancel or no uri → stop.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    const localUri = pickedImageUri(result);
    if (!localUri) return;

    // 6. Upload to Storage and write the Firestore row. The live listener adds the card.
    try {
      await uploadProgressPhoto({
        clientId,
        localUri,
        uploadedByUid: auth?.currentUser?.uid,
      });
    } catch (uploadError) {
      Alert.alert('Upload failed', uploadError?.message || 'Could not add photo.');
    }
  }, [allowUpload, clientId, db, storage]);

  useEffect(() => {
    if (typeof onRegisterAddHandler !== 'function') return undefined;
    if (!allowUpload) {
      onRegisterAddHandler(null);
      return () => onRegisterAddHandler(null);
    }
    const run = () => {
      void handleAddPhoto();
    };
    onRegisterAddHandler(run);
    return () => onRegisterAddHandler(null);
  }, [allowUpload, onRegisterAddHandler, handleAddPhoto]);

  const openAtIndex = (photoIndex) => {
    // 1. Reset pinch-zoom, then show that photo full screen.
    setFullscreenZoomed(false);
    setModalIndex(photoIndex);
  };

  useEffect(() => {
    if (modalIndex == null || filteredSorted.length === 0) return;
    const scrollTimer = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({
          index: Math.min(modalIndex, filteredSorted.length - 1),
          animated: false,
        });
      } catch (_) {
        listRef.current?.scrollToOffset({ offset: winW * modalIndex, animated: false });
      }
    }, 48);
    return () => clearTimeout(scrollTimer);
  }, [modalIndex, filteredSorted.length, winW]);

  const openPhoto = (item) => {
    // 1. Find this card in the filtered list, then open that index.
    const photoIndex = filteredSorted.findIndex((photo) => photo.id === item.id);
    if (photoIndex >= 0) openAtIndex(photoIndex);
  };

  const closeModal = () => {
    // 1. Close fullscreen and unlock horizontal swipe.
    setModalIndex(null);
    setFullscreenZoomed(false);
  };

  const handleDeletePhoto = async (photo) => {
    // 1. No photo → nothing to delete.
    if (!photo) return;

    // 2. Confirm, then remove Storage + the Firestore row. The live listener drops the card.
    Alert.alert('Delete photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProgressPhoto({ photo, clientId });
            closeModal();
          } catch (deleteError) {
            Alert.alert('Error', deleteError?.message || 'Could not delete photo.');
          }
        },
      },
    ]);
  };

  const handleShare = async (photoUrl) => {
    // 1. No url → nothing to share. Share sheet cancel is ignored.
    if (!photoUrl) return;
    try {
      await Share.share({ message: 'Progress photo from CoachConnect', url: photoUrl });
    } catch (_) {}
  };

  const showPhotoActions = (photo) => {
    // 1. Share / Delete / Cancel. iOS uses the action sheet; Android uses Alert.
    const buttons = ['Share', 'Delete', 'Cancel'];
    const handlers = [
      () => handleShare(photo?.url),
      () => handleDeletePhoto(photo),
      () => {},
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: buttons, cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (buttonIndex) => handlers[buttonIndex]?.()
      );
    } else {
      Alert.alert('Photo', undefined, [
        { text: 'Share', onPress: handlers[0] },
        { text: 'Delete', style: 'destructive', onPress: handlers[1] },
        { text: 'Cancel', style: 'cancel', onPress: handlers[2] },
      ]);
    }
  };

  const renderGridItem = ({ item }) => (
    <View style={{ width: cellSize }}>
      <PhotoGridCard
        item={item}
        cellSize={cellSize}
        theme={theme}
        isDark={isDark}
        onOpen={openPhoto}
        onMenu={showPhotoActions}
      />
    </View>
  );

  const flatIndexValid = modalIndex != null && modalIndex >= 0 && modalIndex < filteredSorted.length;
  const current = flatIndexValid ? filteredSorted[modalIndex] : null;
  const currentDate = current ? parsePhotoDate(current) : null;
  const currentDateLabel =
    currentDate &&
    `${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${currentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

  const metricsLine = current?.metricsLine || current?.measurementNote || null;
  const noteLine = current?.note || current?.caption || null;

  const fullscreenHeight = winH - insets.top - insets.bottom;

  const headerIconColor = isDark ? '#FFFFFF' : theme.text;
  const handleBack = () => {
    // 1. Shell header uses onBack. Standalone screen uses navigation.goBack.
    if (typeof onBack === 'function') onBack();
    else navigation?.goBack?.();
  };
  const gridBottomPad = insets.bottom + GRID_BOTTOM_EXTRA + (reserveNav ? BOTTOM_NAV_BAR_HEIGHT : 0);

  // 1. Header, sort/filter, then grid / empty / error. Fullscreen modal sits on top.
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={SHELL_SAFE_AREA_EDGES}>
      {useShellHeader ? (
        <TopHeader
          title="Progress Photos"
          skipTopSafeInset
          onBack={handleBack}
        />
      ) : (
        <View style={{ paddingTop: 8 }}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={handleBack}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              style={styles.hit44}
            >
              <Ionicons name="chevron-back" size={24} color={headerIconColor} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: headerIconColor }]}>Progress Photos</Text>
            <View style={styles.hit44} />
          </View>
          <LinearGradient colors={GRADIENT_PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 3, marginHorizontal: gridPad, borderRadius: 2 }} />
          <Text style={[styles.clientSub, { color: theme.muted }]} numberOfLines={1}>
            {clientName}
          </Text>
        </View>
      )}

      <View style={{ paddingTop: useShellHeader ? 8 : 0 }}>
        <View style={[styles.controlsRow, { paddingHorizontal: gridPad, gap: 10 }]}>
          <DropdownChip
            label="Sort"
            valueLabel={sortLabel}
            isDark={isDark}
            theme={theme}
            focused={showSortMenu}
            onPress={() => {
              setShowFilterMenu(false);
              setShowSortMenu((isSortOpen) => !isSortOpen);
            }}
          />
          <DropdownChip
            label="Filter"
            valueLabel={filterLabel}
            isDark={isDark}
            theme={theme}
            focused={showFilterMenu}
            onPress={() => {
              setShowSortMenu(false);
              setShowFilterMenu((isFilterOpen) => !isFilterOpen);
            }}
          />
        </View>

        {(showSortMenu || showFilterMenu) && (
          <View style={[styles.menuPanel, { marginHorizontal: gridPad, backgroundColor: theme.menuBg, borderColor: theme.chipBorder }]}>
            {showSortMenu &&
              SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.menuRow}
                  onPress={() => {
                    setSortId(option.id);
                    setShowSortMenu(false);
                  }}
                >
                  <Text style={[styles.menuText, { color: theme.text }]}>{option.label}</Text>
                  {sortId === option.id ? <Ionicons name="checkmark" size={18} color="#C1265A" /> : null}
                </TouchableOpacity>
              ))}
            {showFilterMenu &&
              FILTER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.menuRow}
                  onPress={() => {
                    setFilterId(option.id);
                    setShowFilterMenu(false);
                  }}
                >
                  <Text style={[styles.menuText, { color: theme.text }]}>{option.label}</Text>
                  {filterId === option.id ? <Ionicons name="checkmark" size={18} color="#C1265A" /> : null}
                </TouchableOpacity>
              ))}
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color="#C1265A" />
        </View>
      )}

      {error && !loading && (
        <View style={styles.centerFill}>
          <Text style={{ color: '#F97373', textAlign: 'center', marginBottom: 12 }}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setError(null);
              setGalleryReloadKey((reloadKey) => reloadKey + 1);
            }}
            style={styles.retryBtn}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && filteredSorted.length === 0 && (
        <View style={styles.centerFill}>
          <Ionicons name="camera-outline" size={52} color={theme.muted} style={{ opacity: 0.85 }} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No progress photos yet</Text>
          <Text style={[styles.emptySub, { color: theme.muted }]}>
            {allowUpload
              ? 'Your first photo will show here'
              : `When ${clientName} adds progress photos, they will appear here.`}
          </Text>
          {allowUpload ? (
            <Pressable
              onPress={handleAddPhoto}
              accessibilityRole="button"
              accessibilityLabel="Add progress photo from library"
              style={({ pressed }) => [styles.emptyCtaWrap, pressed && styles.emptyCtaPressed]}
            >
              <LinearGradient colors={GRADIENT_PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyCtaGrad}>
                <Text style={styles.emptyCtaText}>Add photo from library</Text>
              </LinearGradient>
            </Pressable>
          ) : null}
        </View>
      )}

      {!loading && !error && filteredSorted.length > 0 && (
        <FlatList
          key={cols}
          data={filteredSorted}
          keyExtractor={(item) => item.id || item.url}
          numColumns={cols}
          contentContainerStyle={{ paddingHorizontal: gridPad, paddingBottom: gridBottomPad, paddingTop: 8 }}
          renderItem={renderGridItem}
          columnWrapperStyle={cols > 1 ? { gap: gridGap, marginBottom: 10 } : undefined}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={7}
        />
      )}

      {!loading && !error && allowUpload ? (
        <View
          style={[
            styles.fabRow,
            {
              bottom:
                (reserveNav ? BOTTOM_NAV_BAR_HEIGHT : 0) + Math.max(insets.bottom, 8) + 20,
            },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={handleAddPhoto}
            accessibilityRole="button"
            accessibilityLabel="Add progress photo from library"
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            style={({ pressed }) => [styles.fabTouch, pressed && styles.fabTouchPressed]}
          >
            <LinearGradient colors={GRADIENT_PRIMARY} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fab}>
              <Ionicons name="add" size={32} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={modalIndex != null} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={[styles.modalRoot, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalTop, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={closeModal} hitSlop={12} style={styles.hit44}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalDateCenter} numberOfLines={1}>
              {currentDateLabel || ''}
            </Text>
            <TouchableOpacity
              onPress={() => current && showPhotoActions(current)}
              hitSlop={12}
              style={styles.hit44}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={listRef}
            data={filteredSorted}
            keyExtractor={(item) => item.id || item.url}
            horizontal
            pagingEnabled
            scrollEnabled={!fullscreenZoomed}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({
              length: winW,
              offset: winW * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              const offset = index * winW;
              listRef.current?.scrollToOffset({ offset, animated: false });
            }}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const idx = Math.round(x / winW);
              if (idx >= 0 && idx < filteredSorted.length) setModalIndex(idx);
            }}
            renderItem={({ item }) => (
              <View style={{ width: winW, height: fullscreenHeight - 160, justifyContent: 'center' }}>
                {item.url ? (
                  <ZoomablePhoto
                    uri={item.url}
                    width={winW}
                    height={fullscreenHeight - 160}
                    onZoomChange={setFullscreenZoomed}
                  />
                ) : null}
              </View>
            )}
          />

          <View style={[styles.modalBottom, { paddingBottom: insets.bottom + 12, backgroundColor: theme.overlayBar }]}>
            <Text style={styles.bottomDate}>{currentDateLabel}</Text>
            {metricsLine ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{metricsLine}</Text>
              </View>
            ) : null}
            {noteLine ? <Text style={[styles.noteText, { color: theme.muted }]}>{noteLine}</Text> : null}
            <Text style={styles.swipeHint}>Swipe for next photo</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
  hit44: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  clientSub: { fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 10, paddingHorizontal: 24 },
  controlsRow: { flexDirection: 'row', marginBottom: 8 },
  menuPanel: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  menuText: { fontSize: 15, fontWeight: '600' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptySub: { marginTop: 8, fontSize: 14, textAlign: 'center' },
  emptyCtaWrap: { marginTop: 22, alignSelf: 'center', width: '80%', maxWidth: 400, minHeight: 52, justifyContent: 'center' },
  emptyCtaPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  emptyCtaGrad: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  emptyCtaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, backgroundColor: '#C1265A' },
  fabRow: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    zIndex: 50,
    elevation: 24,
  },
  /** Outer wrap enlarges the tap target without crowding the grid. */
  fabTouch: {
    padding: 8,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabTouchPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C1265A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  modalRoot: { flex: 1 },
  modalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  modalDateCenter: { flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  modalBottom: { paddingHorizontal: 16, paddingTop: 12 },
  bottomDate: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(193,38,90,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  noteText: { fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  swipeHint: { fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 4 },
});
