// Solid page background (strip pass: was pastel/mesh glass wash).
// Flow: paint bg → children. Props kept for callers.
// Used by screens that still wrap content in GlassBackground*.

import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function GlassBackgroundLight({ children, style }) {
  return <View style={[styles.root, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F2F2F0',
  },
});
