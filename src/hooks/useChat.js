// Chat Hook for managing chat state and interactions
import { useState, useCallback, useEffect, useRef } from 'react';
import { sendChatMessage, generateWorkoutResponse } from '../services/ai/chatService';
import { saveApiKey, hasApiKey } from '../services/ai/apiKeyService';
import {
  getChatById,
  saveChat,
  updateChatMessages,
  setCurrentChatId,
  createNewChat,
} from '../services/ai/chatStorageService';

/**
 * Custom hook for managing chat state and OpenAI interactions
 * @param {string} chatId - Optional chat ID to load an existing chat
 * @returns {object} Chat state and functions
 */
export function useChat(chatId = null) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workoutResponse, setWorkoutResponse] = useState('');
  const [currentChatId, setCurrentChatIdState] = useState(null);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const saveTimeoutRef = useRef(null);
  const chatMessagesRef = useRef([]);
  const currentChatIdRef = useRef(null);
  const prevChatIdRef = useRef(chatId);

  /**
   * Load a chat from storage
   */
  const loadChat = useCallback(async (id) => {
    if (!id) {
      // No ID provided, clear chat
      console.log('🔄 Clearing chat - no ID provided');
      setCurrentChatIdState(null);
      currentChatIdRef.current = null;
      setChatMessages([]);
      chatMessagesRef.current = [];
      return;
    }

    console.log('📂 Loading chat:', id);
    setIsLoadingChat(true);
    try {
      const chat = await getChatById(id);
      console.log('📄 Chat found:', chat ? `Found chat with ${chat.messages?.length || 0} messages` : 'Chat not found');
      
      if (chat) {
        // Chat found - load its messages (could be empty array)
        const messages = Array.isArray(chat.messages) 
          ? chat.messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp || Date.now(),
            }))
          : [];
        
        console.log('💬 Loading messages:', messages.length, 'messages');
        console.log('📝 Messages:', messages.map(m => ({ role: m.role, content: m.content?.substring(0, 50) })));
        
        setChatMessages(messages);
        chatMessagesRef.current = messages;
        setCurrentChatIdState(id);
        currentChatIdRef.current = id;
        await setCurrentChatId(id); // Update current chat ID in storage
        console.log('✅ Chat loaded successfully');
      } else {
        // Chat not found - this shouldn't happen if chat was just created
        // But handle it gracefully
        console.error('❌ Chat not found:', id);
        setCurrentChatIdState(null);
        currentChatIdRef.current = null;
        setChatMessages([]);
        chatMessagesRef.current = [];
        setError('Chat not found. Please create a new chat.');
      }
    } catch (e) {
      console.error('❌ Error loading chat:', e);
      setError('Failed to load chat');
      setCurrentChatIdState(null);
      currentChatIdRef.current = null;
      setChatMessages([]);
      chatMessagesRef.current = [];
    } finally {
      setIsLoadingChat(false);
    }
  }, []);

  // Load chat when chatId prop changes
  useEffect(() => {
    const prevChatId = prevChatIdRef.current;
    
    console.log('🔄 ChatId prop changed:', { prevChatId, newChatId: chatId, currentChatId });
    
    // Always load if chatId is provided and different from current state
    // OR if chatId is provided but we don't have messages loaded
    if (chatId) {
      const needsLoad = prevChatId !== chatId || 
                       currentChatIdRef.current !== chatId ||
                       chatMessagesRef.current.length === 0;
      
      if (needsLoad) {
        console.log('📥 Loading chat from prop:', chatId, '(needsLoad:', needsLoad, ')');
        prevChatIdRef.current = chatId;
        loadChat(chatId);
      } else {
        console.log('⏭️ Skipping load - chat already loaded');
        prevChatIdRef.current = chatId;
      }
    } else if (chatId === null && prevChatId !== null) {
      // If chatId is explicitly null, clear current chat immediately
      console.log('🧹 Clearing chat - chatId is null');
      prevChatIdRef.current = null;
      setCurrentChatIdState(null);
      currentChatIdRef.current = null;
      setChatMessages([]);
      chatMessagesRef.current = [];
    }
  }, [chatId, loadChat, currentChatId]);

  // Keep refs in sync with state
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  // Auto-save chat when messages change (debounced)
  // Only save if we have a chatId and messages, and we're not currently loading a chat
  useEffect(() => {
    const chatIdToCheck = currentChatIdRef.current || currentChatId;
    const messagesToCheck = chatMessagesRef.current.length > 0 ? chatMessagesRef.current : chatMessages;
    
    // Don't auto-save while loading a chat (to avoid saving empty state)
    if (!isLoadingChat && chatIdToCheck && messagesToCheck.length > 0) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Debounce save by 1 second
      saveTimeoutRef.current = setTimeout(() => {
        saveChatToStorage();
      }, 1000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [chatMessages, currentChatId, saveChatToStorage, isLoadingChat]);

  // Save chat when component unmounts (on app exit or navigation away)
  useEffect(() => {
    return () => {
      // Clear any pending timeout and save immediately
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Save immediately on unmount using refs to get latest values
      const latestChatId = currentChatIdRef.current;
      const latestMessages = chatMessagesRef.current;
      if (latestChatId && latestMessages.length > 0) {
        // Use the latest values to save - call saveChatToStorage function
        // We can't call it directly in cleanup, so we'll use updateChatMessages
        updateChatMessages(latestChatId, latestMessages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp || Date.now(),
        }))).catch(err => {
          console.error('Error saving chat on unmount:', err);
        });
      }
    };
  }, []);


  /**
   * Save current chat to storage
   */
  const saveChatToStorage = useCallback(async () => {
    const chatIdToSave = currentChatIdRef.current || currentChatId;
    const messagesToSave = chatMessagesRef.current.length > 0 ? chatMessagesRef.current : chatMessages;
    
    if (!chatIdToSave || messagesToSave.length === 0) {
      return;
    }

    try {
      // Add timestamps to messages that don't have them
      const messagesWithTimestamps = messagesToSave.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || Date.now(),
      }));

      console.log('💾 Saving chat:', chatIdToSave, 'with', messagesWithTimestamps.length, 'messages');
      const success = await updateChatMessages(chatIdToSave, messagesWithTimestamps);
      if (success) {
        console.log('✅ Chat saved successfully');
      } else {
        console.error('❌ Failed to save chat');
      }
    } catch (e) {
      console.error('❌ Error saving chat:', e);
    }
  }, [currentChatId, chatMessages]);

  /**
   * Initialize a new chat
   */
  const initializeNewChat = useCallback(async () => {
    try {
      // Save current chat before creating new one (only if it has messages)
      if (currentChatIdRef.current && chatMessagesRef.current.length > 0) {
        try {
          await updateChatMessages(
            currentChatIdRef.current,
            chatMessagesRef.current.map(msg => ({
              ...msg,
              timestamp: msg.timestamp || Date.now(),
            }))
          );
        } catch (saveErr) {
          console.error('Error saving current chat before creating new one:', saveErr);
        }
      }
      
      // Create new chat
      const newChat = await createNewChat();
      const newChatId = newChat.id;
      
      // Clear state immediately (before updating refs to ensure UI updates)
      setChatMessages([]);
      chatMessagesRef.current = [];
      setChatInput('');
      setError(null);
      setCurrentChatIdState(newChatId);
      currentChatIdRef.current = newChatId;
      
      // Update storage
      await setCurrentChatId(newChatId);
      
      // Note: We don't update prevChatIdRef here because we want the effect to handle
      // the prop change when App.js updates currentChatId. However, since we've already
      // set the state, the effect won't cause any issues.
      
      return newChatId;
    } catch (e) {
      console.error('Error creating new chat:', e);
      setError('Failed to create new chat');
      return null;
    }
  }, []);

  /**
   * Send a chat message to the AI coach (with optional image)
   */
  const sendMessage = useCallback(async (message, apiKey = null, imageData = null) => {
    // Need either message or image
    if ((!message || !message.trim()) && !imageData) return;

    // Use ref to get the most up-to-date chatId (might be more recent than state)
    let activeChatId = currentChatIdRef.current || currentChatId;
    let currentMessages = chatMessagesRef.current.length > 0 ? chatMessagesRef.current : chatMessages;

    // Initialize new chat if no chatId
    if (!activeChatId) {
      const newChatId = await initializeNewChat();
      if (!newChatId) return;
      activeChatId = newChatId;
      currentMessages = [];
    }

    // Save API key if provided
    if (apiKey) {
      try {
        await saveApiKey(apiKey);
      } catch (e) {
        setError('Failed to save API key');
        return;
      }
    }

    // Check if API key is configured
    if (!hasApiKey()) {
      setError('OpenAI API key is missing. Please provide your API key.');
      return;
    }

    const userMessage = (message || '').trim();
    setChatInput('');
    setError(null);
    setIsLoading(true);

    // Prepare message for UI (store image URI for display)
    const imageUri = imageData?.uri || (typeof imageData === 'string' ? imageData : null);
    const userMessageForUI = imageUri
      ? { role: 'user', content: userMessage || '📷 [Image]', imageUri, timestamp: Date.now() }
      : { role: 'user', content: userMessage, timestamp: Date.now() };

    // Add user message to UI immediately
    const updatedMessages = [...currentMessages, userMessageForUI];
    setChatMessages(updatedMessages);
    chatMessagesRef.current = updatedMessages;

    try {
      // Pass imageData (with base64) to chatService, use current messages for context
      const res = await sendChatMessage(userMessage, currentMessages, { imageUri: imageData });
      const assistantMessage = { role: 'assistant', content: res.text || '(No response)', timestamp: Date.now() };
      const finalMessages = [...updatedMessages, assistantMessage];
      setChatMessages(finalMessages);
      chatMessagesRef.current = finalMessages;
    } catch (e) {
      const err = `Error: ${e?.message || 'Unknown error'}`;
      const errorMessage = { role: 'assistant', content: err, timestamp: Date.now() };
      const finalMessages = [...updatedMessages, errorMessage];
      setChatMessages(finalMessages);
      chatMessagesRef.current = finalMessages;
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [chatMessages, currentChatId, initializeNewChat]);

  /**
   * Generate a workout plan
   */
  const generateWorkout = useCallback(async (prompt = null, apiKey = null) => {
    // Save API key if provided
    if (apiKey) {
      try {
        await saveApiKey(apiKey);
      } catch (e) {
        setError('Failed to save API key');
        return;
      }
    }

    // Check if API key is configured
    if (!hasApiKey()) {
      setError('OpenAI API key is missing. Please provide your API key.');
      return;
    }

    const workoutPrompt =
      prompt ||
      "Build today's session. Goal: upper body strength. Time: 40 minutes. Equipment: adjustable dumbbells. Notes: mild shoulder impingement. Output: warm-up, main sets with reps/rest/RPE, finisher, cool-down.";

    setError(null);
    setIsLoading(true);

    try {
      const res = await generateWorkoutResponse(workoutPrompt);
      setWorkoutResponse(res.text || '(No response)');
    } catch (e) {
      const err = `Error: ${e?.message || 'Unknown error'}`;
      setWorkoutResponse(err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear chat messages (creates a new chat)
   */
  const clearChat = useCallback(async () => {
    await initializeNewChat();
    setError(null);
  }, [initializeNewChat]);

  /**
   * Reset workout response
   */
  const clearWorkout = useCallback(() => {
    setWorkoutResponse('');
    setError(null);
  }, []);

  /**
   * Switch to a different chat
   */
  const switchChat = useCallback(async (id) => {
    if (id === currentChatId) return;
    // Save current chat before switching
    await saveChatToStorage();
    setCurrentChatIdState(id);
  }, [currentChatId, saveChatToStorage]);

  return {
    // State
    chatMessages,
    chatInput,
    setChatInput,
    isLoading,
    isLoadingChat,
    error,
    workoutResponse,
    currentChatId,

    // Functions
    sendMessage,
    generateWorkout,
    clearChat,
    clearWorkout,
    initializeNewChat,
    switchChat,
    loadChat,
  };
}

