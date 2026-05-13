import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';
import { useChat } from '../../shared/hooks/useChat';
import { hasApiKey } from '../services/apiKeyService';
import ApiKeyInput from '../components/ApiKeyInput';
import { pickImage } from '../services/imageService';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    isSearchingWeb,
  } = useChat(chatId);
  
  const [typingDots, setTypingDots] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recordingRef = useRef(null);
  const openaiKeyRef = useRef(null);
  const soundRef = useRef(null);

  // Load API key
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        const key = await AsyncStorage.getItem('OPENAI_API_KEY');
        if (key) {
          openaiKeyRef.current = key;
        } else {
          const configKey = Constants.expoConfig?.extra?.openaiApiKey;
          // Skip if it's a literal string like "process.env..." (invalid placeholder)
          const isValidConfigKey = configKey && !configKey.startsWith('process.env') && configKey.trim().length > 0;
          const envKey = (isValidConfigKey ? configKey : null) || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
          if (envKey) {
            openaiKeyRef.current = envKey;
          }
        }
      } catch (err) {
        console.error('Error loading API key:', err);
      }
    };
    loadApiKey();
  }, []);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      Speech.stop();
    };
  }, []);

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
    chatList: {
      flex: 1,
      padding: spacing.md,
    },
    chatBubbleUser: {
      alignSelf: 'flex-end',
      backgroundColor: isDark 
        ? 'rgba(88, 86, 214, 0.4)' 
        : colors.primary,
      paddingHorizontal: spacing.md + 4,
      paddingVertical: spacing.sm + 4,
      borderRadius: 20,
      maxWidth: '85%',
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(88, 86, 214, 0.5)' 
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
        ? 'rgba(88, 86, 214, 0.2)' 
        : 'rgba(88, 86, 214, 0.15)',
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
      userSelect: 'text',
    },
    chatImage: {
      width: 200,
      height: 200,
      borderRadius: 16,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(88, 86, 214, 0.3)' 
        : 'rgba(88, 86, 214, 0.2)',
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
        ? 'rgba(88, 86, 214, 0.15)' 
        : 'rgba(88, 86, 214, 0.1)',
      gap: spacing.sm,
    },
    imageButton: {
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: isDark 
        ? 'rgba(88, 86, 214, 0.15)' 
        : 'rgba(88, 86, 214, 0.1)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(88, 86, 214, 0.3)' 
        : 'rgba(88, 86, 214, 0.2)',
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
        ? 'rgba(88, 86, 214, 0.25)' 
        : 'rgba(88, 86, 214, 0.2)',
      color: colors.text,
      backgroundColor: isDark 
        ? 'rgba(88, 86, 214, 0.1)' 
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

  // Voice recording functions
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone permission is required for voice input.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;
      
      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      // Transcribe audio
      setIsTranscribing(true);
      const transcript = await transcribeAudio(uri);
      setIsTranscribing(false);

      if (transcript) {
        setChatInput(transcript);
        // Auto-send after transcription
        await sendMessage(transcript, null, selectedImage);
        setSelectedImage(null);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setIsTranscribing(false);
      Alert.alert('Error', 'Failed to process recording. Please try again.');
    }
  };

  const transcribeAudio = async (audioUri) => {
    if (!openaiKeyRef.current) {
      Alert.alert('API Key Required', 'Please set your OpenAI API key in settings.');
      return null;
    }

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      });
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKeyRef.current}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper API failed: ${response.status}`);
      }

      const data = await response.json();
      return data.text || '';
    } catch (err) {
      console.error('Transcription error:', err);
      throw err;
    }
  };

  // Text-to-speech function
  const speakResponse = async (text) => {
    try {
      if (isSpeaking) {
        Speech.stop();
        setIsSpeaking(false);
        return;
      }

      setIsSpeaking(true);
      await Speech.speak(text, {
        language: 'en',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (err) {
      console.error('TTS error:', err);
      setIsSpeaking(false);
    }
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
          <Text style={styles.headerTitle} selectable={true}>AI Coach</Text>
          {isLoadingChat && (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }} selectable={true}>
              Loading...
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {onBackToChatList && (
            <TouchableOpacity
              onPress={onBackToChatList}
              style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(88, 86, 214, 0.15)' : colors.purple[50] }]}
            >
              <Text style={[styles.closeButtonText, { color: colors.primary }]} selectable={true}>← Back</Text>
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
            style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(88, 86, 214, 0.15)' : colors.purple[50] }]}
          >
            <Text style={[styles.closeButtonText, { color: colors.primary }]} selectable={true}>New</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText} selectable={true}>Close</Text>
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
          <Text style={{ color: colors.textSecondary }} selectable={true}>Loading chat...</Text>
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
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Text 
                     style={styles.chatBubbleText} 
                    selectable={true}
                    textBreakStrategy="simple"
                  >
                    {item.content}
                  </Text>
                  {item.role === 'assistant' && (
                    <TouchableOpacity
                      onPress={() => speakResponse(item.content)}
                      style={{ padding: 4 }}
                    >
                      <Ionicons 
                        name={isSpeaking ? 'stop-circle' : 'volume-high'} 
                        size={20} 
                        color={isDark ? 'rgba(88, 86, 214, 0.8)' : colors.primary} 
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            chatMessages.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xxl }}>
                <Text style={{ fontSize: 48, marginBottom: spacing.md }} selectable={true}>💬</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs }} selectable={true}>
                  Start a conversation
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg }} selectable={true}>
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
          <Text style={styles.chatBubbleText} selectable={false}>
            {isSearchingWeb ? `Currently on the web${typingDots}` : `CoachConnect is typing${typingDots}`}
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
            <Text style={{ fontSize: 20 }} selectable={true}>📷</Text>
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
            contextMenuHidden={false}
            selectTextOnFocus={false}
            textContentType="none"
          />
          <TouchableOpacity
            onPress={handleSend}
            style={styles.chatSend}
            disabled={isLoading || (!chatInput.trim() && !selectedImage) || !hasApiKey()}
          >
            <Text style={styles.chatSendText} selectable={true}>{isLoading ? '...' : 'Send'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
