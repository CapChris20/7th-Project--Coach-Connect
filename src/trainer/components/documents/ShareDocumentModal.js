/**
 * Share Document Modal
 *
 * Purpose: UI screen or component: Share Document Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: ShareDocumentModal
 *
 * @file-header
 */
/**
 * Share trainer document with clients. Toggles per client; saves sharedWith to Firestore.
 */

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
import { getTrainerClients } from '../../clients-list/loadTrainerClientRoster';
import { setDocumentSharedWith } from '../../../shared/notes-files/manageNotesAndFiles';

export default function ShareDocumentModal({
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
        const map = {};
        (initialSharedWith || []).forEach((id) => { map[id] = true; });
        setSelected(map);
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [visible, trainerId, documentId, initialSharedWith]);

  const handleToggle = (clientId, value) => {
    setSelected((prev) => ({ ...prev, [clientId]: value }));
  };

  const handleConfirm = async () => {
    if (!trainerId || !documentId) return;
    const clientIds = clients.filter((c) => selected[c.id]).map((c) => c.id);
    setSaving(true);
    try {
      await setDocumentSharedWith(trainerId, documentId, clientIds);
      onSaved?.();
      onClose();
    } catch (e) {
      console.warn('Share document error:', e);
    } finally {
      setSaving(false);
    }
  };

  // Helper to get initials for avatar
  const getInitials = (name) => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
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
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'flex-end',
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={{
            backgroundColor: '#0C0C14',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: '80%',
            paddingBottom: Platform.OS === 'ios' ? 34 : 24, // Adjust for iPhone X bottom safe area
          }}
          onStartShouldSetResponder={() => true} // Prevent closing when tapping inside the sheet
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
              Share with clients
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#FF6B9D" />
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false}>
                {clients.length === 0 ? (
                  <Text style={{ fontSize: 15, textAlign: 'center', color: 'rgba(255,255,255,0.5)', paddingVertical: 24 }}>
                    No clients yet.
                  </Text>
                ) : (
                  clients.map((client) => (
                    <View
                      key={client.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(255,255,255,0.05)',
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        {client.photoURL || client.profilePhoto ? (
                          <Image
                            source={{ uri: client.photoURL || client.profilePhoto }}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                          />
                        ) : (
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                            {getInitials(client.name || client.displayName)}
                          </Text>
                        )}
                      </View>
                      <Text style={{ flex: 1, fontSize: 15, color: '#fff' }} numberOfLines={1}>
                        {client.name || client.displayName || 'Client'}
                      </Text>
                      <Switch
                        value={!!selected[client.id]}
                        onValueChange={(v) => handleToggle(client.id, v)}
                        trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#FF6B9D' }}
                        thumbColor={'#fff'}
                      />
                    </View>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity
                onPress={handleConfirm}
                disabled={saving}
                style={{
                  backgroundColor: '#FF6B9D',
                  borderRadius: 12,
                  height: 50,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 20,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
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
