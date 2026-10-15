// Share a trainer document with clients. Each row is a toggle; Confirm writes sharedWith to Firestore.
// Flow: open → load this trainer's clients → seed switches from initialSharedWith → Save Sharing Settings.
// Used by: the trainer document editor's share action.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Switch,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTrainerClients } from '../my-trainees/traineeList';
import { setDocumentSharedWith } from '../../for-both/files-and-notes/saveNotesAndFiles';

// ===== NAMED CONSTANTS =====

const CLIENT_NAME_DEFAULT = 'Client';
const SHEET_BACKGROUND = '#0C0C14';
const ACCENT_PINK = '#FF6B9D';
const WHITE = '#fff';
const MUTED_WHITE = 'rgba(255,255,255,0.5)';
const ROW_BORDER = 'rgba(255,255,255,0.05)';
const AVATAR_BACKGROUND = 'rgba(255,255,255,0.1)';
const SWITCH_TRACK_OFF = 'rgba(255,255,255,0.1)';
const OVERLAY_SCRIM = 'rgba(0,0,0,0.6)';

const IOS_PLATFORM = 'ios';
const IOS_SHEET_BOTTOM_PADDING = 34;
const ANDROID_SHEET_BOTTOM_PADDING = 24;

// ===== HELPER FUNCTIONS =====

function sheetBottomPadding() {
  if (Platform.OS === IOS_PLATFORM) return IOS_SHEET_BOTTOM_PADDING;
  return ANDROID_SHEET_BOTTOM_PADDING;
}

function selectedMapFromIds(initialSharedWith) {
  const selectedById = {};
  (initialSharedWith || []).forEach((id) => {
    selectedById[id] = true;
  });
  return selectedById;
}

function initialsFromName(name) {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length > 1) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

function clientDisplayName(client) {
  return client.name || client.displayName || CLIENT_NAME_DEFAULT;
}

function clientPhotoUri(client) {
  return client.photoURL || client.profilePhoto;
}

function selectedClientIds(clients, selected) {
  return clients.filter((client) => selected[client.id]).map((client) => client.id);
}

async function saveSharingSettings({ trainerId, documentId, clientIds, onSaved, onClose, setSaving }) {
  if (!trainerId || !documentId) return;
  setSaving(true);
  try {
    await setDocumentSharedWith(trainerId, documentId, clientIds);
    onSaved?.();
    onClose();
  } catch (error) {
    console.warn('Share document error:', error);
  } finally {
    setSaving(false);
  }
}

function ClientAvatar({ client }) {
  const photoUri = clientPhotoUri(client);
  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={{ width: 40, height: 40, borderRadius: 20 }}
      />
    );
  }
  return (
    <Text style={{ color: WHITE, fontSize: 16, fontWeight: 'bold' }}>
      {initialsFromName(client.name || client.displayName)}
    </Text>
  );
}

function ClientShareRow({ client, isSelected, onToggle }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: ROW_BORDER,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: AVATAR_BACKGROUND,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <ClientAvatar client={client} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: WHITE }} numberOfLines={1}>
        {clientDisplayName(client)}
      </Text>
      <Switch
        value={isSelected}
        onValueChange={(nextValue) => onToggle(client.id, nextValue)}
        trackColor={{ false: SWITCH_TRACK_OFF, true: ACCENT_PINK }}
        thumbColor={WHITE}
      />
    </View>
  );
}

function EmptyClientsMessage() {
  return (
    <Text style={{ fontSize: 15, textAlign: 'center', color: MUTED_WHITE, paddingVertical: 24 }}>
      No clients yet.
    </Text>
  );
}

function ShareClientList({ clients, selected, onToggle }) {
  if (clients.length === 0) return <EmptyClientsMessage />;
  return clients.map((client) => (
    <ClientShareRow
      key={client.id}
      client={client}
      isSelected={!!selected[client.id]}
      onToggle={onToggle}
    />
  ));
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet to choose which clients can see a trainer document.
 * @param {object} props
 */
export default function ShareDocumentPopup({
  visible,
  onClose,
  trainerId,
  documentId,
  initialSharedWith = [],
  isDark = true,
  onSaved,
}) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (!visible || !trainerId) {
      setClients([]);
      setSelected({});
      return;
    }
    setLoading(true);
    getTrainerClients(trainerId)
      .then((list) => {
        setClients(list || []);
        setSelected(selectedMapFromIds(initialSharedWith));
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [visible, trainerId, documentId, initialSharedWith]);

  const handleToggle = (clientId, value) => {
    setSelected((previousSelected) => ({ ...previousSelected, [clientId]: value }));
  };

  const handleConfirm = async () => {
    await saveSharingSettings({
      trainerId,
      documentId,
      clientIds: selectedClientIds(clients, selected),
      onSaved,
      onClose,
      setSaving,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: OVERLAY_SCRIM,
          justifyContent: 'flex-end',
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={{
            backgroundColor: SHEET_BACKGROUND,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: '80%',
            paddingBottom: sheetBottomPadding(),
          }}
          onStartShouldSetResponder={() => true}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: WHITE }}>
              Share with clients
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={MUTED_WHITE} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={ACCENT_PINK} />
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false}>
                <ShareClientList clients={clients} selected={selected} onToggle={handleToggle} />
              </ScrollView>
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={saving}
                style={{
                  backgroundColor: ACCENT_PINK,
                  borderRadius: 12,
                  height: 50,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 20,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={WHITE} />
                ) : (
                  <Text style={{ color: WHITE, fontSize: 16, fontWeight: 'bold' }}>
                    Save Sharing Settings
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
