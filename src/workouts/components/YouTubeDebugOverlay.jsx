import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={3}>
        {String(value ?? '')}
      </Text>
    </View>
  );
}

export function YouTubeDebugOverlay({ recommendedDebugInfo, searchDebugInfo }) {
  const [visible, setVisible] = useState(false);

  const rec = useMemo(() => recommendedDebugInfo || {}, [recommendedDebugInfo]);
  const sea = useMemo(() => searchDebugInfo || {}, [searchDebugInfo]);

  if (typeof __DEV__ !== 'undefined' && !__DEV__) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setVisible(true)}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel="Open YouTube debug overlay"
      >
        <Text style={styles.fabText}>🐛</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.title}>YouTube Debug Info</Text>
              <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn} activeOpacity={0.9}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.box, { borderLeftColor: '#FF6B9D' }]}>
              <Text style={styles.boxTitle}>RECOMMENDED</Text>
              <Row label="Query" value={rec.query || 'N/A'} />
              <Row label="Results" value={rec.resultCount ?? 0} />
              <Row label="Source" value={rec.apiSource || 'unknown'} />
              <Row label="Cache hit" value={rec.cacheHit ? 'Yes' : 'No'} />
              <Row label="Time" value={rec.timestamp || 'N/A'} />
            </View>

            <View style={[styles.box, { borderLeftColor: '#64D2FF' }]}>
              <Text style={styles.boxTitle}>SEARCH</Text>
              <Row label="Query" value={sea.query || 'N/A'} />
              <Row label="Results" value={sea.resultCount ?? 0} />
              <Row label="Source" value={sea.apiSource || 'unknown'} />
              <Row label="Cache hit" value={sea.cacheHit ? 'Yes' : 'No'} />
              <Row label="Time" value={sea.timestamp || 'N/A'} />
            </View>

            <Text style={styles.note}>Dev-only overlay. Remove before production.</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 999,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  fabText: { fontSize: 22 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 16,
    paddingTop: 64,
  },
  modalCard: {
    borderRadius: 14,
    backgroundColor: 'rgba(20,20,30,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 14,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '900', flex: 1 },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,157,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.35)',
  },
  closeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  box: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
  },
  boxTitle: { color: '#fff', fontWeight: '900', fontSize: 12, marginBottom: 8, letterSpacing: 0.4 },
  row: { marginBottom: 6 },
  rowLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700' },
  rowValue: { color: '#fff', fontSize: 12, marginTop: 2 },
  note: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontStyle: 'italic', marginTop: 6 },
});

