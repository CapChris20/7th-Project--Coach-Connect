import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

/**
 * Trainer AI Coach — pick which client's data to load into the coach prompt.
 */
export default function TrainerCoachClientBar({
  clients = [],
  selectedClientId,
  onSelectClient,
  isDark,
}) {
  if (!Array.isArray(clients) || clients.length === 0) {
    return (
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: isDark ? '#1c1c1e' : '#f2f2f7',
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#333' : '#e5e5ea',
        }}
      >
        <Text style={{ fontSize: 13, color: isDark ? '#aaa' : '#666' }}>
          Link a client to review their logs with AI Coach.
        </Text>
      </View>
    );
  }

  const bg = isDark ? '#1c1c1e' : '#f2f2f7';
  const chipBg = isDark ? '#2c2c2e' : '#fff';
  const chipActive = isDark ? '#3a3a3c' : '#e8f0fe';
  const text = isDark ? '#f2f2f7' : '#1c1c1e';
  const muted = isDark ? '#8e8e93' : '#636366';

  return (
    <View
      style={{
        paddingVertical: 10,
        backgroundColor: bg,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? '#333' : '#e5e5ea',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: muted, paddingHorizontal: 16, marginBottom: 8 }}>
        CLIENT DATA
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {clients.map((c) => {
          const id = c.id || c.uid || c.clientId;
          const name = c.name || c.displayName || 'Client';
          const active = id && id === selectedClientId;
          return (
            <TouchableOpacity
              key={id || name}
              onPress={() => onSelectClient?.(id)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: active ? chipActive : chipBg,
                borderWidth: 1,
                borderColor: active ? '#4a7dff' : isDark ? '#444' : '#ddd',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: text }}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
