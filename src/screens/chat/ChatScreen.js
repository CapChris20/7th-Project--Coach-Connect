import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../hooks/useChat';
import { hasApiKey } from '../../services/ai/apiKeyService';
import ApiKeyInput from '../../components/ai/ApiKeyInput';
import { pickImage } from '../../services/ai/imageService';

export default function ChatScreen({ onClose, chatId = null, onBackToChatList = null, onNewChatCreated = null }) {
  const { colors, spacing, isDark } = useTheme();
  const {
    chatMessages,
    chatInput,
    setChatInput,
    isLoading,
    isLoadingChat,
    error,
    sendMessage,
    clearChat,
    initializeNewChat,
    currentChatId,
  } = useChat(chatId);
  
  const [typingDots, setTypingDots] = useState('');

  useEffect(() => {
    if (!isLoading) {
      setTypingDots('');
      return;
    }
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % 4;
      setTypingDots('.'.repeat(idx));
    }, 400);
    return () => clearInterval(timer);
  }, [isLoading]);

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
        ? 'rgba(139, 92, 246, 0.15)' 
        : 'rgba(139, 92, 246, 0.1)',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.5,
      textShadowColor: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.1)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    closeButton: {
      padding: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 16,
      backgroundColor: isDark 
        ? 'rgba(139, 92, 246, 0.15)' 
        : 'rgba(139, 92, 246, 0.1)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.3)' 
        : 'rgba(139, 92, 246, 0.2)',
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
    chatList: {
      flex: 1,
      padding: spacing.md,
    },
    chatBubbleUser: {
      alignSelf: 'flex-end',
      backgroundColor: isDark 
        ? 'rgba(139, 92, 246, 0.4)' 
        : colors.primary,
      paddingHorizontal: spacing.md + 4,
      paddingVertical: spacing.sm + 4,
      borderRadius: 20,
      maxWidth: '85%',
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.5)' 
        : 'rgba(255, 255, 255, 0.2)',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    chatBubbleAssistant: {
      alignSelf: 'flex-start',
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.6)' 
        : 'rgba(255, 255, 255, 0.8)',
      paddingHorizontal: spacing.md + 4,
      paddingVertical: spacing.sm + 4,
      borderRadius: 20,
      maxWidth: '85%',
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.2)' 
        : 'rgba(139, 92, 246, 0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    chatBubbleText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
    },
    chatImage: {
      width: 200,
      height: 200,
      borderRadius: 16,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.3)' 
        : 'rgba(139, 92, 246, 0.2)',
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing.md,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.7)' 
        : 'rgba(255, 255, 255, 0.7)',
      borderTopWidth: 1,
      borderTopColor: isDark 
        ? 'rgba(139, 92, 246, 0.15)' 
        : 'rgba(139, 92, 246, 0.1)',
      gap: spacing.sm,
    },
    imageButton: {
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: isDark 
        ? 'rgba(139, 92, 246, 0.15)' 
        : 'rgba(139, 92, 246, 0.1)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.3)' 
        : 'rgba(139, 92, 246, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
    chatInput: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md + 4,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.25)' 
        : 'rgba(139, 92, 246, 0.2)',
      color: colors.text,
      backgroundColor: isDark 
        ? 'rgba(139, 92, 246, 0.1)' 
        : 'rgba(255, 255, 255, 0.9)',
      fontSize: 15,
      maxHeight: 100,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    chatSend: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 20,
      marginLeft: spacing.sm,
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
    chatSendText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 15,
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
  });

  const handleSend = async () => {
    const content = chatInput.trim();
    if ((!content && !selectedImage) || isLoading) return;
    await sendMessage(content, null, selectedImage);
    setSelectedImage(null);
  };

  const handlePickImage = async () => {
    try {
      const image = await pickImage();
      if (image) {
        setSelectedImage(image);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const [selectedImage, setSelectedImage] = useState(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AI Coach</Text>
          {isLoadingChat && (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              Loading...
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {onBackToChatList && (
            <TouchableOpacity
              onPress={onBackToChatList}
              style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : colors.purple[50] }]}
            >
              <Text style={[styles.closeButtonText, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={async () => {
              // Create new chat and notify parent
              const newChatId = await initializeNewChat();
              if (newChatId && onNewChatCreated) {
                onNewChatCreated(newChatId);
              }
            }}
            style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : colors.purple[50] }]}
          >
            <Text style={[styles.closeButtonText, { color: colors.primary }]}>New</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* API Key Input if needed */}
      {!hasApiKey() && (
        <View style={{ padding: spacing.md }}>
          <ApiKeyInput />
        </View>
      )}

      {/* Chat Messages */}
      {isLoadingChat ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>Loading chat...</Text>
        </View>
      ) : (
        <FlatList
          data={chatMessages}
          keyExtractor={(item, index) => `message-${index}-${item.timestamp || Date.now()}-${item.imageUri || ''}`}
          style={styles.chatList}
          contentContainerStyle={
            chatMessages.length === 0 
              ? { flex: 1, justifyContent: 'center', alignItems: 'center' }
              : { paddingBottom: spacing.md }
          }
          renderItem={({ item }) => (
            <View style={item.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant}>
              {item.imageUri && (
                <Image
                  source={{ uri: item.imageUri }}
                  style={styles.chatImage}
                  resizeMode="cover"
                />
              )}
              {item.content && (
                <Text style={styles.chatBubbleText}>{item.content}</Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            chatMessages.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xxl }}>
                <Text style={{ fontSize: 48, marginBottom: spacing.md }}>💬</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs }}>
                  Start a conversation
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg }}>
                  Ask your AI fitness coach anything about workouts, nutrition, or fitness goals!
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Typing Indicator */}
      {isLoading && (
        <View style={styles.chatBubbleAssistant}>
          <Text style={styles.chatBubbleText}>
            ANATROX is typing{typingDots}
          </Text>
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          {/* Image picker button */}
          <TouchableOpacity
            onPress={handlePickImage}
            style={styles.imageButton}
            disabled={isLoading || !hasApiKey()}
          >
            <Text style={{ fontSize: 20 }}>📷</Text>
          </TouchableOpacity>

          {/* Selected image preview */}
          {selectedImage && (
            <View style={{ marginBottom: spacing.xs }}>
              <Image
                source={{ uri: selectedImage.uri }}
                style={{ width: 40, height: 40, borderRadius: 8 }}
                resizeMode="cover"
              />
            </View>
          )}

          <TextInput
            value={chatInput}
            onChangeText={setChatInput}
            placeholder={selectedImage ? "Ask about this image…" : "Ask your fitness coach anything…"}
            placeholderTextColor={colors.textSecondary}
            style={styles.chatInput}
            autoCapitalize="sentences"
            autoCorrect={true}
            editable={!isLoading && hasApiKey()}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSend}
            style={styles.chatSend}
            disabled={isLoading || (!chatInput.trim() && !selectedImage) || !hasApiKey()}
          >
            <Text style={styles.chatSendText}>{isLoading ? '...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
