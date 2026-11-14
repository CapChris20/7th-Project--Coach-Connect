// Progress photo gallery — grid + Design Law fullscreen viewer + compare slider (progress PNG 05–10).
// Flow: listen to users/{clientId}/progressPhotos → filter/sort → tap to open → Compare → before/after drag.
// Used by the client gallery tab and the trainer viewing a client's photos.

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { ActionSheetIOS, ActivityIndicator, Animated, FlatList, Image, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import NbSheet from '../../look-and-feel/NbSheet';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, gradients, nb } from '../../look-and-feel/colorPalette';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AnimatedRe, { useSharedValue, useAnimatedStyle, withTiming, withSpring, clamp, runOnJS } from 'react-native-reanimated';
import { db, storage, auth } from '../../app-start/cloudConnection';
import { collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import TopHeader from '../loading-and-header/TopHeader';
import { BOTTOM_NAV_BAR_HEIGHT, SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

const TABLET_MIN_WIDTH = 768;
const GRID_BOTTOM_EXTRA = 24;
const USERS_COLLECTION = 'users';
const PROGRESS_PHOTOS_COLLECTION = 'progressPhotos';
const BODY_PART_OTHER = 'other';
const BODY_PART_FULL_BODY = 'full_body';
const FILTER_ALL = 'all';
const SORT_DATE_NEWEST = 'date_desc';
const SORT_DATE_OLDEST = 'date_asc';
const SORT_BY_NAME = 'name';
const COMPARE_ANGLE_FRONT = 'front';
const COMPARE_ANGLE_SIDE = 'side';
const COMPARE_ANGLE_BACK = 'back';

// Manipulate here: body-part chips and sort rows on the gallery.
const FILTER_OPTIONS = [{
  id: FILTER_ALL,
  label: 'All'
}, {
  id: 'chest',
  label: 'Chest'
}, {
  id: 'legs',
  label: 'Legs'
}, {
  id: 'arms',
  label: 'Arms'
}, {
  id: BODY_PART_FULL_BODY,
  label: 'Full Body'
}, {
  id: 'back',
  label: 'Back'
}];
const SORT_OPTIONS = [{
  id: SORT_DATE_NEWEST,
  label: 'By Date (Newest)'
}, {
  id: SORT_DATE_OLDEST,
  label: 'By Date (Oldest)'
}, {
  id: SORT_BY_NAME,
  label: 'By Name'
}];

// Manipulate here: compare angle chips match progress PNG 09 (Front / Side / Back)
const COMPARE_ANGLES = [{
  id: COMPARE_ANGLE_FRONT,
  label: 'Front'
}, {
  id: COMPARE_ANGLE_SIDE,
  label: 'Side'
}, {
  id: COMPARE_ANGLE_BACK,
  label: 'Back'
}];
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const MS_PER_WEEK = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_WEEK;
const DOUBLE_TAP_MAX_MS = 280;
const ZOOM_ANIMATION_MS = 200;
const ZOOM_RESET_THRESHOLD = 1.05;
const ZOOM_DOUBLE_TAP_COLLAPSE_THRESHOLD = 1.25;
const ZOOM_DOUBLE_TAP_EXPAND_SCALE = 2;
const PINCH_MAX_SCALE = 3;
const COMPARE_SLIDER_EDGE_PAD = 24;
const COMPARE_HANDLE_HALF_WIDTH = 22;
const COMPARE_FRAME_MAX = 360;
const COMPARE_FRAME_H_MARGIN = 40;
const SCROLL_TO_PHOTO_DELAY_MS = 48;
const GRID_PRESS_IN_MS = 100;
const GRID_PRESS_OUT_MS = 120;
const GRID_PRESS_SCALE_UP = 1.02;
const FULLSCREEN_BOTTOM_RESERVE = 260;
const FULLSCREEN_FRAME_ASPECT = 1.25;
const FULLSCREEN_FRAME_PAD = 16;
const IMAGE_PICKER_QUALITY = 0.85;
const ERROR_TEXT_COLOR = '#F97373';
const GRID_PAD = 16;
const GRID_GAP = 8;
const PHONE_COLUMN_COUNT = 2;
const TABLET_COLUMN_COUNT = 3;

// ===== HELPER FUNCTIONS =====

/**
 * Pull gallery route options into plain locals (no nested ?. in the screen body).
 * @param {object|undefined} route
 * @param {boolean} reserveShellBottomNav
 */
function readGalleryRouteOptions(route, reserveShellBottomNav) {
  const routeParams = route && route.params ? route.params : {};
  const clientId = routeParams.clientId;
  const clientName = routeParams.clientName || 'Client';
  // Missing allowUpload means clients may upload; only an explicit false locks the gallery.
  const allowUpload = routeParams.allowUpload !== false;
  const reserveFromRoute = routeParams.reserveShellBottomNav === true;
  const reserveNav = reserveShellBottomNav === true || reserveFromRoute;
  return {
    clientId,
    clientName,
    allowUpload,
    reserveNav
  };
}
function parsePhotoDate(photo) {
  // vocab: Firestore Timestamp has toDate(); a plain Date is already usable.
  if (photo.date && typeof photo.date.toDate === 'function') {
    return photo.date.toDate();
  }
  if (photo.date instanceof Date) {
    return photo.date;
  }
  return new Date();
}
function isKnownFilterId(rawBodyPart) {
  for (let i = 0; i < FILTER_OPTIONS.length; i += 1) {
    if (FILTER_OPTIONS[i].id === rawBodyPart) return true;
  }
  return false;
}

/**
 * Normalize body-part tags from older docs (category / tag / bodyPart) into chip ids.
 */
function photoBodyPart(photo) {
  const fromBodyPart = photo.bodyPart || '';
  const fromCategory = photo.category || '';
  const fromTag = photo.tag || '';
  const combined = fromBodyPart || fromCategory || fromTag;
  const rawBodyPartText = combined.toString().toLowerCase().replace(/\s+/g, '_');
  if (!rawBodyPartText) return BODY_PART_OTHER;
  if (isKnownFilterId(rawBodyPartText)) return rawBodyPartText;
  if (rawBodyPartText === 'fullbody' || rawBodyPartText === 'full-body') {
    return BODY_PART_FULL_BODY;
  }
  return rawBodyPartText;
}
function photosFromSnapshot(snapshot) {
  const photoList = [];
  snapshot.forEach(photoDoc => {
    photoList.push({
      id: photoDoc.id,
      ...photoDoc.data()
    });
  });
  return photoList;
}

/**
 * Add parsedDate / bodyPartKey / sortName so filter + sort stay cheap and readable.
 */
function decoratePhoto(photo) {
  const storagePathText = photo.storagePath || '';
  const urlText = photo.url || '';
  const idText = photo.id || '';
  const sortName = (storagePathText || urlText || idText).toString();
  return {
    ...photo,
    parsedDate: parsePhotoDate(photo),
    bodyPartKey: photoBodyPart(photo),
    sortName
  };
}
function decoratePhotoList(photoList) {
  const decorated = [];
  for (let i = 0; i < photoList.length; i += 1) {
    decorated.push(decoratePhoto(photoList[i]));
  }
  return decorated;
}
function photosMatchingFilter(decoratedPhotos, filterId) {
  if (filterId === FILTER_ALL) {
    return decoratedPhotos.slice();
  }
  const matched = [];
  for (let i = 0; i < decoratedPhotos.length; i += 1) {
    const photo = decoratedPhotos[i];
    if (photo.bodyPartKey === filterId) {
      matched.push(photo);
    }
  }
  return matched;
}
function sortProgressPhotos(photoList, sortId) {
  const sorted = photoList.slice();
  if (sortId === SORT_DATE_NEWEST) {
    sorted.sort((leftPhoto, rightPhoto) => rightPhoto.parsedDate - leftPhoto.parsedDate);
    return sorted;
  }
  if (sortId === SORT_DATE_OLDEST) {
    sorted.sort((leftPhoto, rightPhoto) => leftPhoto.parsedDate - rightPhoto.parsedDate);
    return sorted;
  }
  sorted.sort((leftPhoto, rightPhoto) => leftPhoto.sortName.localeCompare(rightPhoto.sortName));
  return sorted;
}
function pickedImageUri(pickerResult) {
  if (pickerResult.canceled) return null;
  const assets = pickerResult.assets;
  if (!assets || !assets[0]) return null;
  const firstAsset = assets[0];
  if (!firstAsset.uri) return null;
  return firstAsset.uri;
}
async function uploadProgressPhoto({
  clientId,
  localUri,
  uploadedByUid
}) {
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
    storagePath: storageRef.fullPath
  });
}
async function deleteProgressPhoto({
  photo,
  clientId
}) {
  if (photo.storagePath && storage) {
    await deleteObject(ref(storage, photo.storagePath));
  }
  if (db && clientId && photo.id) {
    await deleteDoc(doc(db, USERS_COLLECTION, clientId, PROGRESS_PHOTOS_COLLECTION, photo.id));
  }
}
function formatPhotoDateLine(dateObj) {
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/** Short header date (Design Law progress 07/08). */
function formatPhotoShortDate(dateObj) {
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}
function findFilterLabel(filterId) {
  for (let i = 0; i < FILTER_OPTIONS.length; i += 1) {
    if (FILTER_OPTIONS[i].id === filterId) return FILTER_OPTIONS[i].label;
  }
  return 'All';
}
function findSortLabel(sortId) {
  for (let i = 0; i < SORT_OPTIONS.length; i += 1) {
    if (SORT_OPTIONS[i].id === sortId) {
      return SORT_OPTIONS[i].label.replace(/^By /, '');
    }
  }
  return 'Date';
}
function bodyPartDisplayName(photo) {
  const bodyPartId = photoBodyPart(photo);
  const matchLabel = findFilterLabel(bodyPartId);
  if (matchLabel && matchLabel !== 'All') return matchLabel;
  const hasRealBodyPart = bodyPartId && bodyPartId !== BODY_PART_OTHER;
  if (!hasRealBodyPart) return 'Photo';
  return bodyPartId.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
function photoMatchesCompareAngle(photo, angleId) {
  const bodyPartKey = String(photo.bodyPartKey || '').toLowerCase();
  const poseText = String(photo.pose || photo.angle || photo.view || photo.tag || '').toLowerCase();
  if (poseText.includes(angleId) || bodyPartKey.includes(angleId)) return true;

  // Soft fallbacks when clients never tagged Front/Side/Back
  if (angleId === COMPARE_ANGLE_FRONT) {
    const looksLikeFront = bodyPartKey === BODY_PART_FULL_BODY || bodyPartKey === 'chest' || bodyPartKey === FILTER_ALL;
    if (looksLikeFront) return true;
  }
  if (angleId === COMPARE_ANGLE_BACK && bodyPartKey === 'back') return true;
  return false;
}

/**
 * Prefer angle-tagged photos; if fewer than 2, fall back to the full sorted list.
 * Returns [before, after] oldest→newest for the slider.
 */
function pickComparePair(photos, angleId) {
  if (!photos || photos.length === 0) return [null, null];
  const chronological = photos.slice().sort((olderPhoto, newerPhoto) => olderPhoto.parsedDate - newerPhoto.parsedDate);
  const angled = [];
  for (let i = 0; i < chronological.length; i += 1) {
    if (photoMatchesCompareAngle(chronological[i], angleId)) {
      angled.push(chronological[i]);
    }
  }
  const pool = angled.length >= 2 ? angled : chronological;
  if (pool.length < 2) return [null, null];
  return [pool[0], pool[pool.length - 1]];
}
function weeksBetweenPhotos(before, after) {
  if (!before || !before.parsedDate || !after || !after.parsedDate) return null;
  const millisApart = Math.abs(after.parsedDate.getTime() - before.parsedDate.getTime());
  return Math.max(1, Math.round(millisApart / MS_PER_WEEK));
}

/** Map app nb tokens to the local theme object this screen already expects. */
function galleryThemeFromColors(colors, isDark) {
  return {
    backgroundColor: colors.nbBackground,
    cardBackgroundColor: colors.nbSurface,
    textColor: colors.nbInk,
    mutedColor: colors.nbMuted,
    chipBackgroundColor: colors.nbSurfaceChip,
    chipBorderColor: colors.nbBorder,
    overlayColor: 'rgba(0,0,0,0.94)',
    overlayBarColor: isDark ? 'rgba(11,11,11,0.92)' : 'rgba(242,242,240,0.95)',
    navButtonBackgroundColor: colors.nbSoft,
    menuBackgroundColor: colors.nbSurface
  };
}
function buildCompareStatRows(before, after, weeksApart) {
  const weeksLabel = weeksApart != null ? `${weeksApart} wks` : '—';
  return [{
    label: 'Apart',
    value: weeksLabel
  }, {
    label: 'Before',
    value: formatPhotoShortDate(before.parsedDate)
  }, {
    label: 'After',
    value: formatPhotoShortDate(after.parsedDate)
  }];
}

/** Pinch + double-tap zoom. Notifies JS when zoomed so horizontal FlatList can lock scroll. */
function ZoomablePhoto({
  uri,
  width,
  height,
  onZoomChange
}) {
  // vocab: useSharedValue = Reanimated value that UI thread can update without React re-render
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const notifyParentZoomChanged = isZoomed => {
    if (onZoomChange) onZoomChange(isZoomed);
  };
  const pinch = Gesture.Pinch().onBegin(() => {
    startScale.value = savedScale.value;
  }).onUpdate(pinchEvent => {
    scale.value = clamp(startScale.value * pinchEvent.scale, 1, PINCH_MAX_SCALE);
  }).onEnd(() => {
    savedScale.value = scale.value;
    if (scale.value < ZOOM_RESET_THRESHOLD) {
      scale.value = withSpring(1);
      savedScale.value = 1;
      // vocab: runOnJS = hop from UI-thread worklet back to React/JS to set state
      runOnJS(notifyParentZoomChanged)(false);
    } else {
      runOnJS(notifyParentZoomChanged)(true);
    }
  });
  const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(DOUBLE_TAP_MAX_MS).onEnd(() => {
    if (savedScale.value > ZOOM_DOUBLE_TAP_COLLAPSE_THRESHOLD) {
      scale.value = withTiming(1, {
        duration: ZOOM_ANIMATION_MS
      });
      savedScale.value = 1;
      runOnJS(notifyParentZoomChanged)(false);
    } else {
      scale.value = withTiming(ZOOM_DOUBLE_TAP_EXPAND_SCALE, {
        duration: ZOOM_ANIMATION_MS
      });
      savedScale.value = ZOOM_DOUBLE_TAP_EXPAND_SCALE;
      runOnJS(notifyParentZoomChanged)(true);
    }
  });
  const composed = Gesture.Simultaneous(pinch, doubleTap);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: scale.value
    }]
  }));
  return <GestureDetector gesture={composed}>
      <AnimatedRe.View style={[{
      width,
      height,
      justifyContent: 'center',
      alignItems: 'center'
    }, animatedStyle]}>
        <Image source={{
        uri
      }} style={{
        width,
        height
      }} resizeMode="contain" />
      </AnimatedRe.View>
    </GestureDetector>;
}
function DropdownChip({
  label,
  valueLabel,
  colors,
  focused,
  onPress
}) {
  const chipBackgroundColor = focused ? colors.nbFill : colors.nbSurfaceChip;
  const labelColor = focused ? colors.nbOnFill : colors.nbInk;
  const chevronColor = focused ? colors.nbOnFill : colors.nbMuted;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{
    flex: 1,
    minWidth: 0
  }}>
      <View style={{
      borderRadius: borderRadius.nbChip,
      borderWidth: nb.borderWidth,
      borderColor: colors.nbBorder,
      backgroundColor: chipBackgroundColor,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: nb.minTouchTarget
    }}>
        <Text style={{
        fontSize: 13,
        fontWeight: '700',
        color: labelColor
      }} numberOfLines={1}>
          {label}: {valueLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color={chevronColor} />
      </View>
    </TouchableOpacity>;
}
function PhotoGridCard({
  item,
  cellSize,
  theme,
  colors,
  onOpen,
  onMenu
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const dateObj = parsePhotoDate(item);
  const dateLine = formatPhotoDateLine(dateObj);
  const thumbSide = cellSize - nb.borderWidth * 2;
  const pressIn = () => {
    Animated.timing(scale, {
      toValue: GRID_PRESS_SCALE_UP,
      duration: GRID_PRESS_IN_MS,
      useNativeDriver: true
    }).start();
  };
  const pressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: GRID_PRESS_OUT_MS,
      useNativeDriver: true
    }).start();
  };
  return <View style={{
    width: cellSize,
    marginBottom: 10
  }}>
      <Animated.View style={{
      transform: [{
        scale
      }]
    }}>
        <Pressable onPress={() => onOpen(item)} onPressIn={pressIn} onPressOut={pressOut}>
          <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
            <NbCard noShadow style={{
            padding: 0,
            overflow: 'hidden',
            width: cellSize
          }}>
              <Image source={{
              uri: item.url
            }} style={{
              width: thumbSide,
              height: thumbSide,
              backgroundColor: theme.cardBackgroundColor
            }} resizeMode="cover" />
            </NbCard>
          </HardShadow>
        </Pressable>
      </Animated.View>
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
      paddingHorizontal: 2
    }}>
        <Text style={{
        fontSize: 12,
        color: theme.mutedColor,
        flex: 1
      }} numberOfLines={1}>
          {dateLine}
        </Text>
        <TouchableOpacity onPress={() => onMenu(item)} hitSlop={{
        top: 8,
        bottom: 8,
        left: 8,
        right: 8
      }}>
          <Ionicons name="chevron-down" size={18} color={colors.nbMuted} />
        </TouchableOpacity>
      </View>
    </View>;
}
function CompareNeedTwoPhotosEmpty({
  theme
}) {
  return <View style={styles.centerFill}>
      <Text style={[styles.emptyTitle, {
      color: theme.textColor
    }]}>Need two photos</Text>
      <Text style={[styles.emptySub, {
      color: theme.mutedColor
    }]}>
        Add at least two progress photos to compare before and after.
      </Text>
    </View>;
}
function CompareStatCards({
  before,
  after,
  weeksApart,
  colors
}) {
  const statRows = buildCompareStatRows(before, after, weeksApart);
  const cards = [];
  for (let i = 0; i < statRows.length; i += 1) {
    const stat = statRows[i];
    cards.push(<HardShadow key={stat.label} offset={nb.shadowOffsetSmall} radius={10} style={{
      flex: 1
    }}>
        <View style={{
        borderWidth: nb.borderWidth,
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbSurface,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        minHeight: 64,
        justifyContent: 'center'
      }}>
          <Text style={{
          fontSize: 15,
          fontWeight: '900',
          color: colors.nbInk
        }}>{stat.value}</Text>
          <Text style={{
          fontSize: 11,
          fontWeight: '800',
          color: colors.nbMuted,
          marginTop: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.6
        }}>
            {stat.label}
          </Text>
        </View>
      </HardShadow>);
  }
  return <View style={{
    flexDirection: 'row',
    gap: 10,
    width: '100%'
  }}>{cards}</View>;
}
function CompareAngleChips({
  angleId,
  onSelectAngle,
  colors,
  bottomInset
}) {
  const chips = [];
  for (let i = 0; i < COMPARE_ANGLES.length; i += 1) {
    const angle = COMPARE_ANGLES[i];
    const isAngleSelected = angle.id === angleId;
    const chipBackgroundColor = isAngleSelected ? colors.nbFill : colors.nbSurface;
    const chipTextColor = isAngleSelected ? colors.nbOnFill : colors.nbInk;
    chips.push(<TouchableOpacity key={angle.id} onPress={() => onSelectAngle(angle.id)} style={{
      flex: 1,
      minHeight: 44,
      borderRadius: 999,
      borderWidth: nb.borderWidth,
      borderColor: colors.nbBorder,
      backgroundColor: chipBackgroundColor,
      alignItems: 'center',
      justifyContent: 'center'
    }}>
        <Text style={{
        fontSize: 14,
        fontWeight: '900',
        color: chipTextColor
      }}>
          {angle.label}
        </Text>
      </TouchableOpacity>);
  }
  return <View style={{
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: Math.max(bottomInset, 16)
  }}>
      {chips}
    </View>;
}

