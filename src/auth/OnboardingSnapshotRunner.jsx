/**
 * Auto-cycles real OnboardingWizardScreen steps and pings the Mac capture server.
 * Trigger: coachconnect://onboarding-snapshots (dev only)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import OnboardingWizardScreen from './OnboardingWizardScreen';
import {
  ONBOARDING_SNAPSHOT_CAPTURES,
  ONBOARDING_SNAPSHOT_TOTAL,
} from './onboardingSnapshotSteps';

const SNAP_SERVER = 'http://127.0.0.1:9876';
const RENDER_WAIT_MS = 2800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function OnboardingSnapshotRunner({ onDone }) {
  const [current, setCurrent] = useState(ONBOARDING_SNAPSHOT_CAPTURES[0]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Starting…');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (let i = 0; i < ONBOARDING_SNAPSHOT_CAPTURES.length; i += 1) {
        if (cancelled) return;
        const cap = ONBOARDING_SNAPSHOT_CAPTURES[i];
        setCurrent(cap);
        setProgress(i + 1);
        setStatus(`Rendering ${cap.role} step ${cap.step}…`);

        await sleep(RENDER_WAIT_MS);
        if (cancelled) return;

        try {
          const res = await fetch(
            `${SNAP_SERVER}/snap?file=${encodeURIComponent(cap.file)}`,
            { method: 'POST' },
          );
          if (!res.ok) throw new Error(`Capture failed (${res.status})`);
          setStatus(`Captured ${i + 1}/${ONBOARDING_SNAPSHOT_TOTAL}`);
        } catch (e) {
          const msg = e?.message || String(e);
          setError(
            `Could not reach capture server on :9876. Run: npm run snapshot:onboarding\n\n${msg}`,
          );
          return;
        }

        await sleep(400);
      }

      setStatus('Done — check docs/onboarding-snapshots/');
      await sleep(800);
      onDone?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [onDone]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Snapshot capture failed</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <OnboardingWizardScreen
        key={`${current.role}-${current.step}`}
        role={current.role}
        previewMode
        previewInitialStep={current.step}
        onComplete={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F' },
  banner: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  bannerText: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },
  center: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { color: '#FF6B9D', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  errorBody: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
