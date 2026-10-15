// BarcodeScannerScreen — camera / typed UPC lookup that lands on ConfirmFoodPopup.
// Flow: permission → scan or type → searchFoods.lookupBarcode → confirm sheet or miss UI.
// Used by: DailyLogContent when the user taps Scan on a meal card.

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
import { useTheme } from '../../look-and-feel/lightDarkMode';
import searchFoods from '../food-search/searchFoods';
import { fixBarcodeDigits } from '../barcode/fixBarcodeDigits';
import { cacheFoodProduct } from '../daily-log/saveLoggedFood';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import FoodConfirmSheet from '../food-search/ConfirmFoodPopup';

// ===== NAMED CONSTANTS =====

// Manipulate here: brand accents + viewfinder corner colors.
const ACCENT = {
  hotPink: '#FF6B9D',
  orange: '#F97316',
  purple: '#C084FC',
  cyan: '#06B6D4',
  green: '#22C55E',
  /** Barcode viewfinder corners — dark pink / dark orange */
  framePink: '#9F1239',
  frameOrange: '#C2410C',
};

// Manipulate here: shortest UPC/EAN we will look up (below this → invalid alert).
const MIN_BARCODE_DIGITS = 8;

// Manipulate here: miss-state suggestion chips (hide tracker/GS1 junk, cap at 3).
const MAX_SUGGESTION_CHIPS = 3;
const SUGGESTION_LABEL_MAX_CHARS = 42;
const JUNK_SUGGESTION_PATTERN = /barcode|gs1|tracker|nutritionix|fnic|calorie content/i;

const FALLBACK_WRONG_ITEM_SEARCH = 'packaged food';

const MISS_BORDER_GRADIENT_DARK = ['#BE185D', '#EA580C'];
const MISS_BORDER_GRADIENT_LIGHT = ['#BE185D', '#FB923C'];
const LOOKUP_BUTTON_GRADIENT = ['#9F1239', '#EA580C'];

// ===== HELPER FUNCTIONS =====

/**
 * Theme tokens for scanner chrome (screen bg, cards, muted text).
 * @param {boolean} isDark
 * @returns {object}
 */
