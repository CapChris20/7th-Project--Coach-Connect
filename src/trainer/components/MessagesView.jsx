import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { auth, db } from '../../app/config';
import { getTrainerClients } from '../services/clientCRMService';
import { collection, query, where, getDocs, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

export default function MessagesView({ clientId }) {
  const [messages, setMessages] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(clientId || null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // Load clients from trainer_clients subcollection
  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoading(true);
        const trainerId = auth.currentUser?.uid;
        if (!trainerId) return;

        // Get clients from trainer_clients subcollection (CRM system)
        const clientsList = await getTrainerClients(trainerId);
        setClients(clientsList);
        
        // Auto-select the provided clientId, or first client
        if (clientId && clientsList.find(c => c.id === clientId)) {
          setSelectedClient(clientId);
        } else if (clientsList.length > 0) {
          setSelectedClient(clientsList[0].id);
        }
      } catch (error) {
        console.error('Error loading clients:', error);
      } finally {
        setLoading(false);
      }
    };

    loadClients();
  }, [clientId]);

  // Load messages for selected client
  useEffect(() => {
    if (!selectedClient || !auth.currentUser?.uid) return;

    const trainerId = auth.currentUser.uid;
    
    // Create combined UID for messages path: trainerId_clientId
    const combinedUid = [trainerId, selectedClient].sort().join('_');
    const messagesRef = collection(db, `messages/${combinedUid}/messages`);
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesList = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        messagesList.push({
          id: doc.id,
          sender: data.senderUid === trainerId ? 'You' : 'Client',
          content: data.text || data.content || '',
          time: data.timestamp?.toDate ? formatTime(data.timestamp.toDate()) : 'Recently',
          unread: data.read === false && data.senderUid !== trainerId,
        });
      });
      setMessages(messagesList.reverse()); // Reverse to show oldest first
    }, (error) => {
      console.error('Error loading messages:', error);
    });

    return () => unsubscribe();
  }, [selectedClient]);

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedClient || !auth.currentUser?.uid) return;

    try {
      const trainerId = auth.currentUser.uid;
      const combinedUid = [trainerId, selectedClient].sort().join('_');
      const messagesRef = collection(db, `messages/${combinedUid}/messages`);
      
      await addDoc(messagesRef, {
        senderUid: trainerId,
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        read: false,
      });
      
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const selectedClientData = clients.find(c => c.id === selectedClient);

  return (
    <View style={styles.container}>
      {/* Messages Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.headerActions}>
          {selectedClientData && (
            <Text style={styles.selectedClient}>
              {selectedClientData.name || 'Client'}
            </Text>
          )}
        </View>
      </View>

      {/* Client Selector */}
      {clients.length > 1 && (
        <ScrollView horizontal style={styles.clientSelector} showsHorizontalScrollIndicator={false}>
          {clients.map((client) => (
            <TouchableOpacity
              key={client.id}
              style={[
                styles.clientChip,
                selectedClient === client.id && styles.selectedClientChip
              ]}
              onPress={() => setSelectedClient(client.id)}
            >
              <Text style={[
                styles.clientChipText,
                selectedClient === client.id && styles.selectedClientChipText
              ]}>
                {client.name || 'Client'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.loadingText}>Loading clients...</Text>
        </View>
      ) : (
        <>
          {/* Messages List */}
          <ScrollView style={styles.messagesList}>
            {clients.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyTitle}>No clients yet</Text>
                <Text style={styles.emptySubtitle}>Add clients to start messaging</Text>
              </View>
            ) : !selectedClient ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👤</Text>
                <Text style={styles.emptyTitle}>Select a client</Text>
                <Text style={styles.emptySubtitle}>Choose a client to start messaging</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start a conversation with {selectedClientData?.name || 'your client'}
                </Text>
              </View>
            ) : (
              messages.map((message) => (
                <View key={message.id} style={styles.messageCard}>
                  <View style={styles.messageContent}>
                    <View style={styles.messageHeader}>
                      <Text style={styles.senderName}>{message.sender}</Text>
                      <Text style={styles.messageTime}>{message.time}</Text>
                    </View>
                    <Text style={styles.messageText}>{message.content}</Text>
                  </View>
                  {message.unread && <View style={styles.unreadDot} />}
                </View>
              ))
            )}
          </ScrollView>

          {/* Message Input */}
          {selectedClient && (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder={`Message ${selectedClientData?.name || 'client'}...`}
                placeholderTextColor="#8E8E93"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedClient: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A84FF',
  },
  clientSelector: {
    marginBottom: 20,
  },
  clientChip: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  selectedClientChip: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
  },
  clientChipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedClientChipText: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  messagesList: {
    flex: 1,
    marginBottom: 20,
  },
  messageCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  messageText: {
    fontSize: 14,
    color: '#C7C7CC',
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    backgroundColor: '#0A84FF',
    borderRadius: 4,
    marginLeft: 12,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#0A84FF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
