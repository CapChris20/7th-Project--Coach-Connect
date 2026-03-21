import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Modal,
  Image,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 2;
const CELL_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

function groupByMonth(photos) {
  const groups = {};
  photos.forEach((p) => {
    const d = p.date?.toDate ? p.date.toDate() : p.date instanceof Date ? p.date : new Date();
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!groups[key]) {
      groups[key] = { key, date: d, items: [] };
    }
    groups[key].items.push({ ...p, _dateObj: d });
  });
  return Object.values(groups).sort((a, b) => b.date - a.date);
}

export default function PhotoGalleryScreen({ route, navigation }) {
  const clientId = route?.params?.clientId;
  const clientName = route?.params?.clientName || 'Client';
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalIndex, setModalIndex] = useState(null);

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
      },
    );
    return () => unsub();
  }, [clientId]);

  const monthGroups = useMemo(() => groupByMonth(photos), [photos]);

  const countText = useMemo(() => {
    if (!photos.length) return 'No photos yet';
    const dates = photos
      .map((p) => (p.date?.toDate ? p.date.toDate() : p.date instanceof Date ? p.date : new Date()))
      .sort((a, b) => a - b);
    const first = dates[0];
    const last = dates[dates.length - 1];
    const months = (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1;
    const monthsStr = months === 1 ? '1 month' : `${months} months`;
    return `${photos.length} photo${photos.length === 1 ? '' : 's'} · ${monthsStr}`;
  }, [photos]);

  const handleAddPhoto = async () => {
    if (!clientId || !storage || !db) return;
    const user = auth?.currentUser;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to add progress pictures.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [ImagePicker.MediaType.Images],
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
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
  };

  const openPhoto = (flatIndex) => {
    setModalIndex(flatIndex);
  };

  const allPhotosFlat = useMemo(
    () =>
      monthGroups.reduce((acc, group) => {
        group.items.forEach((p) => acc.push(p));
        return acc;
      }, []),
    [monthGroups],
  );

  const closeModal = () => setModalIndex(null);

  const changeIndex = (delta) => {
    if (modalIndex == null || !allPhotosFlat.length) return;
    const next = (modalIndex + delta + allPhotosFlat.length) % allPhotosFlat.length;
    setModalIndex(next);
  };

  const handleDeleteCurrent = async () => {
    if (modalIndex == null) return;
    const photo = allPhotosFlat[modalIndex];
    if (!photo) return;
    Alert.alert('Delete photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (photo.storagePath && storage) {
              const storageRef = ref(storage, photo.storagePath);
              await deleteObject(storageRef);
            }
            if (db && clientId && photo.id) {
              const refDoc = doc(db, 'users', clientId, 'progressPhotos', photo.id);
              await deleteDoc(refDoc);
            }
            closeModal();
            load();
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
      await Share.share({
        message: 'Progress photo from CoachConnect',
        url: photoUrl,
      });
    } catch (e) {
      // no-op: share failures shouldn't break UX
    }
  };

  const renderPhotoItem = ({ item, index, groupIndex }) => {
    const flatIndex =
      monthGroups.slice(0, groupIndex).reduce((acc, g) => acc + g.items.length, 0) + index;
    const dateObj = item._dateObj || (item.date?.toDate ? item.date.toDate() : new Date());
    const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return (
      <TouchableOpacity
        style={{ width: CELL_WIDTH, height: CELL_WIDTH, marginBottom: GRID_GAP }}
        activeOpacity={0.9}
        onPress={() => openPhoto(flatIndex)}
      >
        <Image
          source={{ uri: item.url }}
          style={{ width: '100%', height: '100%', borderRadius: 10 }}
          resizeMode="cover"
        />
        <View
          style={{
            position: 'absolute',
            left: 6,
            bottom: 6,
            backgroundColor: 'rgba(0,0,0,0.4)',
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 4,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 10 }}>{label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMonthSection = ({ item, index }) => {
    const monthLabel = item.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return (
      <View key={item.key} style={{ marginBottom: 16 }}>
        <Text
          style={{
            paddingHorizontal: GRID_PADDING,
            paddingVertical: 8,
            fontSize: 11,
            fontWeight: '700',
            color: 'rgba(148,163,184,0.9)',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {monthLabel}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: GRID_GAP,
            paddingHorizontal: GRID_PADDING,
          }}
        >
          {item.items.map((photo, idx) => (
            <View key={photo.id || photo.storagePath || photo.url || `${item.key}-${idx}`}>
              {renderPhotoItem({ item: photo, index: idx, groupIndex: index })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const current = modalIndex != null ? allPhotosFlat[modalIndex] : null;
  const currentDate =
    current &&
    (current._dateObj ||
      (current.date?.toDate ? current.date.toDate() : current.date instanceof Date ? current.date : new Date()));
  const currentDateLabel =
    currentDate && currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(148,163,184,0.25)',
        }}
      >
        <TouchableOpacity onPress={() => navigation?.goBack()} hitSlop={12} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color="#F9FAFB" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#F9FAFB' }}>Progress Photos</Text>
          <Text style={{ fontSize: 12, color: 'rgba(148,163,184,0.9)', marginTop: 2 }}>
            {clientName} · {countText}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleAddPhoto}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,107,157,0.5)',
            backgroundColor: 'rgba(255,107,157,0.12)',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="camera-outline" size={15} color="#FF6B9D" />
          <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: '700', color: '#FF6B9D' }}>Add Photo</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      )}

      {error && !loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#F97373', textAlign: 'center', marginBottom: 12 }}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setError(null);
              setLoading(true);
            }}
            style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FF6B9D' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && monthGroups.length === 0 && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Ionicons name="images-outline" size={48} color="rgba(148,163,184,0.7)" />
          <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '700', color: '#F9FAFB' }}>
            No progress photos yet
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: 13,
              color: 'rgba(148,163,184,0.9)',
              textAlign: 'center',
            }}
          >
            Tap the camera button to add the first one.
          </Text>
        </View>
      )}

      {!loading && !error && monthGroups.length > 0 && (
        <FlatList
          data={monthGroups}
          keyExtractor={(item) => item.key}
          renderItem={renderMonthSection}
        />
      )}

      <Modal visible={modalIndex != null} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.97)' }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              paddingTop: 40,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
              {currentDateLabel || ''}
            </Text>
            <TouchableOpacity onPress={closeModal} hitSlop={12}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {current?.url && (
              <Image
                source={{ uri: current.url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            )}
          </View>

          {allPhotosFlat.length > 1 && (
            <>
              <TouchableOpacity
                onPress={() => changeIndex(-1)}
                style={{
                  position: 'absolute',
                  left: 16,
                  top: '50%',
                  marginTop: -20,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => changeIndex(1)}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  marginTop: -20,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: 'rgba(0,0,0,0.6)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <TouchableOpacity hitSlop={12} onPress={() => handleShare(current?.url)}>
                <Ionicons name="share-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={12} onPress={handleDeleteCurrent}>
                <Ionicons name="trash-outline" size={22} color="rgba(248,113,113,0.9)" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: 'rgba(209,213,219,0.9)', fontSize: 13 }}>
              {allPhotosFlat.length > 0 && modalIndex != null ? `${modalIndex + 1} of ${allPhotosFlat.length}` : ''}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

