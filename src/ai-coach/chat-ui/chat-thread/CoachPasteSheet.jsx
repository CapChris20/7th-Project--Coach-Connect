/**
 * Coach Paste Sheet
 *
 * Purpose: UI screen or component: Coach Paste Sheet. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: CoachPasteSheet
 *
 * @file-header
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

/**
 * Dedicated paste surface — avoids stale Simulator clipboard reads.
 */
export default function CoachPasteSheet({ visible, onClose, onConfirm, t, isDark = true }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setDraft('');
      return;
    }
    const tmr = setTimeout(() => inputRef.current?.focus?.(), 120);
    return () => clearTimeout(tmr);
  }, [visible]);

  const textPrimary = t?.textPrimary || (isDark ? '#FFFFFF' : '#0A0A0F');
  const textMuted = t?.textMuted || (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)');
  const bg = isDark ? '#141418' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          backgroundColor: bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          borderTopWidth: 1,
          borderColor: border,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '800', color: textPrimary, marginBottom: 6 }}>
          Paste text
        </Text>
        <Text style={{ fontSize: 13, color: textMuted, marginBottom: 14 }}>
          Copy on your Mac, then paste here (⌘V).
        </Text>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder="Paste your message…"
          placeholderTextColor={textMuted}
          style={{
            minHeight: 100,
            maxHeight: 180,
            borderWidth: 1,
            borderColor: border,
            borderRadius: 14,
            padding: 14,
            color: textPrimary,
            fontSize: 15,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          }}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            onPress={onClose}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: border,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: textPrimary, fontWeight: '700' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onConfirm?.(draft)}
            disabled={!String(draft || '').trim()}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 14,
              backgroundColor: '#FF6B9D',
              alignItems: 'center',
              opacity: String(draft || '').trim() ? 1 : 0.45,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Add to message</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
