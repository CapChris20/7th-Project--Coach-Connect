// Design Law barcode scan (PNG 09–12): hatched viewfinder → lookup card → confirm or miss CTAs.
// Flow: camera permission → scan / type digits → searchFoods.lookupBarcode → FoodConfirmSheet or miss.
// Used by DailyLogContent when the user taps Scan on a meal / food search.
// Read order: constants → layout pieces → screen recipe → lookup/display PLUMBING.
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

const DEMO_BARCODE_DIGITS = '049000028302';
const CAMERA_FACING_BACK = 'back';
const BARCODE_TYPES_WE_SCAN = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'];

// ===== HELPER FUNCTIONS =====
// Layout subcomponents (no scanner state).

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
  const stripeFill = colors.nbSoft;
  const stripeAltFill = colors.nbSurfaceChip || colors.nbSurface;

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
          <Rect x={0} y={0} width={HATCH_STRIPE_PX} height={patternSize} fill={stripeFill} />
          <Rect
            x={HATCH_STRIPE_PX}
            y={0}
            width={HATCH_STRIPE_PX}
            height={patternSize}
            fill={stripeAltFill}
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
  const titleAlign = centerTitle ? 'center' : 'left';
  const hasCloseButton = typeof onClose === 'function';

  let trailingSlot = <View style={styles.sqSpacer} />;
  if (hasCloseButton) {
    trailingSlot = (
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
    );
  }

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
        style={[styles.title, { color: colors.nbInk, textAlign: titleAlign }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {trailingSlot}
    </View>
  );
}

/**
 * PNG viewfinder: HardShadow frame + hatch/camera + black corner brackets (+ optional scan line).
 */
function Viewfinder({ colors, children, showScanLine = false, showHatch = true }) {
  const bracketColor = colors.nbBorder;

  let hatchLayer = null;
  if (showHatch) {
    hatchLayer = <ViewfinderHatch />;
  }

  let scanLine = null;
  if (showScanLine) {
    scanLine = <View style={[styles.scanLine, { backgroundColor: bracketColor }]} />;
  }

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
        {hatchLayer}
        <View style={StyleSheet.absoluteFill}>{children}</View>
        <View style={styles.bracketBox} pointerEvents="none">
          <View style={[styles.bracket, styles.tl, { borderColor: bracketColor }]} />
          <View style={[styles.bracket, styles.tr, { borderColor: bracketColor }]} />
          <View style={[styles.bracket, styles.bl, { borderColor: bracketColor }]} />
          <View style={[styles.bracket, styles.br, { borderColor: bracketColor }]} />
          {scanLine}
        </View>
      </View>
    </HardShadow>
  );
}

/**
 * PNG 11/12 — product not in database (Quick add + Search by name + optional chips).
 */
