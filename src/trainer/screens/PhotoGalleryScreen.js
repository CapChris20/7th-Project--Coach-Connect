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
import { db, storage, auth } from '../../app/config';
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
import { useTheme } from '../../shared/ui/ThemeContext';

const GRADIENT_PRIMARY = ['#C1265A', '#D84315'];
const GRADIENT_CARD_BORDER = ['#C1265A', '#663399'];
const TABLET_MIN_WIDTH = 768;

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

function parsePhotoDate(p) {
  if (p.date?.toDate) return p.date.toDate();
  if (p.date instanceof Date) return p.date;
  return new Date();
}

function photoBodyPart(p) {
  const raw = (p.bodyPart || p.category || p.tag || '').toString().toLowerCase().replace(/\s+/g, '_');
  if (!raw) return 'other';
  if (FILTER_OPTIONS.some((f) => f.id === raw)) return raw;
  if (raw === 'fullbody' || raw === 'full-body') return 'full_body';
  return raw;
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

  const notify = (z) => {
    onZoomChange?.(z);
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
  const dateLine = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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

export default function PhotoGalleryScreen({ route, navigation, onRegisterAddHandler }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const { isDark: appIsDark } = useTheme();
  const clientId = route?.params?.clientId;
  const clientName = route?.params?.clientName || 'Client';
  /** Trainers only view; clients upload from the gallery. */
  const allowUpload = route?.params?.allowUpload !== false;

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
    const colRef = collection(db, 'users', clientId, 'progressPhotos');
    const q = query(colRef, orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setPhotos(list);
        setLoading(false);
      },
      (e) => {
        setError(e?.message || 'Failed to load photos');
        setPhotos([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [clientId, galleryReloadKey]);

  const processed = useMemo(() => {
    return photos.map((p) => ({
      ...p,
      _date: parsePhotoDate(p),
      _body: photoBodyPart(p),
      _name: (p.storagePath || p.url || p.id || '').toString(),
    }));
  }, [photos]);

  const filteredSorted = useMemo(() => {
    let list = processed.filter((p) => {
      if (filterId === 'all') return true;
      return p._body === filterId;
    });
    list = [...list];
    if (sortId === 'date_desc') list.sort((a, b) => b._date - a._date);
    else if (sortId === 'date_asc') list.sort((a, b) => a._date - b._date);
    else list.sort((a, b) => a._name.localeCompare(b._name));
    return list;
  }, [processed, filterId, sortId]);

  const sortLabel = SORT_OPTIONS.find((s) => s.id === sortId)?.label.replace(/^By /, '') || 'Date';
  const filterLabel = FILTER_OPTIONS.find((f) => f.id === filterId)?.label || 'All';

  const handleAddPhoto = useCallback(async () => {
    if (!allowUpload) {
      Alert.alert('View only', 'Your trainer can add photos here when upload is enabled for this view.');
      return;
    }
    if (!clientId) {
      Alert.alert('Something went wrong', 'We could not tell which profile to save this photo to. Go back and open Progress Photos again.');
      return;
    }
    if (!db || !storage) {
      Alert.alert('Upload unavailable', 'Photo backup is not available right now. Check your internet connection and that the app is configured with Firebase Storage, then try again.');
      return;
    }
    const user = auth?.currentUser;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to add progress pictures.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    try {
      const filename = `${Date.now()}.jpg`;
      const storageRef = ref(storage, `progressPhotos/${clientId}/${filename}`);
      const response = await fetch(uri);
      const blob = await response.blob();
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      const colRef = collection(db, 'users', clientId, 'progressPhotos');
      await addDoc(colRef, {
        url: downloadUrl,
        date: serverTimestamp(),
        uploadedBy: user?.uid || null,
        clientId,
        storagePath: storageRef.fullPath,
      });
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not add photo.');
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

  const openAtIndex = (idx) => {
    setFullscreenZoomed(false);
    setModalIndex(idx);
  };

  useEffect(() => {
    if (modalIndex == null || filteredSorted.length === 0) return;
    const t = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({
          index: Math.min(modalIndex, filteredSorted.length - 1),
          animated: false,
        });
      } catch (_) {
        listRef.current?.scrollToOffset({ offset: winW * modalIndex, animated: false });
      }
    }, 48);
    return () => clearTimeout(t);
  }, [modalIndex, filteredSorted.length, winW]);

  const openPhoto = (item) => {
    const idx = filteredSorted.findIndex((p) => p.id === item.id);
    if (idx >= 0) openAtIndex(idx);
  };

  const closeModal = () => {
    setModalIndex(null);
    setFullscreenZoomed(false);
  };

  const handleDeletePhoto = async (photo) => {
    if (!photo) return;
    Alert.alert('Delete photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (photo.storagePath && storage) {
              await deleteObject(ref(storage, photo.storagePath));
            }
            if (db && clientId && photo.id) {
              await deleteDoc(doc(db, 'users', clientId, 'progressPhotos', photo.id));
            }
            closeModal();
          } catch (e) {
            Alert.alert('Error', e?.message || 'Could not delete photo.');
          }
        },
      },
    ]);
  };

  const handleShare = async (photoUrl) => {
    if (!photoUrl) return;
    try {
      await Share.share({ message: 'Progress photo from CoachConnect', url: photoUrl });
    } catch (_) {}
  };

  const showPhotoActions = (photo) => {
    const buttons = ['Share', 'Delete', 'Cancel'];
    const handlers = [
      () => handleShare(photo?.url),
      () => handleDeletePhoto(photo),
      () => {},
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: buttons, cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (i) => handlers[i]?.()
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      <View style={{ paddingTop: 8 }}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
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

        <View style={[styles.controlsRow, { paddingHorizontal: gridPad, gap: 10 }]}>
          <DropdownChip
            label="Sort"
            valueLabel={sortLabel}
            isDark={isDark}
            theme={theme}
            focused={showSortMenu}
            onPress={() => {
              setShowFilterMenu(false);
              setShowSortMenu((v) => !v);
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
              setShowFilterMenu((v) => !v);
            }}
          />
        </View>

        {(showSortMenu || showFilterMenu) && (
          <View style={[styles.menuPanel, { marginHorizontal: gridPad, backgroundColor: theme.menuBg, borderColor: theme.chipBorder }]}>
            {showSortMenu &&
              SORT_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={styles.menuRow}
                  onPress={() => {
                    setSortId(o.id);
                    setShowSortMenu(false);
                  }}
                >
                  <Text style={[styles.menuText, { color: theme.text }]}>{o.label}</Text>
                  {sortId === o.id ? <Ionicons name="checkmark" size={18} color="#C1265A" /> : null}
                </TouchableOpacity>
              ))}
            {showFilterMenu &&
              FILTER_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={styles.menuRow}
                  onPress={() => {
                    setFilterId(o.id);
                    setShowFilterMenu(false);
                  }}
                >
                  <Text style={[styles.menuText, { color: theme.text }]}>{o.label}</Text>
                  {filterId === o.id ? <Ionicons name="checkmark" size={18} color="#C1265A" /> : null}
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
              setGalleryReloadKey((k) => k + 1);
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
          contentContainerStyle={{ paddingHorizontal: gridPad, paddingBottom: insets.bottom + 24, paddingTop: 8 }}
          renderItem={renderGridItem}
          columnWrapperStyle={cols > 1 ? { gap: gridGap, marginBottom: 10 } : undefined}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={7}
        />
      )}

      {!loading && !error && allowUpload ? (
        <View style={[styles.fabRow, { bottom: Math.max(insets.bottom, 8) + 20 }]} pointerEvents="box-none">
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