/**
 * Design Law before/after slider (progress PNG 09/10).
 * vocab: clip left image to dividerX; right image shows full under it
 */
function CompareSliderModal({
  visible,
  onClose,
  photos,
  colors,
  theme
}) {
  const {
    width: windowWidth
  } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [angleId, setAngleId] = useState(COMPARE_ANGLE_FRONT);
  const frameSize = Math.min(windowWidth - COMPARE_FRAME_H_MARGIN, COMPARE_FRAME_MAX);
  const dividerX = useSharedValue(frameSize / 2);
  const startX = useSharedValue(frameSize / 2);
  const comparePair = useMemo(() => pickComparePair(photos, angleId), [photos, angleId]);
  const before = comparePair[0];
  const after = comparePair[1];
  const weeksApart = weeksBetweenPhotos(before, after);
  const hasComparePair = Boolean(before && before.url && after && after.url);
  useEffect(() => {
    if (!visible) return;
    dividerX.value = frameSize / 2;
    startX.value = frameSize / 2;
  }, [visible, frameSize, angleId, dividerX, startX]);
  const pan = Gesture.Pan().onBegin(() => {
    startX.value = dividerX.value;
  }).onUpdate(dragEvent => {
    dividerX.value = clamp(startX.value + dragEvent.translationX, COMPARE_SLIDER_EDGE_PAD, frameSize - COMPARE_SLIDER_EDGE_PAD);
  });
  const leftClipStyle = useAnimatedStyle(() => ({
    width: dividerX.value
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: dividerX.value - COMPARE_HANDLE_HALF_WIDTH
    }]
  }));
  if (!visible) return null;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, {
      backgroundColor: theme.backgroundColor
    }]} edges={SHELL_SAFE_AREA_EDGES}>
        <View style={[styles.modalTop, {
        paddingTop: Math.max(insets.top, 8)
      }]}>
          <TouchableOpacity onPress={onClose} style={[styles.modalSqBtn, {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface
        }]} accessibilityLabel="Close compare">
            <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
          </TouchableOpacity>
          <View style={styles.modalTitleStack}>
            <Text style={[styles.modalTitle, {
            color: colors.nbInk
          }]}>Compare</Text>
            <Text style={[styles.modalSubtitle, {
            color: colors.nbMuted
          }]}>Drag the line</Text>
          </View>
          <View style={styles.hit44} />
        </View>

        <View style={{
        flex: 1,
        paddingHorizontal: 20,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16
      }}>
          {!hasComparePair ? <CompareNeedTwoPhotosEmpty theme={theme} /> : <>
              <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
                <View style={{
              width: frameSize,
              height: frameSize,
              borderRadius: borderRadius.nbCard,
              borderWidth: nb.borderWidth,
              borderColor: colors.nbBorder,
              overflow: 'hidden',
              backgroundColor: colors.nbSoft
            }}>
                  <Image source={{
                uri: after.url
              }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <AnimatedRe.View style={[{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                overflow: 'hidden'
              }, leftClipStyle]}>
                    <Image source={{
                  uri: before.url
                }} style={{
                  width: frameSize,
                  height: frameSize
                }} resizeMode="cover" />
                  </AnimatedRe.View>
                  <GestureDetector gesture={pan}>
                    <AnimatedRe.View style={[{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 44,
                  alignItems: 'center'
                }, handleStyle]}>
                      <View style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: 3,
                    backgroundColor: colors.nbInk
                  }} />
                      <View style={{
                    marginTop: frameSize / 2 - COMPARE_HANDLE_HALF_WIDTH,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderWidth: nb.borderWidth,
                    borderColor: colors.nbBorder,
                    backgroundColor: colors.nbFill,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                        <Ionicons name="swap-horizontal" size={20} color={colors.nbOnFill} />
                      </View>
                    </AnimatedRe.View>
                  </GestureDetector>
                  <Text style={{
                position: 'absolute',
                left: 10,
                bottom: 10,
                fontSize: 12,
                fontWeight: '800',
                color: colors.nbOnFill,
                textShadowColor: 'rgba(0,0,0,0.55)',
                textShadowRadius: 4
              }}>
                    {formatPhotoShortDate(before.parsedDate)}
                  </Text>
                  <Text style={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                fontSize: 12,
                fontWeight: '800',
                color: colors.nbOnFill,
                textShadowColor: 'rgba(0,0,0,0.55)',
                textShadowRadius: 4
              }}>
                    {formatPhotoShortDate(after.parsedDate)}
                  </Text>
                </View>
              </HardShadow>

              <CompareStatCards before={before} after={after} weeksApart={weeksApart} colors={colors} />
            </>}
        </View>

        <CompareAngleChips angleId={angleId} onSelectAngle={setAngleId} colors={colors} bottomInset={insets.bottom} />
      </SafeAreaView>
    </Modal>;
}

