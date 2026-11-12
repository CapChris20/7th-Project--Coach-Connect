// Progress photo gallery — grid + Design Law fullscreen viewer (progress PNG 07/08).
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
  ScrollView,
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
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, gradients, nb } from '../../look-and-feel/colorPalette';
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
import TopHeader from '../loading-and-header/TopHeader';
import { BOTTOM_NAV_BAR_HEIGHT, SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

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

/** Short header date (Design Law progress 07/08). */
function formatPhotoShortDate(dateObj) {
  return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function bodyPartDisplayName(photo) {
  const id = photoBodyPart(photo);
  const match = findFilterLabel(id);
  if (match && match !== 'All') return match;
  if (id && id !== 'other') {
    return id.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return 'Photo';
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

/** Map app nb tokens to the local theme object this screen already expects. */
function galleryThemeFromColors(colors, isDark) {
  return {
    bg: colors.nbBackground,
    cardBg: colors.nbSurface,
    text: colors.nbInk,
    muted: colors.nbMuted,
    chipBg: colors.nbSurfaceChip,
    chipBorder: colors.nbBorder,
    overlay: 'rgba(0,0,0,0.94)',
    overlayBar: isDark ? 'rgba(11,11,11,0.92)' : 'rgba(242,242,240,0.95)',
    navBtnBg: colors.nbSoft,
    menuBg: colors.nbSurface,
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

function DropdownChip({ label, valueLabel, colors, focused, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ flex: 1, minWidth: 0 }}
    >
      <View
        style={{
          borderRadius: borderRadius.nbChip,
          borderWidth: nb.borderWidth,
          borderColor: colors.nbBorder,
          backgroundColor: focused ? colors.nbFill : colors.nbSurfaceChip,
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: nb.minTouchTarget,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: focused ? colors.nbOnFill : colors.nbInk,
          }}
          numberOfLines={1}
        >
          {label}: {valueLabel}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={focused ? colors.nbOnFill : colors.nbMuted}
        />
      </View>
    </TouchableOpacity>
  );
}

function PhotoGridCard({ item, cellSize, theme, colors, onOpen, onMenu }) {
  const scale = useRef(new Animated.Value(1)).current;
  const dateObj = parsePhotoDate(item);
  const dateLine = formatPhotoDateLine(dateObj);
  const thumbSide = cellSize - nb.borderWidth * 2;

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
          <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
            <NbCard noShadow style={{ padding: 0, overflow: 'hidden', width: cellSize }}>
              <Image
                source={{ uri: item.url }}
                style={{ width: thumbSide, height: thumbSide, backgroundColor: theme.cardBg }}
                resizeMode="cover"
              />
            </NbCard>
          </HardShadow>
        </Pressable>
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 }}>
        <Text style={{ fontSize: 12, color: theme.muted, flex: 1 }} numberOfLines={1}>
          {dateLine}
        </Text>
        <TouchableOpacity onPress={() => onMenu(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-down" size={18} color={colors.nbMuted} />
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
  const { colors, isDark: appIsDark } = useTheme();
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

  const isDark = appIsDark;
  const theme = useMemo(() => galleryThemeFromColors(colors, isDark), [colors, isDark]);

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
        colors={colors}
        onOpen={openPhoto}
        onMenu={showPhotoActions}
      />
    </View>
  );

  const flatIndexValid = modalIndex != null && modalIndex >= 0 && modalIndex < filteredSorted.length;
  const current = flatIndexValid ? filteredSorted[modalIndex] : null;
  const currentDate = current ? parsePhotoDate(current) : null;
  const modalTitleShort = currentDate ? formatPhotoShortDate(currentDate) : '';
  const modalPosition =
    flatIndexValid && filteredSorted.length ? `${modalIndex + 1} of ${filteredSorted.length}` : '';
  const modalBodyPart = current ? bodyPartDisplayName(current) : '';
  const modalSubtitle =
    modalBodyPart && modalPosition ? `${modalBodyPart} · ${modalPosition}` : modalPosition || modalBodyPart;
  const photoOverlayCaption =
    currentDate && modalBodyPart ? `${modalBodyPart}, ${formatPhotoShortDate(currentDate)}` : modalTitleShort;
  const indexPill = flatIndexValid && filteredSorted.length ? `${modalIndex + 1} / ${filteredSorted.length}` : '';
  const noteLine = current?.note || current?.caption || null;

  const fullscreenHeight = winH - insets.top - insets.bottom;

  const goAdjacentPhoto = (direction) => {
    if (modalIndex == null) return;
    const next = modalIndex + direction;
    if (next >= 0 && next < filteredSorted.length) {
      setFullscreenZoomed(false);
      setModalIndex(next);
    }
  };

  const headerIconColor = colors.nbInk;
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
          <View
            style={{
              height: nb.borderWidth,
              marginHorizontal: gridPad,
              backgroundColor: colors.nbBorder,
            }}
          />
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
            colors={colors}
            focused={showSortMenu}
            onPress={() => {
              setShowFilterMenu(false);
              setShowSortMenu((isSortOpen) => !isSortOpen);
            }}
          />
          <DropdownChip
            label="Filter"
            valueLabel={filterLabel}
            colors={colors}
            focused={showFilterMenu}
            onPress={() => {
              setShowSortMenu(false);
              setShowFilterMenu((isFilterOpen) => !isFilterOpen);
            }}
          />
        </View>

        {(showSortMenu || showFilterMenu) && (
          <View style={[styles.menuPanel, { marginHorizontal: gridPad, backgroundColor: theme.menuBg, borderColor: colors.nbBorder }]}>
            {showSortMenu &&
              SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.menuRow, { borderBottomColor: colors.nbBorder }]}
                  onPress={() => {
                    setSortId(option.id);
                    setShowSortMenu(false);
                  }}
                >
                  <Text style={[styles.menuText, { color: theme.text }]}>{option.label}</Text>
                  {sortId === option.id ? <Ionicons name="checkmark" size={18} color={colors.nbFill} /> : null}
                </TouchableOpacity>
              ))}
            {showFilterMenu &&
              FILTER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.menuRow, { borderBottomColor: colors.nbBorder }]}
                  onPress={() => {
                    setFilterId(option.id);
                    setShowFilterMenu(false);
                  }}
                >
                  <Text style={[styles.menuText, { color: theme.text }]}>{option.label}</Text>
                  {filterId === option.id ? <Ionicons name="checkmark" size={18} color={colors.nbFill} /> : null}
                </TouchableOpacity>
              ))}
          </View>
        )}
      </View>

      {loading && (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.nbFill} />
        </View>
      )}

      {error && !loading && (
        <View style={styles.centerFill}>
          <Text style={{ color: '#F97373', textAlign: 'center', marginBottom: 12 }}>{error}</Text>
          <NbButton
            variant="fill"
            sm
            onPress={() => {
              setError(null);
              setGalleryReloadKey((reloadKey) => reloadKey + 1);
            }}
          >
            Retry
          </NbButton>
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
            <View style={styles.emptyCtaWrap}>
              <NbButton variant="fill" onPress={handleAddPhoto}>
                Add photo from library
              </NbButton>
            </View>
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
            <HardShadow radius={31} offset={nb.shadowOffsetSmall}>
              <LinearGradient
                colors={gradients.brand.colors}
                start={gradients.brand.start}
                end={gradients.brand.end}
                style={[
                  styles.fab,
                  {
                    borderWidth: nb.borderWidth,
                    borderColor: colors.nbBorder,
                  },
                ]}
              >
                <Ionicons name="add" size={32} color={colors.nbInk} />
              </LinearGradient>
            </HardShadow>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={modalIndex != null} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={[styles.modalRoot, { backgroundColor: colors.nbBackground }]}>
          <View style={[styles.modalTop, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={closeModal} hitSlop={12} accessibilityLabel="Close photo viewer">
              <HardShadow radius={borderRadius.nbChip} offset={nb.shadowOffsetSmall}>
                <View
                  style={[
                    styles.modalSqBtn,
                    { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                  ]}
                >
                  <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
                </View>
              </HardShadow>
            </TouchableOpacity>
            <View style={styles.modalTitleStack}>
              <Text style={[styles.modalTitle, { color: colors.nbInk }]} numberOfLines={1}>
                {modalTitleShort}
              </Text>
              {modalSubtitle ? (
                <Text style={[styles.modalSubtitle, { color: colors.nbMuted }]} numberOfLines={1}>
                  {modalSubtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => goAdjacentPhoto(1)}
              hitSlop={12}
              disabled={!flatIndexValid || modalIndex >= filteredSorted.length - 1}
              accessibilityLabel="Next photo"
              style={{ opacity: modalIndex >= filteredSorted.length - 1 ? 0.4 : 1 }}
            >
              <HardShadow radius={borderRadius.nbChip} offset={nb.shadowOffsetSmall}>
                <View
                  style={[
                    styles.modalSqBtn,
                    { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                  ]}
                >
                  <Ionicons name="chevron-forward" size={22} color={colors.nbInk} />
                </View>
              </HardShadow>
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
            renderItem={({ item, index }) => {
              const framePad = 16;
              const frameW = winW - framePad * 2;
              const frameH = Math.min(fullscreenHeight - 260, frameW * 1.25);
              return (
                <View
                  style={{
                    width: winW,
                    paddingHorizontal: framePad,
                    justifyContent: 'center',
                    minHeight: frameH + 24,
                  }}
                >
                  <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
                    <View
                      style={[
                        styles.modalPhotoFrame,
                        {
                          width: frameW,
                          height: frameH,
                          borderColor: colors.nbBorder,
                          backgroundColor: colors.nbSurface,
                        },
                      ]}
                    >
                      {item.url ? (
                        <ZoomablePhoto
                          uri={item.url}
                          width={frameW}
                          height={frameH}
                          onZoomChange={setFullscreenZoomed}
                        />
                      ) : null}
                      {index === modalIndex && indexPill ? (
                        <View
                          style={[
                            styles.modalIndexPill,
                            { borderColor: colors.nbBorder, backgroundColor: colors.nbFill },
                          ]}
                        >
                          <Text style={[styles.modalIndexPillText, { color: colors.nbOnFill }]}>{indexPill}</Text>
                        </View>
                      ) : null}
                      {index === modalIndex && photoOverlayCaption ? (
                        <Text style={[styles.modalPhotoCaption, { color: colors.nbInk }]} numberOfLines={1}>
                          {photoOverlayCaption}
                        </Text>
                      ) : null}
                    </View>
                  </HardShadow>
                </View>
              );
            }}
          />

          <View style={[styles.modalBottom, { paddingBottom: insets.bottom + 12 }]}>
            {/* Design Law photo viewer: thumbnail strip under the main frame */}
            {filteredSorted.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalThumbStrip}
              >
                {filteredSorted.map((thumb, thumbIndex) => {
                  const selected = thumbIndex === modalIndex;
                  return (
                    <TouchableOpacity
                      key={thumb.id || thumb.url || `thumb-${thumbIndex}`}
                      onPress={() => {
                        setModalIndex(thumbIndex);
                        listRef.current?.scrollToIndex?.({ index: thumbIndex, animated: true });
                      }}
                      activeOpacity={0.88}
                    >
                      <View
                        style={[
                          styles.modalThumb,
                          {
                            borderColor: colors.nbBorder,
                            backgroundColor: colors.nbSoft,
                            borderWidth: selected ? nb.borderWidth : 2,
                            opacity: selected ? 1 : 0.72,
                          },
                        ]}
                      >
                        {thumb.url ? (
                          <Image
                            source={{ uri: thumb.url }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="cover"
                          />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
            <Text style={[styles.swipeHint, { color: colors.nbMuted }]}>Swipe for next photo</Text>
            {noteLine ? (
              <Text style={[styles.noteText, { color: colors.nbMuted }]} numberOfLines={2}>
                {noteLine}
              </Text>
            ) : null}
            <View style={styles.modalActionRow}>
              <View style={{ flex: 1 }}>
                <NbButton variant="ghost" onPress={() => current?.url && handleShare(current.url)}>
                  Share
                </NbButton>
              </View>
              {allowUpload ? (
                <View style={{ flex: 1 }}>
                  <NbButton variant="fill" onPress={() => current && handleDeletePhoto(current)}>
                    Delete
                  </NbButton>
                </View>
              ) : null}
            </View>
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
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    marginBottom: 8,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
  },
  menuText: { fontSize: 15, fontWeight: '600' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptySub: { marginTop: 8, fontSize: 14, textAlign: 'center' },
  emptyCtaWrap: { marginTop: 22, alignSelf: 'center', width: '80%', maxWidth: 400 },
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
  },
  modalRoot: { flex: 1 },
  modalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  modalSqBtn: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleStack: { flex: 1, minWidth: 0, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  modalPhotoFrame: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
    position: 'relative',
  },
  modalIndexPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
  },
  modalIndexPillText: { fontSize: 12, fontWeight: '800' },
  modalPhotoCaption: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    fontSize: 13,
    fontWeight: '800',
    maxWidth: '78%',
  },
  modalBottom: { paddingHorizontal: 16, paddingTop: 8 },
  // Manipulate here: thumbnail strip under fullscreen photo (Design Law viewer)
  modalThumbStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingRight: 8,
  },
  modalThumb: {
    width: 56,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  noteText: { fontSize: 13, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },
  swipeHint: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
