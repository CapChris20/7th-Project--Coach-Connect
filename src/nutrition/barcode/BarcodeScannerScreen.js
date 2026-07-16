/**
 * Barcode Scanner Screen
 *
 * Purpose: UI screen or component: Barcode Scanner Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: BarcodeScannerScreen
 *
 * @file-header
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared-ui/ThemeContext';
import searchFoodsService from '../food-search/searchFoodsService';
import { normalizeBarcodeForLookup } from '../barcode/normalizeBarcodeForLookup';
import { cacheFoodProduct } from '../daily-log/logFoodToFirestore';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import FoodConfirmSheet from '../food-search/ConfirmFoodSelectionSheet';

const ACCENT = {
  hotPink: '#FF6B9D', // Keep your hot pink
  orange: '#F97316', // Keep your orange
  purple: '#C084FC', // Keep your light purple
  cyan: '#06B6D4', // Keep your cyan
  green: '#22C55E', // Keep your green
  /** Barcode viewfinder corners — dark pink / dark orange */
  framePink: '#9F1239',
  frameOrange: '#C2410C',
};

function getTokens(isDark) {
  return isDark
    ? {
        ...ACCENT,
        screenBg: '#0A0A0F',
        cardBg: 'rgba(255,255,255,0.06)',
        cardBorder: 'rgba(255,255,255,0.10)',
        surfaceOpaque: '#15151C',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.68)',
        textVeryMuted: 'rgba(255,255,255,0.45)',
        inputBg: 'rgba(255,255,255,0.07)',
        secondaryAction: 'rgba(255,255,255,0.88)',
      }
    : {
        ...ACCENT,
        screenBg: '#F5F3FF',
        cardBg: 'rgba(255,255,255,0.92)',
        cardBorder: 'rgba(0,0,0,0.10)',
        surfaceOpaque: '#FFFFFF',
        text: '#1a0a2e',
        textMuted: 'rgba(26,10,46,0.62)',
        textVeryMuted: 'rgba(26,10,46,0.45)',
        inputBg: 'rgba(0,0,0,0.04)',
        secondaryAction: 'rgba(26,10,46,0.78)',
      };
}