function getTokens(isDark) {
  if (isDark) {
    return {
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
    };
  }
  return {
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

/**
 * Shape searchFoods.lookupBarcode output into success/miss for the UI.
 * @param {object|null} raw
 * @param {string} normalized
 * @returns {{ success: boolean, data?: object, error?: string, variableWeight?: boolean, suggestedSearch?: Array, scannedBarcode: string }}
 */
function shapeBarcodeLookupResult(raw, normalized) {
  const isFoodHit = raw && !raw.notFound && !raw.variableWeightBarcode;
  if (isFoodHit) {
    return { success: true, data: { ...raw, scannedBarcode: normalized } };
  }
  return {
    success: false,
    error: raw?.variableWeightBarcode
      ? raw.message
      : 'This product is not in our food databases yet.',
    variableWeight: !!raw?.variableWeightBarcode,
    suggestedSearch: raw?.suggestedSearchQueries || [],
    scannedBarcode: normalized,
  };
}

/**
 * Best-effort product cache — never blocks the confirm sheet on cache failure.
 * @param {object} productData
 * @returns {Promise<void>}
 */
async function tryCacheFoodProduct(productData) {
  try {
    await cacheFoodProduct(productData);
  } catch (cacheError) {
    console.warn('Failed to cache product:', cacheError);
  }
}

/**
 * Normalize suggestion list for the miss screen (string or array → clean chips).
 * @param {*} suggestedSearch
 * @returns {string[]}
 */
function suggestionListFromMiss(suggestedSearch) {
  if (Array.isArray(suggestedSearch)) return suggestedSearch;
  if (suggestedSearch) return [suggestedSearch];
  return [];
}

/**
 * Drop GS1 / tracker junk strings from miss suggestions.
 * @param {string[]} suggestions
 * @returns {string[]}
 */
function filterUsableSuggestions(suggestions) {
  return (suggestions || []).filter(
    (suggestion) => suggestion && !JUNK_SUGGESTION_PATTERN.test(String(suggestion)),
  );
}

/**
 * Truncate long suggestion labels for chip buttons.
 * @param {string} label
 * @returns {string}
 */
function truncateSuggestionLabel(label) {
  if (label.length > SUGGESTION_LABEL_MAX_CHARS) {
    return `${label.slice(0, SUGGESTION_LABEL_MAX_CHARS)}…`;
  }
  return label;
}

/**
 * Style factory — depends on theme spacing + tokens.
 * @param {*} spacing
 * @param {object} themeTokens
 * @returns {object}
 */
function createStyles(spacing, themeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeTokens.screenBg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: themeTokens.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: themeTokens.cardBorder,
    },
    closeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      color: themeTokens.text,
      fontSize: 22,
      fontWeight: '600',
    },
    title: {
      color: themeTokens.text,
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
      borderColor: themeTokens.framePink,
      borderWidth: 3,
    },
    topLeft: {
      top: 0,
      left: 0,
      borderColor: themeTokens.framePink,
      borderRightWidth: 0,
      borderBottomWidth: 0,
    },
    topRight: {
      top: 0,
      right: 0,
      borderColor: themeTokens.frameOrange,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
    },
    bottomLeft: {
      bottom: 0,
      left: 0,
      borderColor: themeTokens.frameOrange,
      borderRightWidth: 0,
      borderTopWidth: 0,
    },
    bottomRight: {
      bottom: 0,
      right: 0,
      borderColor: themeTokens.framePink,
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
      color: themeTokens.text,
      marginTop: spacing.md,
      fontSize: 16,
    },
    instructions: {
      padding: spacing.lg,
      backgroundColor: themeTokens.cardBg,
      borderTopWidth: 1,
      borderTopColor: themeTokens.cardBorder,
      alignItems: 'center',
    },
    instructionText: {
      color: themeTokens.text,
      fontSize: 16,
      textAlign: 'center',
    },
    rescanButton: {
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: themeTokens.cardBg,
      borderWidth: 1,
      borderColor: themeTokens.cardBorder,
      borderRadius: 8,
    },
    rescanText: {
      color: themeTokens.text,
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
      color: themeTokens.text,
      fontSize: 16,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    button: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: themeTokens.cardBg,
      borderWidth: 1,
      borderColor: themeTokens.cardBorder,
      borderRadius: 8,
    },
    buttonText: {
      color: themeTokens.text,
      fontSize: 16,
      fontWeight: '600',
    },
    manualEntryContainer: {
      flex: 1,
      padding: spacing.lg,
      justifyContent: 'center',
    },
    manualEntryTitle: {
      color: themeTokens.text,
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    manualEntrySubtitle: {
      color: themeTokens.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    barcodeInput: {
      backgroundColor: themeTokens.inputBg,
      borderRadius: 12,
      padding: spacing.md,
      color: themeTokens.text,
      fontSize: 18,
      textAlign: 'center',
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: themeTokens.cardBorder,
    },
    searchButton: {
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: themeTokens.cardBorder,
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
      color: themeTokens.secondaryAction,
      fontSize: 14,
      fontWeight: '600',
    },
    amountStepContent: {
      flex: 1,
      padding: spacing.lg,
      paddingTop: spacing.xl,
    },
    amountProductName: {
      color: themeTokens.text,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    amountDefaultText: {
      color: themeTokens.textMuted,
      fontSize: 14,
      marginBottom: spacing.xl,
    },
    amountLabel: {
      color: themeTokens.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    amountInput: {
      backgroundColor: themeTokens.inputBg,
      borderRadius: 12,
      padding: spacing.md,
      color: themeTokens.text,
      fontSize: 20,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: themeTokens.cardBorder,
    },
    amountEstimated: {
      color: themeTokens.textMuted,
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
}

// ===== MAIN FUNCTION =====

/**
 * Camera + manual UPC scanner that hands a confirmed food back to the daily log.
 * @param {{ onClose?: Function, onScanSuccess?: Function, mealType?: string }} props
 */
export default function BarcodeScannerScreen({ onClose, onScanSuccess, mealType }) {
  const { colors, spacing, isDark } = useTheme();
  const themeTokens = getTokens(isDark);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [pendingBarcodeFood, setPendingBarcodeFood] = useState(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [missState, setMissState] = useState(null);
  const isProcessingRef = useRef(false);
  const styles = createStyles(spacing, themeTokens);

  const hasPermission = permission?.granted ?? false;
  const permissionUndecided = permission?.status === 'undetermined' || permission == null;
  const permissionDenied = permission?.granted === false;

  // Request camera permission when status is undecided
  // vocab: useCameraPermissions = expo-camera hook for grant / deny / undetermined
  useEffect(() => {
    if (!permission) return;
    if (permission.status === 'undetermined') {
      requestPermission().catch((err) => console.warn('Camera permission request failed:', err));
    }
  }, [permission?.status]);

  /**
   * Normalize digits → lookup → cache on hit or show miss UI.
   * Nested try for cache lives in tryCacheFoodProduct so depth stays flat.
   * @param {string} barcode
   */
  const lookupBarcode = async (barcode) => {
    const normalized = fixBarcodeDigits(barcode);
    if (!normalized || normalized.length < MIN_BARCODE_DIGITS) {
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
      const raw = await searchFoods.lookupBarcode(normalized);
      const result = shapeBarcodeLookupResult(raw, normalized);

      if (result.success && result.data) {
        await tryCacheFoodProduct(result.data);
        setPendingBarcodeFood(result.data);
        return;
      }

      setMissState({
        barcode: normalized,
        message: result.error || 'Product not found.',
        variableWeight: result.variableWeight,
        suggestions: suggestionListFromMiss(result.suggestedSearch),
      });
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

  const goSearchByName = (searchQuery) => {
    const trimmedQuery = String(searchQuery || '').trim();
    if (!trimmedQuery) return;
    onClose?.({ searchQuery: trimmedQuery });
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
    const gtin =
      adjustedFood.scannedBarcode ||
      lastScannedBarcode ||
      pendingBarcodeFood?.scannedBarcode;
    if (gtin) {
      try {
        await searchFoods.saveVerifiedBarcode(gtin, adjustedFood);
      } catch (error) {
        console.warn('Failed to save verified barcode:', error?.message || error);
      }
    }
    onScanSuccess(adjustedFood, mealType);
    if (onClose) onClose();
  };

  const handleWrongItem = () => {
    const name = pendingBarcodeFood?.name || pendingBarcodeFood?.brand || '';
    setPendingBarcodeFood(null);
    setScanned(false);
    goSearchByName(name || FALLBACK_WRONG_ITEM_SEARCH);
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
        theme={{ screenBg: themeTokens.screenBg }}
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
    const suggestions = filterUsableSuggestions(missState.suggestions);
    const missBorderColors = isDark ? MISS_BORDER_GRADIENT_DARK : MISS_BORDER_GRADIENT_LIGHT;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText} selectable={true}>
              ✕
            </Text>
          </TouchableOpacity>
          <Text style={styles.title} selectable={true}>
            Not found
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.manualEntryContainer}>
          <LinearGradient
            colors={missBorderColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 22, padding: 1 }}
          >
            <View
              style={{
                borderRadius: 21,
                backgroundColor: themeTokens.surfaceOpaque,
                paddingVertical: 22,
                paddingHorizontal: 18,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: themeTokens.cardBorder,
              }}
            >
              <Text style={styles.manualEntryTitle} selectable={true}>
                {missState.variableWeight ? 'Store scale label' : 'Barcode not in database'}
              </Text>
              <Text style={styles.manualEntrySubtitle} selectable={true}>
                {missState.message}
                {'\n\n'}
                UPC: {missState.barcode}
              </Text>
              <TextInput
                style={styles.barcodeInput}
                placeholder="Try typing UPC again"
                placeholderTextColor={themeTokens.textVeryMuted}
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
                  colors={LOOKUP_BUTTON_GRADIENT}
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
              {suggestions.slice(0, MAX_SUGGESTION_CHIPS).map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={[styles.button, { marginTop: 10 }]}
                  onPress={() => goSearchByName(suggestion)}
                >
                  <Text style={styles.buttonText} selectable={true}>
                    Search: {truncateSuggestionLabel(suggestion)}
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
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={resetScanner}
                hitSlop={{ top: 8, bottom: 8 }}
              >
                <Text style={styles.cancelButtonText} selectable={true}>
                  Scan again
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8 }}
              >
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
  const renderManualEntry = () => {
    const missBorderColors = isDark ? MISS_BORDER_GRADIENT_DARK : MISS_BORDER_GRADIENT_LIGHT;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowManualEntry(false)} style={styles.closeButton}>
            <Text style={styles.closeText} selectable={true}>
              ←
            </Text>
          </TouchableOpacity>
          <Text style={styles.title} selectable={true}>
            Enter Barcode
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText} selectable={true}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.manualEntryContainer}>
          <LinearGradient
            colors={missBorderColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 22, padding: 1 }}
          >
            <View
              style={{
                borderRadius: 21,
                backgroundColor: themeTokens.surfaceOpaque,
                paddingVertical: 22,
                paddingHorizontal: 18,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: themeTokens.cardBorder,
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
                placeholderTextColor={themeTokens.textVeryMuted}
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
                  colors={LOOKUP_BUTTON_GRADIENT}
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
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8 }}
              >
                <Text style={styles.cancelButtonText} selectable={true}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  };

  if (showManualEntry) {
    return renderManualEntry();
  }

  if (permissionUndecided) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={themeTokens.hotPink} />
          <Text style={styles.permissionText} selectable={true}>
            Requesting camera permission...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false && !showManualEntry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText} selectable={true}>
              ✕
            </Text>
          </TouchableOpacity>
          <Text style={styles.title} selectable={true}>
            Camera access
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText} selectable={true}>
            Camera permission is required to scan barcodes. You can still enter the barcode number
            manually.
          </Text>
          {permission?.canAskAgain !== false && (
            <TouchableOpacity style={styles.button} onPress={() => requestPermission()}>
              <Text style={styles.buttonText} selectable={true}>
                Try again
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.button, { marginTop: 12 }]}
            onPress={() => setShowManualEntry(true)}
          >
            <Text style={styles.buttonText} selectable={true}>
              Enter barcode manually
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText} selectable={true}>
              Cancel
            </Text>
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
          <Text style={styles.closeText} selectable={true}>
            ✕
          </Text>
        </TouchableOpacity>
        <Text style={styles.title} selectable={true}>
          Scan Barcode
        </Text>
        <TouchableOpacity onPress={() => setShowManualEntry(true)} style={styles.closeButton}>
          <Text style={[styles.closeText, { fontSize: 14 }]} selectable={true}>
            Type
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
          }}
          onBarcodeScanned={
            scanned
              ? undefined
              : (result) => {
                  if (result?.data) {
                    handleBarCodeScanned({ type: result.type, data: result.data });
                  }
                }
          }
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
              <ActivityIndicator size="large" color={themeTokens.hotPink} />
              <Text style={styles.loadingText} selectable={true}>
                Looking up product...
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText} selectable={true}>
          Position the barcode within the frame
        </Text>
        <TouchableOpacity onPress={() => setShowManualEntry(true)} style={{ marginTop: 8 }}>
          <Text
            style={[styles.instructionText, { textDecorationLine: 'underline', opacity: 0.9 }]}
            selectable={true}
          >
            Enter barcode number manually
          </Text>
        </TouchableOpacity>
        {scanned && !loading && (
          <TouchableOpacity style={styles.rescanButton} onPress={() => setScanned(false)}>
            <Text style={styles.rescanText} selectable={true}>
              Tap to scan again
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