function MissNotFoundLayout({
  colors,
  missState,
  suggestionChips,
  onBack,
  onQuickAdd,
  onSearchByName,
  onSuggestionPress,
}) {
  const isVariableWeight = Boolean(missState.variableWeight);

  let missKicker = 'BARCODE NOT IN DATABASE';
  let missTitle = 'This product is not in our food databases yet.';
  let missBody = 'Store scale labels do not scan either. Add it yourself in a few seconds.';
  if (isVariableWeight) {
    missKicker = 'STORE SCALE LABEL';
    missTitle = 'This looks like a store scale label.';
    missBody = missState.message;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
      <ScanHeader title="Scan barcode" onBack={onBack} colors={colors} />
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
              {missKicker}
            </Text>
            <Text style={[styles.missTitle, { color: colors.nbOnFill }]}>{missTitle}</Text>
            <Text style={[styles.missBody, { color: colors.nbOnFill, opacity: 0.85 }]}>
              {missBody}
            </Text>
          </View>
        </HardShadow>

        <NbButton variant="fill" onPress={onQuickAdd}>
          Quick add it
        </NbButton>
        <NbButton variant="plain" onPress={onSearchByName}>
          Search by name
        </NbButton>

        {suggestionChips.map((suggestion) => (
          <TouchableOpacity
            key={suggestion}
            onPress={() => onSuggestionPress(suggestion)}
            style={[
              styles.suggestionChip,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
            ]}
          >
            <Text style={[styles.suggestionText, { color: colors.nbInk }]} numberOfLines={1}>
              Search: {shortenSuggestionChipLabel(suggestion)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

/**
 * Manual digit entry — Type the number instead.
 */
function ManualEntryLayout({
  colors,
  manualBarcode,
  setManualBarcode,
  loading,
  onBack,
  onClose,
  onLookup,
}) {
  let lookupButtonLabel = 'Look up';
  if (loading) {
    lookupButtonLabel = 'Looking up…';
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
      <ScanHeader title="Scan barcode" onBack={onBack} onClose={onClose} colors={colors} />
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
              onSubmitEditing={onLookup}
            />
            <NbButton variant="fill" onPress={onLookup} disabled={loading}>
              {lookupButtonLabel}
            </NbButton>
          </View>
        </HardShadow>
      </View>
    </SafeAreaView>
  );
}

/**
 * Waiting on the OS permission prompt.
 */
function PermissionPendingLayout({ colors }) {
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

/**
 * Camera denied — still offer manual entry.
 */
function CameraDeniedLayout({
  colors,
  canAskAgain,
  onBack,
  onTryAgain,
  onTypeInstead,
}) {
  let tryAgainButton = null;
  if (canAskAgain) {
    tryAgainButton = (
      <NbButton variant="fill" onPress={onTryAgain}>
        Try again
      </NbButton>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
      <ScanHeader title="Camera access" onBack={onBack} colors={colors} />
      <View style={styles.permissionContainer}>
        <Text style={[styles.permissionText, { color: colors.nbInk }]}>
          Camera permission is required to scan barcodes. You can still enter the barcode number
          manually.
        </Text>
        {tryAgainButton}
        <NbButton variant="plain" onPress={onTypeInstead}>
          Type the number instead
        </NbButton>
      </View>
    </SafeAreaView>
  );
}

/**
 * Forward a camera barcode event only when the result has digit data.
 */
function forwardBarcodeScanIfPresent(result, onBarcodeScanned) {
  if (!result) return;
  if (!result.data) return;
  onBarcodeScanned({ type: result.type, data: result.data });
}

/**
 * PNG 09/10 — live camera + status card + Type the number instead.
 */
function LiveScanLayout({
  colors,
  loading,
  scanned,
  statusCopy,
  onClose,
  onBarcodeScanned,
  onTypeInstead,
  onRescan,
}) {
  const showScanLine = loading || !scanned;
  const showRescanHint = scanned && !loading;

  // Freeze barcode listener while a lookup is in flight / already scanned once.
  let barcodeScanHandler = undefined;
  if (!scanned) {
    barcodeScanHandler = (result) => {
      forwardBarcodeScanIfPresent(result, onBarcodeScanned);
    };
  }

  let loadingOverlay = null;
  if (loading) {
    loadingOverlay = (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={colors.nbOnFill} />
      </View>
    );
  }

  let rescanHint = null;
  if (showRescanHint) {
    rescanHint = (
      <TouchableOpacity
        onPress={onRescan}
        style={[styles.rescan, { borderColor: colors.nbBorder }]}
      >
        <Text style={[styles.rescanText, { color: colors.nbInk }]}>Tap to scan again</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]}>
      <ScanHeader title="Scan barcode" onBack={onClose} onClose={onClose} colors={colors} />

      <View style={styles.body}>
        <Viewfinder colors={colors} showScanLine={showScanLine}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing={CAMERA_FACING_BACK}
            barcodeScannerSettings={{
              barcodeTypes: BARCODE_TYPES_WE_SCAN,
            }}
            onBarcodeScanned={barcodeScanHandler}
          />
          {loadingOverlay}
        </Viewfinder>

        <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
          <View
            style={[
              styles.statusCard,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            <NbIconChip source={SCALES_ICON} size={44} index={2} />
            <View style={styles.statusTextCol}>
              <Text style={[styles.statusTitle, { color: colors.nbInk }]}>
                {statusCopy.statusTitle}
              </Text>
              <Text style={[styles.statusSub, { color: colors.nbMuted }]} numberOfLines={2}>
                {statusCopy.statusSub}
              </Text>
            </View>
          </View>
        </HardShadow>

        <NbButton variant="plain" onPress={onTypeInstead}>
          Type the number instead
        </NbButton>

        {rescanHint}
      </View>
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Barcode scan screen: permission → live/manual scan → lookup → confirm or miss.
 * @param {{ onClose?: Function, onScanSuccess?: Function, mealType?: string }} props
 */
export default function BarcodeScannerScreen({ onClose, onScanSuccess, mealType }) {
  // Hook order frozen — do not reorder these.
  const { colors, isDark } = useTheme();
  // vocab: useCameraPermissions = expo-camera hook for grant / deny / undetermined
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [pendingBarcodeFood, setPendingBarcodeFood] = useState(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState('');
  const [missState, setMissState] = useState(null);
  const isProcessingRef = useRef(false);

  const hasPermission = cameraPermissionIsGranted(permission);
  const permissionUndecided = cameraPermissionIsUndecided(permission);
  const permissionStatus = cameraPermissionStatus(permission);

  // 1. Ask the OS for camera access when status is still undecided.
  useEffect(() => {
    if (!permission) return;
    if (permission.status === 'undetermined') {
      requestPermission().catch((err) => console.warn('Camera permission request failed:', err));
    }
  }, [permissionStatus]);

  /**
   * Normalize digits → lookup → cache on hit or show miss UI.
   * @param {string} barcode
   */
  const lookupBarcode = async (barcode) => {
    // 1. Normalize digits and reject too-short codes before we touch the network.
    const normalizedDigits = fixBarcodeDigits(barcode);
    const digitsTooShort =
      !normalizedDigits || normalizedDigits.length < MIN_BARCODE_DIGITS;
    if (digitsTooShort) {
      Alert.alert('Invalid Barcode', 'Please enter a valid barcode number');
      return;
    }
    if (loading) return;

    // 2. Lock the UI into "lookup in flight" — clear any prior miss card.
    setLoading(true);
    setScanned(true);
    setMissState(null);

    try {
      console.log('Looking up barcode:', normalizedDigits);
      setLastScannedBarcode(normalizedDigits);

      // 3. Ask searchFoods for this GTIN / UPC.
      const lookupRaw = await searchFoods.lookupBarcode(normalizedDigits);
      const lookupSummary = summarizeBarcodeLookupForScreen(lookupRaw, normalizedDigits);

      // 4. Hit → warm cache best-effort, then open the confirm sheet.
      if (lookupSummary.success && lookupSummary.data) {
        await cacheScannedProductWithoutBlocking(lookupSummary.data);
        setPendingBarcodeFood(lookupSummary.data);
        return;
      }

      // 5. Miss → show Design Law miss state with optional name-search chips.
      setMissState({
        barcode: normalizedDigits,
        message: lookupSummary.error || 'Product not found.',
        variableWeight: lookupSummary.variableWeight,
        suggestions: suggestionStringsFromLookup(lookupSummary.suggestedSearch),
      });
    } catch (lookupError) {
      console.error('Barcode lookup error:', lookupError);
      setMissState({
        barcode: normalizedDigits,
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
    callOnCloseIfPresent(onClose, { searchQuery: trimmedQuery });
  };

  const resetScanner = () => {
    setMissState(null);
    setPendingBarcodeFood(null);
    setScanned(false);
    setManualBarcode('');
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    // 1. Guard against double-fires while a lookup is already running.
    const alreadyBusy = isProcessingRef.current || scanned || loading;
    if (alreadyBusy) return;

    // 2. Lock the ref, run lookup, unlock even if lookup throws.
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
    // 1. Need both a confirmed food and a success callback.
    if (!adjustedFood || !onScanSuccess) return;

    // 2. Persist verified barcode best-effort so the next scan hits faster.
    const gtin = pickGtinForVerifiedSave(
      adjustedFood,
      lastScannedBarcode,
      pendingBarcodeFood,
    );
    if (gtin) {
      try {
        await searchFoods.saveVerifiedBarcode(gtin, adjustedFood);
      } catch (error) {
        console.warn('Failed to save verified barcode:', messageFromError(error));
      }
    }

    // 3. Hand food + meal back to the daily log, then close this screen.
    const mealKeyToUse = mealKeyFromSheet || mealType;
    onScanSuccess(adjustedFood, mealKeyToUse);
    if (onClose) onClose();
  };

  const handleWrongItem = () => {
    const nameFromFood = nameOrBrandFromFood(pendingBarcodeFood);
    setPendingBarcodeFood(null);
    setScanned(false);
    const searchQuery = nameFromFood || FALLBACK_WRONG_ITEM_SEARCH;
    goSearchByName(searchQuery);
  };

  const handleCancelAmount = () => {
    setPendingBarcodeFood(null);
    setScanned(false);
  };

  const openQuickAddFromMiss = () => {
    callOnCloseIfPresent(onClose, { openQuickAdd: true });
  };
  const openFoodSearchFromMiss = () => {
    callOnCloseIfPresent(onClose, { openFoodSearch: true });
  };
  const leaveManualEntry = () => setShowManualEntry(false);
  const openManualEntry = () => setShowManualEntry(true);
  const lookupTypedBarcode = () => lookupBarcode(manualBarcode);
  const clearScannedFlag = () => setScanned(false);
  const askCameraAgain = () => requestPermission();

  // Serving confirm (after successful scan) — Design Law Nutrition facts (PNG 13)
  if (pendingBarcodeFood) {
    const scannedBarcodeForSheet =
      pendingBarcodeFood.scannedBarcode || lastScannedBarcode;
    return (
      <FoodConfirmSheet
        food={pendingBarcodeFood}
        mealType={mealType}
        theme={{ screenBg: colors.nbBackground, isDark }}
        showVerification
        reserveShellBottomNav
        scannedBarcode={scannedBarcodeForSheet}
        onConfirm={handleConfirmFood}
        onCancel={handleCancelAmount}
        onWrongItem={handleWrongItem}
      />
    );
  }

  // PNG 11/12 — barcode not in database
  if (missState) {
    const suggestionChips = dropJunkSuggestions(missState.suggestions).slice(
      0,
      MAX_SUGGESTION_CHIPS,
    );
    return (
      <MissNotFoundLayout
        colors={colors}
        missState={missState}
        suggestionChips={suggestionChips}
        onBack={resetScanner}
        onQuickAdd={openQuickAddFromMiss}
        onSearchByName={openFoodSearchFromMiss}
        onSuggestionPress={goSearchByName}
      />
    );
  }

  // Manual entry — Type the number instead
  if (showManualEntry) {
    return (
      <ManualEntryLayout
        colors={colors}
        manualBarcode={manualBarcode}
        setManualBarcode={setManualBarcode}
        loading={loading}
        onBack={leaveManualEntry}
        onClose={onClose}
        onLookup={lookupTypedBarcode}
      />
    );
  }

  if (permissionUndecided) {
    return <PermissionPendingLayout colors={colors} />;
  }

  if (!hasPermission) {
    // canAskAgain !== false keeps the Try again button when the field is missing (same as before)
    const canAskAgain = cameraAllowsAskAgain(permission);
    return (
      <CameraDeniedLayout
        colors={colors}
        canAskAgain={canAskAgain}
        onBack={onClose}
        onTryAgain={askCameraAgain}
        onTypeInstead={openManualEntry}
      />
    );
  }

  // PNG 09/10 — live camera + status card
  const demoOrLastDigits = lastScannedBarcode || DEMO_BARCODE_DIGITS;
  const statusCopy = buildLiveScanStatusCopy(loading, scanned, demoOrLastDigits);

  return (
    <LiveScanLayout
      colors={colors}
      loading={loading}
      scanned={scanned}
      statusCopy={statusCopy}
      onClose={onClose}
      onBarcodeScanned={handleBarCodeScanned}
      onTypeInstead={openManualEntry}
      onRescan={clearScannedFlag}
    />
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * True when expo-camera says the user granted access.
 * @param {object|null|undefined} permission
 * @returns {boolean}
 */
function cameraPermissionIsGranted(permission) {
  if (!permission) return false;
  if (permission.granted) return true;
  return false;
}

/**
 * True when we have not asked yet, or the hook has not returned a value.
 * @param {object|null|undefined} permission
 * @returns {boolean}
 */
function cameraPermissionIsUndecided(permission) {
  if (permission == null) return true;
  if (permission.status === 'undetermined') return true;
  return false;
}

/**
 * Status string for the permission effect dependency (undefined when no object yet).
 * @param {object|null|undefined} permission
 * @returns {string|undefined}
 */
function cameraPermissionStatus(permission) {
  if (permission == null) return undefined;
  return permission.status;
}

/**
 * Show "Try again" unless the OS explicitly says we cannot ask again.
 * @param {object|null|undefined} permission
 * @returns {boolean}
 */
function cameraAllowsAskAgain(permission) {
  if (!permission) return true;
  if (permission.canAskAgain === false) return false;
  return true;
}

/**
 * Call onClose with a payload only when the parent passed a function.
 * @param {Function|undefined} onClose
 * @param {object} payload
 */
function callOnCloseIfPresent(onClose, payload) {
  if (typeof onClose !== 'function') return;
  onClose(payload);
}

/**
 * Prefer adjusted food GTIN, then last scan, then pending confirm food.
 * @param {object} adjustedFood
 * @param {string} lastScannedBarcode
 * @param {object|null} pendingBarcodeFood
 * @returns {string}
 */
function pickGtinForVerifiedSave(adjustedFood, lastScannedBarcode, pendingBarcodeFood) {
  if (adjustedFood.scannedBarcode) return adjustedFood.scannedBarcode;
  if (lastScannedBarcode) return lastScannedBarcode;
  if (pendingBarcodeFood && pendingBarcodeFood.scannedBarcode) {
    return pendingBarcodeFood.scannedBarcode;
  }
  return '';
}

/**
 * Prefer product name, then brand, for "wrong item" search.
 * @param {object|null} food
 * @returns {string}
 */
function nameOrBrandFromFood(food) {
  if (!food) return '';
  if (food.name) return food.name;
  if (food.brand) return food.brand;
  return '';
}

/**
 * Prefer error.message when present; otherwise the error itself.
 * @param {*} error
 * @returns {*}
 */
function messageFromError(error) {
  if (error && error.message) return error.message;
  return error;
}

/**
 * Status card title + subtitle for the live camera screen (no nested ternaries in JSX).
 * @param {boolean} loading
 * @param {boolean} scanned
 * @param {string} digitsForDisplay
 * @returns {{ statusTitle: string, statusSub: string }}
 */
function buildLiveScanStatusCopy(loading, scanned, digitsForDisplay) {
  if (loading) {
    const spacedDigits = formatBarcodeDigitsForDisplay(digitsForDisplay);
    return {
      statusTitle: 'Looking up barcode',
      statusSub: `Hold steady. ${spacedDigits}`,
    };
  }
  if (scanned) {
    return {
      statusTitle: 'Hold steady',
      statusSub: 'Tap below to scan again',
    };
  }
  return {
    statusTitle: 'Point at a barcode',
    statusSub: 'Align the bars inside the brackets',
  };
}

/**
 * Shape searchFoods.lookupBarcode output into success/miss for the UI.
 * @param {object|null} raw
 * @param {string} normalized
 */
function summarizeBarcodeLookupForScreen(raw, normalized) {
  const foundProduct = raw && !raw.notFound && !raw.variableWeightBarcode;
  if (foundProduct) {
    return { success: true, data: { ...raw, scannedBarcode: normalized } };
  }

  let isVariableWeightLabel = false;
  if (raw && raw.variableWeightBarcode) {
    isVariableWeightLabel = true;
  }

  let missMessage = 'This product is not in our food databases yet.';
  if (isVariableWeightLabel) {
    missMessage = raw.message;
  }

  let suggestedSearch = [];
  if (raw && raw.suggestedSearchQueries) {
    suggestedSearch = raw.suggestedSearchQueries;
  }

  return {
    success: false,
    error: missMessage,
    variableWeight: isVariableWeightLabel,
    suggestedSearch: suggestedSearch,
    scannedBarcode: normalized,
  };
}

/**
 * Warm the local product cache; never block the confirm sheet on cache failure.
 * @param {object} productData
 * @returns {Promise<void>}
 */
async function cacheScannedProductWithoutBlocking(productData) {
  try {
    await cacheFoodProduct(productData);
  } catch (cacheError) {
    console.warn('Failed to cache product:', cacheError);
  }
}

/**
 * @param {*} suggestedSearch
 * @returns {string[]}
 */
function suggestionStringsFromLookup(suggestedSearch) {
  if (Array.isArray(suggestedSearch)) return suggestedSearch;
  if (suggestedSearch) return [suggestedSearch];
  return [];
}

/**
 * Drop GS1 / tracker junk labels from miss-state chips.
 * @param {string[]} suggestions
 * @returns {string[]}
 */
function dropJunkSuggestions(suggestions) {
  const safeList = suggestions || [];
  const kept = [];
  for (let i = 0; i < safeList.length; i += 1) {
    const suggestion = safeList[i];
    if (!suggestion) continue;
    const looksLikeJunk = JUNK_SUGGESTION_PATTERN.test(String(suggestion));
    if (looksLikeJunk) continue;
    kept.push(suggestion);
  }
  return kept;
}

/**
 * @param {string} label
 * @returns {string}
 */
function shortenSuggestionChipLabel(label) {
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
function formatBarcodeDigitsForDisplay(digits) {
  const digitsOnly = String(digits || '').replace(/\D/g, '');
  if (digitsOnly.length < 8) return digitsOnly;

  // Manipulate here: grouping for UPC-A style display
  if (digitsOnly.length === 12) {
    return `${digitsOnly[0]} ${digitsOnly.slice(1, 6)} ${digitsOnly.slice(6, 11)} ${digitsOnly[11]}`;
  }
  return digitsOnly.replace(/(.{4})/g, '$1 ').trim();
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