export default function BarcodeScannerScreen({ onClose, onScanSuccess, mealType }) {
  const { colors, spacing, isDark } = useTheme();
  const t = getTokens(isDark);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [pendingBarcodeFood, setPendingBarcodeFood] = useState(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [missState, setMissState] = useState(null);
  const isProcessingRef = useRef(false);
  const styles = createStyles(spacing, t);

  const hasPermission = permission?.granted ?? false;
  const permissionUndecided = permission?.status === 'undetermined' || permission == null;
  const permissionDenied = permission?.granted === false;

  // Request camera permission when status is undecided
  useEffect(() => {
    if (!permission) return;
    if (permission.status === 'undetermined') {
      requestPermission().catch((err) => console.warn('Camera permission request failed:', err));
    }
  }, [permission?.status]);

  const lookupBarcode = async (barcode) => {
    const normalized = normalizeBarcodeForLookup(barcode);
    if (!normalized || normalized.length < 8) {
      Alert.alert('Invalid Barcode', 'Please enter a valid barcode number');
      return;
    }

    if (loading) return;
    
    setLoading(true);
    setScanned(true);
    setMissState(null);
    
    try {
      console.log('Looking up barcode:', normalized);
      setLastScannedBarcode(normalized);
      const raw = await searchFoodsService.lookupBarcode(normalized);
      const isFoodHit = raw && !raw.notFound && !raw.variableWeightBarcode;
      const result = isFoodHit
        ? { success: true, data: { ...raw, scannedBarcode: normalized } }
        : {
            success: false,
            error: raw?.variableWeightBarcode
              ? raw.message
              : 'This product is not in our food databases yet.',
            variableWeight: !!raw?.variableWeightBarcode,
            suggestedSearch: raw?.suggestedSearchQueries || [],
            scannedBarcode: normalized,
          };
      
      if (result.success && result.data) {
        try {
          await cacheFoodProduct(result.data);
        } catch (cacheError) {
          console.warn('Failed to cache product:', cacheError);
        }
        setPendingBarcodeFood(result.data);
      } else {
        setMissState({
          barcode: normalized,
          message: result.error || 'Product not found.',
          variableWeight: result.variableWeight,
          suggestions: Array.isArray(result.suggestedSearch)
            ? result.suggestedSearch
            : (result.suggestedSearch ? [result.suggestedSearch] : []),
        });
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      setMissState({
        barcode: normalized,
        message: 'Failed to look up barcode. Check your connection and try again.',
        variableWeight: false,
        suggestions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const goSearchByName = (query) => {
    const q = String(query || '').trim();
    if (!q) return;
    onClose?.({ searchQuery: q });
  };

  const resetScanner = () => {
    setMissState(null);
    setPendingBarcodeFood(null);
    setScanned(false);
    setManualBarcode('');
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (isProcessingRef.current || scanned || loading) return;
    isProcessingRef.current = true;
    setScanned(true);
    try {
      await lookupBarcode(data);
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handleConfirmFood = async (adjustedFood) => {
    if (!adjustedFood || !onScanSuccess) return;
    const gtin = adjustedFood.scannedBarcode || lastScannedBarcode || pendingBarcodeFood?.scannedBarcode;
    if (gtin) {
      try {
        await searchFoodsService.saveVerifiedBarcode(gtin, adjustedFood);
      } catch (e) {
        console.warn('Failed to save verified barcode:', e?.message || e);
      }
    }
    onScanSuccess(adjustedFood, mealType);
    if (onClose) onClose();
  };

  const handleWrongItem = () => {
    const name = pendingBarcodeFood?.name || pendingBarcodeFood?.brand || '';
    setPendingBarcodeFood(null);
    setScanned(false);
    goSearchByName(name || 'packaged food');
  };

  const handleCancelAmount = () => {
    setPendingBarcodeFood(null);
    setScanned(false);
  };

  // Serving confirm (after successful scan) — shared with search confirm UX
  if (pendingBarcodeFood) {
    return (
      <FoodConfirmSheet
        food={pendingBarcodeFood}
        title="Confirm & log"
        theme={{ screenBg: t.screenBg }}
        showVerification
        reserveShellBottomNav
        scannedBarcode={pendingBarcodeFood.scannedBarcode || lastScannedBarcode}
        onConfirm={handleConfirmFood}
        onCancel={handleCancelAmount}
        onWrongItem={handleWrongItem}
      />
    );
  }

  // Not found — typed UPC retry + name search (never dead-end)
  if (missState) {
    const suggestions = (missState.suggestions || []).filter(
      (s) => s && !/barcode|gs1|tracker|nutritionix|fnic|calorie content/i.test(String(s)),
    );
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText} selectable={true}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title} selectable={true}>Not found</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.manualEntryContainer}>
          <LinearGradient
            colors={isDark ? ['#BE185D', '#EA580C'] : ['#BE185D', '#FB923C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 22, padding: 1 }}
          >
            <View
              style={{
                borderRadius: 21,
                backgroundColor: t.surfaceOpaque,
                paddingVertical: 22,
                paddingHorizontal: 18,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.cardBorder,
              }}
            >
              <Text style={styles.manualEntryTitle} selectable={true}>
                {missState.variableWeight ? 'Store scale label' : 'Barcode not in database'}
              </Text>
              <Text style={styles.manualEntrySubtitle} selectable={true}>
                {missState.message}
                {'\n\n'}UPC: {missState.barcode}
              </Text>
              <TextInput
                style={styles.barcodeInput}
                placeholder="Try typing UPC again"
                placeholderTextColor={t.textVeryMuted}
                value={manualBarcode}
                onChangeText={setManualBarcode}
                keyboardType="numeric"
                returnKeyType="search"
                onSubmitEditing={() => lookupBarcode(manualBarcode || missState.barcode)}
              />
              <TouchableOpacity
                style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                onPress={() => lookupBarcode(manualBarcode || missState.barcode)}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#9F1239', '#EA580C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.searchButtonInner}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.searchButtonText} selectable={true}>
                      Look up UPC
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              {suggestions.slice(0, 3).map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.button, { marginTop: 10 }]}
                  onPress={() => goSearchByName(q)}
                >
                  <Text style={styles.buttonText} selectable={true}>
                    Search: {q.length > 42 ? `${q.slice(0, 42)}…` : q}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.button, { marginTop: 10 }]}
                onPress={() => onClose?.({ openFoodSearch: true })}
              >
                <Text style={styles.buttonText} selectable={true}>
                  Search by name
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={resetScanner} hitSlop={{ top: 8, bottom: 8 }}>
                <Text style={styles.cancelButtonText} selectable={true}>
                  Scan again
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} hitSlop={{ top: 8, bottom: 8 }}>
                <Text style={styles.cancelButtonText} selectable={true}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  // Manual entry screen (user chose "Enter manually")
  const renderManualEntry = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowManualEntry(false)} style={styles.closeButton}>
          <Text style={styles.closeText} selectable={true}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} selectable={true}>Enter Barcode</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText} selectable={true}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.manualEntryContainer}>
        <LinearGradient
          colors={isDark ? ['#BE185D', '#EA580C'] : ['#BE185D', '#FB923C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 22, padding: 1 }}
        >
          <View
            style={{
              borderRadius: 21,
              backgroundColor: t.surfaceOpaque,
              paddingVertical: 22,
              paddingHorizontal: 18,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.cardBorder,
            }}
          >
            <Text style={styles.manualEntryTitle} selectable={true}>
              Manual barcode
            </Text>
            <Text style={styles.manualEntrySubtitle} selectable={true}>
              Type the numbers under the barcode.
            </Text>
            <TextInput
              style={styles.barcodeInput}
              placeholder="e.g. 012000504051"
              placeholderTextColor={t.textVeryMuted}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              keyboardType="numeric"
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => lookupBarcode(manualBarcode)}
            />
            <TouchableOpacity
              style={[styles.searchButton, loading && styles.searchButtonDisabled]}
              onPress={() => lookupBarcode(manualBarcode)}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#9F1239', '#EA580C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.searchButtonInner}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.searchButtonText} selectable={true}>
                    Look up
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} hitSlop={{ top: 8, bottom: 8 }}>
              <Text style={styles.cancelButtonText} selectable={true}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </SafeAreaView>
  );

  if (showManualEntry) {
    return renderManualEntry();
  }

  if (permissionUndecided) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={t.hotPink} />
          <Text style={styles.permissionText} selectable={true}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false && !showManualEntry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText} selectable={true}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title} selectable={true}>Camera access</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText} selectable={true}>
            Camera permission is required to scan barcodes. You can still enter the barcode number manually.
          </Text>
          {permission?.canAskAgain !== false && (
            <TouchableOpacity style={styles.button} onPress={() => requestPermission()}>
              <Text style={styles.buttonText} selectable={true}>Try again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={() => setShowManualEntry(true)}>
            <Text style={styles.buttonText} selectable={true}>Enter barcode manually</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText} selectable={true}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Camera view with barcode scanning (Expo Go compatible via expo-camera)
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText} selectable={true}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title} selectable={true}>Scan Barcode</Text>
        <TouchableOpacity onPress={() => setShowManualEntry(true)} style={styles.closeButton}>
          <Text style={[styles.closeText, { fontSize: 14 }]} selectable={true}>Type</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
          }}
          onBarcodeScanned={scanned ? undefined : (result) => {
            if (result?.data) handleBarCodeScanned({ type: result.type, data: result.data });
          }}
        />
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={t.hotPink} />
              <Text style={styles.loadingText} selectable={true}>Looking up product...</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText} selectable={true}>
          Position the barcode within the frame
        </Text>
        <TouchableOpacity onPress={() => setShowManualEntry(true)} style={{ marginTop: 8 }}>
          <Text style={[styles.instructionText, { textDecorationLine: 'underline', opacity: 0.9 }]} selectable={true}>
            Enter barcode number manually
          </Text>
        </TouchableOpacity>
        {scanned && !loading && (
          <TouchableOpacity style={styles.rescanButton} onPress={() => setScanned(false)}>
            <Text style={styles.rescanText} selectable={true}>Tap to scan again</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (spacing, t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.screenBg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: t.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: t.cardBorder,
    },
    closeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      color: t.text,
      fontSize: 22,
      fontWeight: '600',
    },
    title: {
      color: t.text,
      fontSize: 18,
      fontWeight: '800',
    },
    placeholder: {
      width: 40,
    },
    scannerContainer: {
      flex: 1,
      position: 'relative',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scanArea: {
      width: 250,
      height: 250,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderColor: t.framePink,
      borderWidth: 3,
    },
    topLeft: {
      top: 0,
      left: 0,
      borderColor: t.framePink,
      borderRightWidth: 0,
      borderBottomWidth: 0,
    },
    topRight: {
      top: 0,
      right: 0,
      borderColor: t.frameOrange,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
    },
    bottomLeft: {
      bottom: 0,
      left: 0,
      borderColor: t.frameOrange,
      borderRightWidth: 0,
      borderTopWidth: 0,
    },
    bottomRight: {
      bottom: 0,
      right: 0,
      borderColor: t.framePink,
      borderLeftWidth: 0,
      borderTopWidth: 0,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: t.text,
      marginTop: spacing.md,
      fontSize: 16,
    },
    instructions: {
      padding: spacing.lg,
      backgroundColor: t.cardBg,
      borderTopWidth: 1,
      borderTopColor: t.cardBorder,
      alignItems: 'center',
    },
    instructionText: {
      color: t.text,
      fontSize: 16,
      textAlign: 'center',
    },
    rescanButton: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: t.cardBg,
      borderWidth: 1,
      borderColor: t.cardBorder,
      borderRadius: 8,
    },
    rescanText: {
      color: t.text,
      fontSize: 14,
      fontWeight: '600',
    },
    permissionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    permissionText: {
      color: t.text,
      fontSize: 16,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    button: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: t.cardBg,
      borderWidth: 1,
      borderColor: t.cardBorder,
      borderRadius: 8,
    },
    buttonText: {
      color: t.text,
      fontSize: 16,
      fontWeight: '600',
    },
    manualEntryContainer: {
      flex: 1,
      padding: spacing.lg,
      justifyContent: 'center',
    },
    manualEntryTitle: {
      color: t.text,
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    manualEntrySubtitle: {
      color: t.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    barcodeInput: {
      backgroundColor: t.inputBg,
      borderRadius: 12,
      padding: spacing.md,
      color: t.text,
      fontSize: 18,
      textAlign: 'center',
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: t.cardBorder,
    },
    searchButton: {
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.cardBorder,
      marginBottom: spacing.md,
    },
    searchButtonInner: {
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    searchButtonDisabled: {
      opacity: 0.6,
    },
    searchButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButton: {
      padding: spacing.md,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: t.secondaryAction,
      fontSize: 14,
      fontWeight: '600',
    },
    amountStepContent: {
      flex: 1,
      padding: spacing.lg,
      paddingTop: spacing.xl,
    },
    amountProductName: {
      color: t.text,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    amountDefaultText: {
      color: t.textMuted,
      fontSize: 14,
      marginBottom: spacing.xl,
    },
    amountLabel: {
      color: t.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    amountInput: {
      backgroundColor: t.inputBg,
      borderRadius: 12,
      padding: spacing.md,
      color: t.text,
      fontSize: 20,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: t.cardBorder,
    },
    amountEstimated: {
      color: t.textMuted,
      fontSize: 14,
      marginBottom: spacing.xl,
    },
    logButton: {
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    logButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