/**
 * Horizontal thumbnails under the fullscreen viewer (Design Law progress 07/08).
 * Tap jumps the pager without leaving the modal.
 */
function ProgressPhotosViewerThumbStrip({
  filteredSorted,
  modalIndex,
  colors,
  onSelectThumb
}) {
  if (filteredSorted.length <= 1) return null;
  const thumbs = [];
  for (let thumbIndex = 0; thumbIndex < filteredSorted.length; thumbIndex += 1) {
    const thumb = filteredSorted[thumbIndex];
    const isThumbSelected = thumbIndex === modalIndex;
    const thumbBorderWidth = isThumbSelected ? nb.borderWidth : 2;
    const thumbOpacity = isThumbSelected ? 1 : 0.72;
    const thumbKey = thumb.id || thumb.url || `thumb-${thumbIndex}`;
    thumbs.push(<TouchableOpacity key={thumbKey} onPress={() => onSelectThumb(thumbIndex)} activeOpacity={0.88}>
        <View style={[styles.modalThumb, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbSoft,
        borderWidth: thumbBorderWidth,
        opacity: thumbOpacity
      }]}>
          {thumb.url ? <Image source={{
          uri: thumb.url
        }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
        </View>
      </TouchableOpacity>);
  }
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalThumbStrip}>
      {thumbs}
    </ScrollView>;
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
  reserveShellBottomNav = false
}) {
  // --- Hook order is frozen. Do not reorder. ---
  const insets = useSafeAreaInsets();
  const {
    width: windowWidth,
    height: windowHeight
  } = useWindowDimensions();
  const {
    colors,
    isDark: appIsDark
  } = useTheme();
  // 1. Read who this gallery belongs to and whether upload / bottom-nav reserve are on.
  const galleryRoute = readGalleryRouteOptions(route, reserveShellBottomNav);
  const clientId = galleryRoute.clientId;
  const clientName = galleryRoute.clientName;
  const allowUpload = galleryRoute.allowUpload;
  const reserveNav = galleryRoute.reserveNav;
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalIndex, setModalIndex] = useState(null);
  const [sortId, setSortId] = useState(SORT_DATE_NEWEST);
  const [filterId, setFilterId] = useState(FILTER_ALL);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [fullscreenZoomed, setFullscreenZoomed] = useState(false);
  const [galleryReloadKey, setGalleryReloadKey] = useState(0);
  const [notice, setNotice] = useState(null);
  const [photoActionsPhoto, setPhotoActionsPhoto] = useState(null);
  const showNotice = useCallback((title, message, extras = {}) => setNotice({
    title,
    message,
    ...extras
  }), []);
  const listRef = useRef(null);
  const isDark = appIsDark;
  const theme = useMemo(() => galleryThemeFromColors(colors, isDark), [colors, isDark]);
  const isTabletWidth = windowWidth >= TABLET_MIN_WIDTH;
  const columnCount = isTabletWidth ? TABLET_COLUMN_COUNT : PHONE_COLUMN_COUNT;
  const cellSize = (windowWidth - GRID_PAD * 2 - GRID_GAP * (columnCount - 1)) / columnCount;
  useEffect(() => {
    if (!clientId || !db) return;
    setLoading(true);
    setError(null);
    const colRef = collection(db, USERS_COLLECTION, clientId, PROGRESS_PHOTOS_COLLECTION);
    // vocab: onSnapshot = live Firestore listener. Cleanup must stay return () => unsub().
    const photosQuery = query(colRef, orderBy('date', 'desc'));
    const unsub = onSnapshot(photosQuery, firestoreSnapshot => {
      setPhotos(photosFromSnapshot(firestoreSnapshot));
      setLoading(false);
    }, snapshotError => {
      setError((snapshotError == null ? void 0 : snapshotError.message) || 'Failed to load photos');
      setPhotos([]);
      setLoading(false);
    });
    return () => unsub();
  }, [clientId, galleryReloadKey]);
  const decoratedPhotos = useMemo(() => decoratePhotoList(photos), [photos]);
  const filteredSorted = useMemo(() => {
    const matched = photosMatchingFilter(decoratedPhotos, filterId);
    return sortProgressPhotos(matched, sortId);
  }, [decoratedPhotos, filterId, sortId]);
  const sortLabel = findSortLabel(sortId);
  const filterLabel = findFilterLabel(filterId);
  const handleAddPhoto = useCallback(async () => {
    // 1. Trainers in view-only mode cannot upload.
    if (!allowUpload) {
      showNotice('View only', 'Your trainer can add photos here when upload is enabled for this view.');
      return;
    }

    // 2. Need a client id to know which profile folder to write.
    if (!clientId) {
      showNotice('Something went wrong', 'We could not tell which profile to save this photo to. Go back and open Progress Photos again.');
      return;
    }

    // 3. Need Firestore and Storage. Offline / misconfigured installs stop here.
    if (!db || !storage) {
      showNotice('Upload unavailable', 'Photo backup is not available right now. Check your internet connection and that the app is configured with Firebase Storage, then try again.');
      return;
    }

    // 4. Ask for the photo library. Denied → stop.
    // vocab: ImagePicker = Expo photo library. status !== 'granted' means they tapped Don't Allow.
    const {
      status
    } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showNotice('Permission needed', 'Allow access to your photos to add progress pictures.');
      return;
    }

    // 5. Pick a square image. Cancel or no uri → stop.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: IMAGE_PICKER_QUALITY,
      allowsEditing: true,
      aspect: [1, 1]
    });
    const localUri = pickedImageUri(result);
    if (!localUri) return;

    // 6. Upload to Storage and write the Firestore row. The live listener adds the card.
    try {
      var _optObj;
      await uploadProgressPhoto({
        clientId,
        localUri,
        uploadedByUid: (_optObj = auth == null ? void 0 : auth.currentUser) == null ? void 0 : _optObj.uid
      });
    } catch (uploadError) {
      showNotice('Upload failed', (uploadError == null ? void 0 : uploadError.message) || 'Could not add photo.');
    }
  }, [allowUpload, clientId, db, storage, showNotice]);
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
  const openAtIndex = photoIndex => {
    // 1. Reset pinch-zoom, then show that photo full screen.
    setFullscreenZoomed(false);
    setModalIndex(photoIndex);
  };
  useEffect(() => {
    if (modalIndex == null || filteredSorted.length === 0) return;
    const scrollTimer = setTimeout(() => {
      try {
        var _optFn, _optObj2;
        (_optFn = (_optObj2 = listRef.current) == null ? void 0 : _optObj2.scrollToIndex) == null ? void 0 : _optFn({
          index: Math.min(modalIndex, filteredSorted.length - 1),
          animated: false
        });
      } catch (_) {
        var _optFn2, _optObj3;
        (_optFn2 = (_optObj3 = listRef.current) == null ? void 0 : _optObj3.scrollToOffset) == null ? void 0 : _optFn2({
          offset: windowWidth * modalIndex,
          animated: false
        });
      }
    }, SCROLL_TO_PHOTO_DELAY_MS);
    return () => clearTimeout(scrollTimer);
  }, [modalIndex, filteredSorted.length, windowWidth]);
  const openPhoto = item => {
    // 1. Find this card in the filtered list, then open that index.
    const photoIndex = filteredSorted.findIndex(photo => photo.id === item.id);
    if (photoIndex >= 0) openAtIndex(photoIndex);
  };
  const closeModal = () => {
    // 1. Close fullscreen and unlock horizontal swipe.
    setModalIndex(null);
    setFullscreenZoomed(false);
  };
  const handleDeletePhoto = async photo => {
    // 1. No photo → nothing to delete.
    if (!photo) return;

    // 2. Confirm, then remove Storage + the Firestore row. The live listener drops the card.
    showNotice('Delete photo', 'Are you sure you want to delete this photo?', {
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteProgressPhoto({
            photo,
            clientId
          });
          closeModal();
        } catch (deleteError) {
          showNotice('Error', (deleteError == null ? void 0 : deleteError.message) || 'Could not delete photo.');
        }
      }
    });
  };
  const handleShare = async photoUrl => {
    // 1. No url → nothing to share. Share sheet cancel is ignored.
    if (!photoUrl) return;
    try {
      await Share.share({
        message: 'Progress photo from CoachConnect',
        url: photoUrl
      });
    } catch (_) {}
  };
  const showPhotoActions = photo => {
    // 1. Share / Delete / Cancel. iOS uses the action sheet; Android uses NbSheet.
    const buttons = ['Share', 'Delete', 'Cancel'];
    const handlers = [() => handleShare(photo == null ? void 0 : photo.url), () => handleDeletePhoto(photo), () => {}];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({
        options: buttons,
        cancelButtonIndex: 2,
        destructiveButtonIndex: 1
      }, buttonIndex => {
        const handler = handlers[buttonIndex];
        if (handler) handler();
      });
    } else {
      setPhotoActionsPhoto(photo);
    }
  };
  const renderGridItem = ({
    item
  }) => <View style={{
    width: cellSize
  }}>
      <PhotoGridCard item={item} cellSize={cellSize} theme={theme} colors={colors} onOpen={openPhoto} onMenu={showPhotoActions} />
    </View>;
  const flatIndexValid = modalIndex != null && modalIndex >= 0 && modalIndex < filteredSorted.length;
  const current = flatIndexValid ? filteredSorted[modalIndex] : null;
  const currentDate = current ? parsePhotoDate(current) : null;
  const modalTitleShort = currentDate ? formatPhotoShortDate(currentDate) : '';
  const modalPosition = flatIndexValid && filteredSorted.length ? `${modalIndex + 1} of ${filteredSorted.length}` : '';
  const modalBodyPart = current ? bodyPartDisplayName(current) : '';
  let modalSubtitle = modalPosition || modalBodyPart;
  if (modalBodyPart && modalPosition) {
    modalSubtitle = `${modalBodyPart} · ${modalPosition}`;
  }
  let photoOverlayCaption = modalTitleShort;
  if (currentDate && modalBodyPart) {
    photoOverlayCaption = `${modalBodyPart}, ${formatPhotoShortDate(currentDate)}`;
  }
  const indexPill = flatIndexValid && filteredSorted.length ? `${modalIndex + 1} / ${filteredSorted.length}` : '';
  const noteLine = (current == null ? void 0 : current.note) || (current == null ? void 0 : current.caption) || null;
  const fullscreenHeight = windowHeight - insets.top - insets.bottom;
  const goAdjacentPhoto = direction => {
    if (modalIndex == null) return;
    const nextPhotoIndex = modalIndex + direction;
    if (nextPhotoIndex >= 0 && nextPhotoIndex < filteredSorted.length) {
      setFullscreenZoomed(false);
      setModalIndex(nextPhotoIndex);
    }
  };
  const selectFullscreenThumb = thumbIndex => {
    var _optFn3, _optObj4;
    setModalIndex(thumbIndex);
    (_optFn3 = (_optObj4 = listRef.current) == null ? void 0 : _optObj4.scrollToIndex) == null ? void 0 : _optFn3({
      index: thumbIndex,
      animated: true
    });
  };
  const headerIconColor = colors.nbInk;
  const handleBack = () => {
    var _optFn4;
    // 1. Shell header uses onBack. Standalone screen uses navigation.goBack.
    if (typeof onBack === 'function') onBack();else (_optFn4 = navigation == null ? void 0 : navigation.goBack) == null ? void 0 : _optFn4();
  };
  const gridBottomPad = insets.bottom + GRID_BOTTOM_EXTRA + (reserveNav ? BOTTOM_NAV_BAR_HEIGHT : 0);
  const showSortOrFilterMenu = showSortMenu || showFilterMenu;
  const showEmptyState = !loading && !error && filteredSorted.length === 0;
  const showPhotoGrid = !loading && !error && filteredSorted.length > 0;
  const showFab = !loading && !error && allowUpload;
  const emptySubtitle = allowUpload ? 'Your first photo will show here' : `When ${clientName} adds progress photos, they will appear here.`;
  const fabBottom = (reserveNav ? BOTTOM_NAV_BAR_HEIGHT : 0) + Math.max(insets.bottom, 8) + 20;
  const nextPhotoDisabled = !flatIndexValid || modalIndex >= filteredSorted.length - 1;
  const nextPhotoOpacity = modalIndex >= filteredSorted.length - 1 ? 0.4 : 1;
  const photoActionsSheetVisible = Boolean(photoActionsPhoto);
  const noticeSheetVisible = Boolean(notice);

  // 1. Header, sort/filter, then grid / empty / error. Fullscreen modal sits on top.
  return <SafeAreaView style={[styles.safe, {
    backgroundColor: theme.backgroundColor
  }]} edges={SHELL_SAFE_AREA_EDGES}>
      {useShellHeader ? <TopHeader title="Progress Photos" skipTopSafeInset onBack={handleBack} /> : <View style={{
      paddingTop: 8
    }}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} hitSlop={{
          top: 14,
          bottom: 14,
          left: 14,
          right: 14
        }} style={styles.hit44}>
              <Ionicons name="chevron-back" size={24} color={headerIconColor} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, {
          color: headerIconColor
        }]}>Progress Photos</Text>
            <View style={styles.hit44} />
          </View>
          <View style={{
        height: nb.borderWidth,
        marginHorizontal: GRID_PAD,
        backgroundColor: colors.nbBorder
      }} />
          <Text style={[styles.clientSub, {
        color: theme.mutedColor
      }]} numberOfLines={1}>
            {clientName}
          </Text>
        </View>}

      <View style={{
      paddingTop: useShellHeader ? 8 : 0
    }}>
        <View style={[styles.controlsRow, {
        paddingHorizontal: GRID_PAD,
        gap: 10
      }]}>
          <View style={{
          flex: 1
        }}>
            <DropdownChip label="Sort" valueLabel={sortLabel} colors={colors} focused={showSortMenu} onPress={() => {
            setShowFilterMenu(false);
            setShowSortMenu(isSortOpen => !isSortOpen);
          }} />
          </View>
          <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
            <TouchableOpacity onPress={() => {
            setShowSortMenu(false);
            setShowFilterMenu(false);
            setCompareOpen(true);
          }} style={{
            minHeight: nb.minTouchTarget,
            paddingHorizontal: 16,
            borderRadius: borderRadius.nbChip,
            borderWidth: nb.borderWidth,
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface,
            alignItems: 'center',
            justifyContent: 'center'
          }} accessibilityRole="button" accessibilityLabel="Compare progress photos">
              <Text style={{
              fontSize: 13,
              fontWeight: '800',
              color: colors.nbInk
            }}>Compare</Text>
            </TouchableOpacity>
          </HardShadow>
          <DropdownChip label="Filter" valueLabel={filterLabel} colors={colors} focused={showFilterMenu} onPress={() => {
          setShowSortMenu(false);
          setShowFilterMenu(isFilterOpen => !isFilterOpen);
        }} />
        </View>

        {showSortOrFilterMenu ? <View style={[styles.menuPanel, {
        marginHorizontal: GRID_PAD,
        backgroundColor: theme.menuBackgroundColor,
        borderColor: colors.nbBorder
      }]}>
            {showSortMenu ? SORT_OPTIONS.map(option => <TouchableOpacity key={option.id} style={[styles.menuRow, {
          borderBottomColor: colors.nbBorder
        }]} onPress={() => {
          setSortId(option.id);
          setShowSortMenu(false);
        }}>
                    <Text style={[styles.menuText, {
            color: theme.textColor
          }]}>{option.label}</Text>
                    {sortId === option.id ? <Ionicons name="checkmark" size={18} color={colors.nbFill} /> : null}
                  </TouchableOpacity>) : null}
            {showFilterMenu ? FILTER_OPTIONS.map(option => <TouchableOpacity key={option.id} style={[styles.menuRow, {
          borderBottomColor: colors.nbBorder
        }]} onPress={() => {
          setFilterId(option.id);
          setShowFilterMenu(false);
        }}>
                    <Text style={[styles.menuText, {
            color: theme.textColor
          }]}>{option.label}</Text>
                    {filterId === option.id ? <Ionicons name="checkmark" size={18} color={colors.nbFill} /> : null}
                  </TouchableOpacity>) : null}
          </View> : null}
      </View>

      {loading ? <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.nbFill} />
        </View> : null}

      {error && !loading ? <View style={styles.centerFill}>
          <Text style={{
        color: ERROR_TEXT_COLOR,
        textAlign: 'center',
        marginBottom: 12
      }}>
            {error}
          </Text>
          <NbButton variant="fill" sm onPress={() => {
        setError(null);
        setGalleryReloadKey(reloadKey => reloadKey + 1);
      }}>
            Retry
          </NbButton>
        </View> : null}

      {showEmptyState ? <View style={styles.centerFill}>
          <Ionicons name="camera-outline" size={52} color={theme.mutedColor} style={{
        opacity: 0.85
      }} />
          <Text style={[styles.emptyTitle, {
        color: theme.textColor
      }]}>No progress photos yet</Text>
          <Text style={[styles.emptySub, {
        color: theme.mutedColor
      }]}>{emptySubtitle}</Text>
          {allowUpload ? <View style={styles.emptyCtaWrap}>
              <NbButton variant="fill" onPress={handleAddPhoto}>
                Add photo from library
              </NbButton>
            </View> : null}
        </View> : null}

      {showPhotoGrid ? <FlatList key={columnCount} data={filteredSorted} keyExtractor={item => item.id || item.url} numColumns={columnCount} contentContainerStyle={{
      paddingHorizontal: GRID_PAD,
      paddingBottom: gridBottomPad,
      paddingTop: 8
    }} renderItem={renderGridItem} columnWrapperStyle={columnCount > 1 ? {
      gap: GRID_GAP,
      marginBottom: 10
    } : undefined} showsVerticalScrollIndicator={false} initialNumToRender={12} windowSize={7} /> : null}

      {showFab ? <View style={[styles.fabRow, {
      bottom: fabBottom
    }]} pointerEvents="box-none">
          <Pressable onPress={handleAddPhoto} accessibilityRole="button" accessibilityLabel="Add progress photo from library" hitSlop={{
        top: 20,
        bottom: 20,
        left: 20,
        right: 20
      }} style={({
        pressed
      }) => [styles.fabTouch, pressed && styles.fabTouchPressed]}>
            <HardShadow radius={31} offset={nb.shadowOffsetSmall}>
              <LinearGradient colors={gradients.brand.colors} start={gradients.brand.start} end={gradients.brand.end} style={[styles.fab, {
            borderWidth: nb.borderWidth,
            borderColor: colors.nbBorder
          }]}>
                <Ionicons name="add" size={32} color={colors.nbInk} />
              </LinearGradient>
            </HardShadow>
          </Pressable>
        </View> : null}

      <Modal visible={modalIndex != null} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={[styles.modalRoot, {
        backgroundColor: colors.nbBackground
      }]}>
          <View style={[styles.modalTop, {
          paddingTop: insets.top + 8
        }]}>
            <TouchableOpacity onPress={closeModal} hitSlop={12} accessibilityLabel="Close photo viewer">
              <HardShadow radius={borderRadius.nbChip} offset={nb.shadowOffsetSmall}>
                <View style={[styles.modalSqBtn, {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface
              }]}>
                  <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
                </View>
              </HardShadow>
            </TouchableOpacity>
            <View style={styles.modalTitleStack}>
              <Text style={[styles.modalTitle, {
              color: colors.nbInk
            }]} numberOfLines={1}>
                {modalTitleShort}
              </Text>
              {modalSubtitle ? <Text style={[styles.modalSubtitle, {
              color: colors.nbMuted
            }]} numberOfLines={1}>
                  {modalSubtitle}
                </Text> : null}
            </View>
            <TouchableOpacity onPress={() => goAdjacentPhoto(1)} hitSlop={12} disabled={nextPhotoDisabled} accessibilityLabel="Next photo" style={{
            opacity: nextPhotoOpacity
          }}>
              <HardShadow radius={borderRadius.nbChip} offset={nb.shadowOffsetSmall}>
                <View style={[styles.modalSqBtn, {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface
              }]}>
                  <Ionicons name="chevron-forward" size={22} color={colors.nbInk} />
                </View>
              </HardShadow>
            </TouchableOpacity>
          </View>

          <FlatList ref={listRef} data={filteredSorted} keyExtractor={item => item.id || item.url} horizontal pagingEnabled scrollEnabled={!fullscreenZoomed} showsHorizontalScrollIndicator={false} getItemLayout={(_, index) => ({
          length: windowWidth,
          offset: windowWidth * index,
          index
        })} onScrollToIndexFailed={({
          index
        }) => {
          var _optFn5, _optObj5;
          const offset = index * windowWidth;
          (_optFn5 = (_optObj5 = listRef.current) == null ? void 0 : _optObj5.scrollToOffset) == null ? void 0 : _optFn5({
            offset,
            animated: false
          });
        }} onMomentumScrollEnd={scrollEvent => {
          const offsetX = scrollEvent.nativeEvent.contentOffset.x;
          const scrolledPhotoIndex = Math.round(offsetX / windowWidth);
          if (scrolledPhotoIndex >= 0 && scrolledPhotoIndex < filteredSorted.length) {
            setModalIndex(scrolledPhotoIndex);
          }
        }} renderItem={({
          item,
          index
        }) => {
          const frameWidth = windowWidth - FULLSCREEN_FRAME_PAD * 2;
          const frameHeight = Math.min(fullscreenHeight - FULLSCREEN_BOTTOM_RESERVE, frameWidth * FULLSCREEN_FRAME_ASPECT);
          const showIndexPill = index === modalIndex && Boolean(indexPill);
          const showCaption = index === modalIndex && Boolean(photoOverlayCaption);
          return <View style={{
            width: windowWidth,
            paddingHorizontal: FULLSCREEN_FRAME_PAD,
            justifyContent: 'center',
            minHeight: frameHeight + FULLSCREEN_FRAME_PAD
          }}>
                  <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
                    <View style={[styles.modalPhotoFrame, {
                width: frameWidth,
                height: frameHeight,
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface
              }]}>
                      {item.url ? <ZoomablePhoto uri={item.url} width={frameWidth} height={frameHeight} onZoomChange={setFullscreenZoomed} /> : null}
                      {showIndexPill ? <View style={[styles.modalIndexPill, {
                  borderColor: colors.nbBorder,
                  backgroundColor: colors.nbFill
                }]}>
                          <Text style={[styles.modalIndexPillText, {
                    color: colors.nbOnFill
                  }]}>
                            {indexPill}
                          </Text>
                        </View> : null}
                      {showCaption ? <Text style={[styles.modalPhotoCaption, {
                  color: colors.nbInk
                }]} numberOfLines={1}>
                          {photoOverlayCaption}
                        </Text> : null}
                    </View>
                  </HardShadow>
                </View>;
        }} />

          <View style={[styles.modalBottom, {
          paddingBottom: insets.bottom + 12
        }]}>
            <ProgressPhotosViewerThumbStrip filteredSorted={filteredSorted} modalIndex={modalIndex} colors={colors} onSelectThumb={selectFullscreenThumb} />
            <Text style={[styles.swipeHint, {
            color: colors.nbMuted
          }]}>Swipe for next photo</Text>
            {noteLine ? <Text style={[styles.noteText, {
            color: colors.nbMuted
          }]} numberOfLines={2}>
                {noteLine}
              </Text> : null}
            <View style={styles.modalActionRow}>
              <View style={{
              flex: 1
            }}>
                <NbButton variant="ghost" onPress={() => (current == null ? void 0 : current.url) && handleShare(current.url)}>
                  Share
                </NbButton>
              </View>
              {allowUpload ? <View style={{
              flex: 1
            }}>
                  <NbButton variant="fill" onPress={() => current && handleDeletePhoto(current)}>
                    Delete
                  </NbButton>
                </View> : null}
            </View>
          </View>
        </View>
      </Modal>

      <CompareSliderModal visible={compareOpen} onClose={() => setCompareOpen(false)} photos={decoratedPhotos} colors={colors} theme={theme} />

      <NbSheet visible={photoActionsSheetVisible} onClose={() => setPhotoActionsPhoto(null)} title="Photo">
        <View style={{
        gap: 10,
        paddingHorizontal: 16,
        paddingBottom: 24
      }}>
          <NbButton variant="fill" onPress={() => {
          const photo = photoActionsPhoto;
          setPhotoActionsPhoto(null);
          handleShare(photo == null ? void 0 : photo.url);
        }}>
            Share
          </NbButton>
          <NbButton variant="plain" onPress={() => {
          const photo = photoActionsPhoto;
          setPhotoActionsPhoto(null);
          if (photo) void handleDeletePhoto(photo);
        }}>
            Delete
          </NbButton>
          <NbButton variant="ghost" onPress={() => setPhotoActionsPhoto(null)}>
            Cancel
          </NbButton>
        </View>
      </NbSheet>

      <NbNoticeSheet visible={noticeSheetVisible} onClose={() => setNotice(null)} title={(notice == null ? void 0 : notice.title) || ''} message={notice == null ? void 0 : notice.message} confirmLabel={(notice == null ? void 0 : notice.confirmLabel) || 'OK'} cancelLabel={notice == null ? void 0 : notice.cancelLabel} onConfirm={notice == null ? void 0 : notice.onConfirm} destructive={!!(notice == null ? void 0 : notice.destructive)} />
    </SafeAreaView>;
}

