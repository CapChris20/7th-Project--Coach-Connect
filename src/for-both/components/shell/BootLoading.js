/**
 * Boot loading lock — one overlay stays mounted for the whole cold start
 * so the loader never remounts between App → AuthGate → ClientApp.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingPrismFlip from './LoadingPrismFlip';

const BootLoadingContext = createContext({
  acquire: () => {},
  release: () => {},
  visible: true,
});

export function BootLoadingProvider({ children }) {
  const countRef = useRef(1);
  const [visible, setVisible] = useState(true);

  const acquire = useCallback(() => {
    countRef.current += 1;
    setVisible(true);
  }, []);

  const release = useCallback(() => {
    countRef.current = Math.max(0, countRef.current - 1);
    setVisible(countRef.current > 0);
  }, []);

  const value = useMemo(() => ({ acquire, release, visible }), [acquire, release, visible]);

  return <BootLoadingContext.Provider value={value}>{children}</BootLoadingContext.Provider>;
}

export function useBootLoading() {
  return useContext(BootLoadingContext);
}

/** Hold the boot overlay while `active` is true. */
export function useBootLoadingLock(active) {
  const { acquire, release } = useBootLoading();
  const held = useRef(false);

  useLayoutEffect(() => {
    if (active && !held.current) {
      acquire();
      held.current = true;
    } else if (!active && held.current) {
      release();
      held.current = false;
    }
    return () => {
      if (held.current) {
        release();
        held.current = false;
      }
    };
  }, [active, acquire, release]);
}

/** Always mounted. Opacity toggles only — animation keeps running. */
export function BootLoadingOverlay() {
  const { visible } = useBootLoading();
  return (
    <View
      style={[styles.overlay, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      collapsable={false}
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.content}>
          <LoadingPrismFlip width={300} />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Suspense fallback that keeps the shared overlay locked. */
export function BootSuspenseFallback() {
  useBootLoadingLock(true);
  return <View style={styles.fill} />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  hidden: {
    opacity: 0,
  },
  fill: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
