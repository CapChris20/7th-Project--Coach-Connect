// Design Law barcode scan (PNG 09–12): hatched viewfinder → lookup card → confirm or miss CTAs.
// Flow: camera permission → scan / type digits → searchFoods.lookupBarcode → FoodConfirmSheet or miss.
// Used by DailyLogContent when the user taps Scan on a meal / food search.
//
// vocab: HardShadow = solid offset shadow (no blur); viewfinder = hatch OR live camera + corner brackets
// vocab: missState = barcode looked up but not in our food databases
// NO green accents, NO GradientFrame, NO pink rings — tokens + HardShadow only.

import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { useTheme } from '../../look-and-feel/lightDarkMode';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import searchFoods from '../food-search/searchFoods';
import { fixBarcodeDigits } from '../barcode/fixBarcodeDigits';
import { cacheFoodProduct } from '../daily-log/saveLoggedFood';
import FoodConfirmSheet from '../food-search/ConfirmFoodPopup';

// ===== NAMED CONSTANTS =====

// Manipulate here: shortest UPC/EAN we will look up (below this → invalid alert)
const MIN_BARCODE_DIGITS = 8;

// Manipulate here: miss-state suggestion chips (hide tracker/GS1 junk, cap at 3)
const MAX_SUGGESTION_CHIPS = 3;
const SUGGESTION_LABEL_MAX_CHARS = 42;
const JUNK_SUGGESTION_PATTERN = /barcode|gs1|tracker|nutritionix|fnic|calorie content/i;

const FALLBACK_WRONG_ITEM_SEARCH = 'packaged food';
const SCALES_ICON = require('../../assets/icons/handoff/scales.png');

// Manipulate here: viewfinder bracket size / thickness / frame height (PNG 09)
const BRACKET_SIZE = 28;
const BRACKET_THICK = 3;
const VIEWFINDER_HEIGHT = 220;
const HATCH_STRIPE_PX = 10;

// ===== HELPER FUNCTIONS =====

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
 * Format digits with spaces for the status card (e.g. 0 49000 02830 2).
 * @param {string} digits
 * @returns {string}
 */
function spacedBarcode(digits) {
  const clean = String(digits || '').replace(/\D/g, '');
  if (clean.length < 8) return clean;
  // Manipulate here: grouping for UPC-A style display
  if (clean.length === 12) {
    return `${clean[0]} ${clean.slice(1, 6)} ${clean.slice(6, 11)} ${clean[11]}`;
  }
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Diagonal hatch fill for the viewfinder when camera is off / miss state (Design Law SVG pattern).
 */
function ViewfinderHatch() {
  const { colors } = useTheme();
  // vocab: useId keeps pattern ids unique if multiple viewfinders mount
  const reactId = useId();
  const patternId = useMemo(
    () => `scanHatch_${String(reactId).replace(/[^a-zA-Z0-9]/g, '')}`,
    [reactId],
  );
  const patternSize = HATCH_STRIPE_PX * 2;

  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={patternSize}
          height={patternSize}
          patternTransform="rotate(135)"
        >
          <Rect x={0} y={0} width={HATCH_STRIPE_PX} height={patternSize} fill={colors.nbSoft} />
          <Rect
            x={HATCH_STRIPE_PX}
            y={0}
            width={HATCH_STRIPE_PX}
            height={patternSize}
            fill={colors.nbSurfaceChip || colors.nbSurface}
          />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </Svg>
  );
}

/**
 * PNG 09 header: back square + centered title + optional close square (HardShadow).
 */
