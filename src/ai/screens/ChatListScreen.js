import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../shared/ui/ThemeContext';
import { getAllChats, deleteChat, getCurrentChatId } from '../services/chatStorageService';
import Loader from '../../Loader';

export default function ChatListScreen({ onClose, onSelectChat, onCreateNewChat }) {
  const { colors, typography, spacing, isDark } = useTheme();
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentChatId, setCurrentChatId] = useState(null);

  // Load chats from storage
  const loadChats = useCallback(async () => {
    setIsLoading(true);
    try {
      const allChats = await getAllChats();
      setChats(allChats);
      const currentId = await getCurrentChatId();
      setCurrentChatId(currentId);
    } catch (error) {
      if (__DEV__) console.error('Error loading chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
    
    // Set up real-time listener for chat storage changes
    const interval = setInterval(loadChats, 1000);
    return () => clearInterval(interval);
  }, [loadChats]);

  // Format timestamp to readable date
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Get preview of last message
  const getLastMessagePreview = (chat) => {
    if (!chat.messages || chat.messages.length === 0) {
      return 'New conversation';
    }
    const lastMessage = chat.messages[chat.messages.length - 1];
    if (lastMessage.imageUri) {
      return '📷 Image';
    }
    return lastMessage.content.slice(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
  };

  // Handle chat selection
  const handleSelectChat = (chatId) => {
    if (onSelectChat) {
      onSelectChat(chatId);
    }
  };

  // Handle new chat creation
  const handleNewChat = () => {
    if (onCreateNewChat) {
      onCreateNewChat();
    }
  };

  // Handle chat deletion
  const handleDeleteChat = (chatId, chatTitle) => {
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${chatTitle}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChat(chatId);
              loadChats();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete chat. Please try again.');
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md + 8,
      paddingBottom: spacing.md,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.7)' 
        : 'rgba(255, 255, 255, 0.7)',
      borderBottomWidth: 1,
      borderBottomColor: isDark 
        ? 'rgba(88, 86, 214, 0.15)' 
        : 'rgba(88, 86, 214, 0.1)',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.5,
      textShadowColor: isDark ? 'rgba(88, 86, 214, 0.3)' : 'rgba(88, 86, 214, 0.1)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    headerActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    newChatButton: {
      padding: spacing.sm + 2,
      paddingHorizontal: spacing.md + 4,
      borderRadius: 16,
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(255, 255, 255, 0.2)' 
        : 'rgba(255, 255, 255, 0.3)',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    newChatButtonText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 14,
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    closeButton: {
      padding: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 16,
      backgroundColor: isDark 
        ? 'rgba(88, 86, 214, 0.15)' 
        : 'rgba(88, 86, 214, 0.1)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(88, 86, 214, 0.3)' 
        : 'rgba(88, 86, 214, 0.2)',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '700',
    },
    content: {
      flex: 1,
    },
    chatItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md + 4,
      paddingHorizontal: spacing.lg,
      marginHorizontal: spacing.md,
      marginVertical: spacing.xs,
      borderRadius: 20,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.5)' 
        : 'rgba(255, 255, 255, 0.6)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(88, 86, 214, 0.15)' 
        : 'rgba(88, 86, 214, 0.1)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    chatItemActive: {
      backgroundColor: isDark 
        ? 'rgba(88, 86, 214, 0.25)' 
        : 'rgba(88, 86, 214, 0.15)',
      borderColor: isDark 
        ? 'rgba(88, 86, 214, 0.4)' 
        : 'rgba(88, 86, 214, 0.3)',
      shadowColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    chatContent: {
      flex: 1,
      marginRight: spacing.md,
    },
    chatTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.xs,
      letterSpacing: 0.2,
    },
    chatPreview: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      lineHeight: 20,
    },
    chatDate: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chatActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    deleteButton: {
      padding: spacing.sm,
      borderRadius: 12,
      backgroundColor: isDark 
        ? 'rgba(239, 68, 68, 0.15)' 
        : 'rgba(239, 68, 68, 0.1)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(239, 68, 68, 0.3)' 
        : 'rgba(239, 68, 68, 0.2)',
    },
    deleteButtonText: {
      fontSize: 18,
      color: colors.error || '#ef4444',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },
    emptyStateIcon: {
      fontSize: 64,
      marginBottom: spacing.md,
    },
    emptyStateText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  const renderChatItem = ({ item }) => {
    const isActive = item.id === currentChatId;
    return (
      <TouchableOpacity
        style={[styles.chatItem, isActive && styles.chatItemActive]}
        onPress={() => handleSelectChat(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.chatContent}>
          <Text style={styles.chatTitle} numberOfLines={1} selectable={true}>
            {item.title || 'New Chat'}
          </Text>
          <Text style={styles.chatPreview} numberOfLines={1} selectable={true}>
            {getLastMessagePreview(item)}
          </Text>
          <Text style={styles.chatDate} selectable={true}>
            {formatDate(item.updatedAt || item.createdAt)}
          </Text>
        </View>
        <View style={styles.chatActions}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteChat(item.id, item.title)}
          >
            <Text style={styles.deleteButtonText} selectable={true}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} selectable={true}>Chat History</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
            <Text style={styles.newChatButtonText} selectable={true}>+ New</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText} selectable={true}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chat List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Loader />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon} selectable={true}>💬</Text>
          <Text style={styles.emptyStateText} selectable={true}>
            No conversations yet.{'\n'}Start a new chat to get started!
          </Text>
          <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
            <Text style={styles.newChatButtonText} selectable={true}>Start New Chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={{ paddingBottom: spacing.md }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