// PLUMBING — skip unless debugging Design Law spacing / FAB / modal chrome

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center'
  },
  hit44: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clientSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 24
  },
  controlsRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  menuPanel: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    marginBottom: 8,
    overflow: 'hidden'
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600'
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center'
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center'
  },
  emptyCtaWrap: {
    marginTop: 22,
    alignSelf: 'center',
    width: '80%',
    maxWidth: 400
  },
  fabRow: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    zIndex: 50,
    elevation: 24
  },
  /** Outer wrap enlarges the tap target without crowding the grid. */
  fabTouch: {
    padding: 8,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fabTouchPressed: {
    opacity: 0.88,
    transform: [{
      scale: 0.96
    }]
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalRoot: {
    flex: 1
  },
  modalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10
  },
  modalSqBtn: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalTitleStack: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2
  },
  modalPhotoFrame: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
    position: 'relative'
  },
  modalIndexPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth
  },
  modalIndexPillText: {
    fontSize: 12,
    fontWeight: '800'
  },
  modalPhotoCaption: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    fontSize: 13,
    fontWeight: '800',
    maxWidth: '78%'
  },
  modalBottom: {
    paddingHorizontal: 16,
    paddingTop: 8
  },
  // Manipulate here: thumbnail strip under fullscreen photo (Design Law viewer)
  modalThumbStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingRight: 8
  },
  modalThumb: {
    width: 56,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden'
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12
  },
  noteText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center'
  },
  swipeHint: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  }
});