function ScanHeader({ title, onBack, onClose, colors, centerTitle = true }) {
  return (
    <View style={styles.header}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.sq,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
        </TouchableOpacity>
      </HardShadow>
      <Text
        style={[
          styles.title,
          { color: colors.nbInk, textAlign: centerTitle ? 'center' : 'left' },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {typeof onClose === 'function' ? (
        <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.sq,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close"
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={20} color={colors.nbInk} />
          </TouchableOpacity>
        </HardShadow>
      ) : (
        // Keep title centered when there is no close square (PNG 11 miss)
        <View style={styles.sqSpacer} />
      )}
    </View>
  );
}

/**
 * PNG viewfinder: HardShadow frame + hatch/camera + black corner brackets (+ optional scan line).
 */
function Viewfinder({ colors, children, showScanLine = false, showHatch = true }) {
  const bracketColor = colors.nbBorder;
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.vfShadow}>
      <View
        style={[
          styles.vf,
          {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSoft,
          },
        ]}
      >
        {/* Hatch sits under live camera so PNG still reads when permission/camera fails */}
        {showHatch ? <ViewfinderHatch /> : null}
        <View style={StyleSheet.absoluteFill}>{children}</View>
        <View style={styles.bracketBox} pointerEvents="none">
          <View style={[styles.bracket, styles.tl, { borderColor: bracketColor }]} />
          <View style={[styles.bracket, styles.tr, { borderColor: bracketColor }]} />
          <View style={[styles.bracket, styles.bl, { borderColor: bracketColor }]} />
          <View style={[styles.bracket, styles.br, { borderColor: bracketColor }]} />
          {showScanLine ? (
            <View style={[styles.scanLine, { backgroundColor: bracketColor }]} />
          ) : null}
        </View>
      </View>
    </HardShadow>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Camera + manual UPC scanner that hands a confirmed food back to the daily log.
 * @param {{ onClose?: Function, onScanSuccess?: Function, mealType?: string }} props
 */
export default function BarcodeScannerScreen({ onClose, onScanSuccess, mealType }) {
  const { colors, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [pendingBarcodeFood, setPendingBarcodeFood] = useState(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [missState, setMissState] = useState(null);
  const isProcessingRef = useRef(false);

  const hasPermission = permission?.granted ?? false;
  const permissionUndecided = permission?.status === 'undetermined' || permission == null;

  // vocab: useCameraPermissions = expo-camera hook for grant / deny / undetermined
  useEffect(() => {
    if (!permission) return;
    if (permission.status === 'undetermined') {
      requestPermission().catch((err) => console.warn('Camera permission request failed:', err));
    }
  }, [permission?.status]);

  /**
   * Normalize digits → lookup → cache on hit or show miss UI.
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

  /**
   * Confirm sheet returns (food, mealKey). Prefer sheet meal; fall back to scanner mealType.
   */
  const handleConfirmFood = async (adjustedFood, mealKeyFromSheet) => {
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
    onScanSuccess(adjustedFood, mealKeyFromSheet || mealType);
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

  // Serving confirm (after successful scan) — Design Law Nutrition facts (PNG 13)
  if (pendingBarcodeFood) {
    return (
      <FoodConfirmSheet
        food={pendingBarcodeFood}
        mealType={mealType}
        theme={{ screenBg: colors.nbBackground, isDark }}
        showVerification
        reserveShellBottomNav
        scannedBarcode={pendingBarcodeFood.scannedBarcode || lastScannedBarcode}
        onConfirm={handleConfirmFood}
        onCancel={handleCancelAmount}
        onWrongItem={handleWrongItem}
      />
    );
  }

  // PNG 11/12 — barcode not in database (fill Quick add + plain Search by name)
  if (missState) {
    const suggestions = filterUsableSuggestions(missState.suggestions);
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        {/* Miss header: back + title only (no X) — matches PNG 11 */}
        <ScanHeader title="Scan barcode" onBack={resetScanner} colors={colors} />
        <View style={styles.body}>
          <Viewfinder colors={colors} showScanLine={false} />

          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
            <View
              style={[
                styles.missCard,
                {
                  backgroundColor: colors.nbFill,
                  borderColor: colors.nbBorder,
                },
              ]}
            >
              <Text style={[styles.missKicker, { color: colors.nbOnFill, opacity: 0.7 }]}>
                {missState.variableWeight ? 'STORE SCALE LABEL' : 'BARCODE NOT IN DATABASE'}
              </Text>
              <Text style={[styles.missTitle, { color: colors.nbOnFill }]}>
                {missState.variableWeight
                  ? 'This looks like a store scale label.'
                  : 'This product is not in our food databases yet.'}
              </Text>
              <Text style={[styles.missBody, { color: colors.nbOnFill, opacity: 0.85 }]}>
                {missState.variableWeight
                  ? missState.message
                  : 'Store scale labels do not scan either. Add it yourself in a few seconds.'}
              </Text>
            </View>
          </HardShadow>

          <NbButton variant="fill" onPress={() => onClose?.({ openQuickAdd: true })}>
            Quick add it
          </NbButton>
          <NbButton variant="plain" onPress={() => onClose?.({ openFoodSearch: true })}>
            Search by name
          </NbButton>

          {suggestions.slice(0, MAX_SUGGESTION_CHIPS).map((suggestion) => (
            <TouchableOpacity
              key={suggestion}
              onPress={() => goSearchByName(suggestion)}
              style={[
                styles.suggestionChip,
                { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
              ]}
            >
              <Text style={[styles.suggestionText, { color: colors.nbInk }]} numberOfLines={1}>
                Search: {truncateSuggestionLabel(suggestion)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // Manual entry — Type the number instead
  if (showManualEntry) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        <ScanHeader
          title="Scan barcode"
          onBack={() => setShowManualEntry(false)}
          onClose={onClose}
          colors={colors}
        />
        <View style={styles.body}>
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
            <View
              style={[
                styles.manualCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <Text style={[styles.manualTitle, { color: colors.nbInk }]}>Type the number</Text>
              <Text style={[styles.manualSub, { color: colors.nbMuted }]}>
                Enter the digits under the barcode.
              </Text>
              <TextInput
                style={[
                  styles.barcodeInput,
                  {
                    backgroundColor: colors.nbSurfaceChip,
                    borderColor: colors.nbBorder,
                    color: colors.nbInk,
                  },
                ]}
                placeholder="e.g. 012000504051"
                placeholderTextColor={colors.nbMuted}
                value={manualBarcode}
                onChangeText={setManualBarcode}
                keyboardType="numeric"
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => lookupBarcode(manualBarcode)}
              />
              <NbButton
                variant="fill"
                onPress={() => lookupBarcode(manualBarcode)}
                disabled={loading}
              >
                {loading ? 'Looking up…' : 'Look up'}
              </NbButton>
            </View>
          </HardShadow>
        </View>
      </SafeAreaView>
    );
  }

  if (permissionUndecided) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={colors.nbInk} />
          <Text style={[styles.permissionText, { color: colors.nbInk }]}>
            Requesting camera permission...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        <ScanHeader title="Camera access" onBack={onClose} colors={colors} />
        <View style={styles.permissionContainer}>
          <Text style={[styles.permissionText, { color: colors.nbInk }]}>
            Camera permission is required to scan barcodes. You can still enter the barcode number
            manually.
          </Text>
          {permission?.canAskAgain !== false ? (
            <NbButton variant="fill" onPress={() => requestPermission()}>
              Try again
            </NbButton>
          ) : null}
          <NbButton variant="plain" onPress={() => setShowManualEntry(true)}>
            Type the number instead
          </NbButton>
        </View>
      </SafeAreaView>
    );
  }

  // PNG 09/10 — live camera + status card + Type the number instead
  const statusDigits = lastScannedBarcode || '049000028302';
  const statusTitle = loading ? 'Looking up barcode' : scanned ? 'Hold steady' : 'Point at a barcode';
  const statusSub = loading
    ? `Hold steady. ${spacedBarcode(statusDigits)}`
    : scanned
      ? 'Tap below to scan again'
      : 'Align the bars inside the brackets';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
      <ScanHeader title="Scan barcode" onBack={onClose} onClose={onClose} colors={colors} />

      <View style={styles.body}>
        <Viewfinder colors={colors} showScanLine={loading || !scanned}>
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
          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.nbOnFill} />
            </View>
          ) : null}
        </Viewfinder>

        {/* Status card — NbIconChip scales + Looking up barcode + muted digits */}
        <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
          <View
            style={[
              styles.statusCard,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            <NbIconChip source={SCALES_ICON} size={44} index={2} />
            <View style={styles.statusTextCol}>
              <Text style={[styles.statusTitle, { color: colors.nbInk }]}>{statusTitle}</Text>
              <Text style={[styles.statusSub, { color: colors.nbMuted }]} numberOfLines={2}>
                {statusSub}
              </Text>
            </View>
          </View>
        </HardShadow>

        <NbButton variant="plain" onPress={() => setShowManualEntry(true)}>
          Type the number instead
        </NbButton>

        {scanned && !loading ? (
          <TouchableOpacity
            onPress={() => setScanned(false)}
            style={[styles.rescan, { borderColor: colors.nbBorder }]}
          >
            <Text style={[styles.rescanText, { color: colors.nbInk }]}>Tap to scan again</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // Manipulate here: back / close square size
  sq: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sqSpacer: { width: 44, height: 44 },
  title: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
  },
  body: {
    flex: 1,
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.sm,
    gap: 14,
  },
  vfShadow: { width: '100%' },
  vf: {
    height: VIEWFINDER_HEIGHT,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bracketBox: {
    width: 160,
    height: 110,
    position: 'relative',
  },
  bracket: {
    position: 'absolute',
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
    borderWidth: BRACKET_THICK,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: '42%',
    height: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
  },
  statusTextCol: { flex: 1, minWidth: 0 },
  statusTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  statusSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  missCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
    gap: 8,
  },
  missKicker: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.3,
  },
  missTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  missBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  manualCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 18,
    gap: 12,
  },
  manualTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    textAlign: 'center',
  },
  manualSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  barcodeInput: {
    borderRadius: borderRadius.nbChip,
    padding: spacing.md,
    fontSize: 18,
    textAlign: 'center',
    borderWidth: nb.borderWidth,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    gap: 14,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  suggestionChip: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbChip,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  suggestionText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  rescan: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbChip,
  },
  rescanText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
});
