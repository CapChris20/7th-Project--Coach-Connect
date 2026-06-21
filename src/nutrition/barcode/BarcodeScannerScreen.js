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
  const [amountValue, setAmountValue] = useState('');
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
    
    try {
      console.log('Looking up barcode:', normalized);
      const raw = await searchFoodsService.lookupBarcode(normalized);
      const isFoodHit = raw && !raw.notFound && !raw.variableWeightBarcode;
      const result = isFoodHit
        ? { success: true, data: raw }
        : {
            success: false,
            error: raw?.variableWeightBarcode
              ? raw.message
              : 'Product not found',
            variableWeight: !!raw?.variableWeightBarcode,
            suggestedSearch: raw?.suggestedSearchQueries?.[0] || null,
          };
      
      if (result.success && result.data) {
        // Cache the product for future use
        try {
          await cacheFoodProduct(result.data);
        } catch (cacheError) {
          console.warn('Failed to cache product:', cacheError);
        }
        // Show amount-adjust step instead of logging immediately
        const defaultAmount = Number(result.data.servingGrams) || 100;
        setPendingBarcodeFood(result.data);
        setAmountValue(String(Math.round(defaultAmount)));
      } else {
        const title = result.variableWeight ? 'Store scale label' : 'Product Not Found';
        const message =
          result.error
          || 'This barcode was not found in our database. Please try searching by name instead.';
        const buttons = [
          { text: 'Try Again', onPress: () => { setScanned(false); setManualBarcode(''); } },
          { text: 'Cancel', onPress: onClose, style: 'cancel' },
        ];
        if (result.variableWeight && result.suggestedSearch) {
          buttons.unshift({
            text: 'Search by name',
            onPress: () => {
              setScanned(false);
              setManualBarcode('');
              onClose?.({ searchQuery: result.suggestedSearch });
            },
          });
        }
        Alert.alert(title, message, buttons);
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      Alert.alert(
        'Error',
        'Failed to look up barcode. Please check your connection and try again.',
        [
          { text: 'Try Again', onPress: () => { setScanned(false); setManualBarcode(''); } },
          { text: 'Cancel', onPress: onClose, style: 'cancel' },
        ]
      );
    } finally {
      setLoading(false);
    }
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

  const handleConfirmAmount = () => {
    if (!pendingBarcodeFood || !onScanSuccess) return;
    const defaultAmount = Number(pendingBarcodeFood.servingGrams) || 100;
    const num = (v) => (v === '' || v == null) ? null : Number(String(v).replace(',', '.'));
    const entered = num(amountValue);
    const multiplier = (entered != null && !Number.isNaN(entered) && entered > 0)
      ? Math.min(10, Math.max(0.01, entered / defaultAmount))
      : 1;
    const adjustedFood = {
      ...pendingBarcodeFood,
      servingSize: (pendingBarcodeFood.servingSize ?? 1) * multiplier,
      servingGrams: Math.round((pendingBarcodeFood.servingGrams || defaultAmount) * multiplier),
    };
    onScanSuccess(adjustedFood, mealType);
    if (onClose) onClose();
  };

  const handleCancelAmount = () => {
    setPendingBarcodeFood(null);
    setAmountValue('');
    setScanned(false);
  };

  // Amount-adjust step (after successful scan)
  const renderAmountStep = () => {
    if (!pendingBarcodeFood) return null;
    const defaultAmount = Math.round(Number(pendingBarcodeFood.servingGrams) || 100);
    const unit = (pendingBarcodeFood.servingUnit || 'grams').toLowerCase();
    const unitLabel = unit === 'ml' ? 'ml' : 'g';
    const defaultCals = Math.round(
      (Number(pendingBarcodeFood.calories) || 0) * (Number(pendingBarcodeFood.servingSize) || 1)
    );
    const num = (v) => (v === '' || v == null) ? null : Number(String(v).replace(',', '.'));
    const entered = num(amountValue);
    const multiplier = (entered != null && !Number.isNaN(entered) && entered > 0)
      ? Math.min(10, Math.max(0.01, entered / defaultAmount))
      : 1;
    const estimatedCals = Math.round(defaultCals * multiplier);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancelAmount} style={[styles.closeButton, { minWidth: 60, alignItems: 'flex-start' }]}>
            <Text style={styles.closeText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Adjust amount</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.amountStepContent}>
          <Text style={styles.amountProductName} numberOfLines={2}>{pendingBarcodeFood.name}</Text>
          <Text style={styles.amountDefaultText}>
            Default: {defaultAmount} {unitLabel} ({defaultCals} cal)
          </Text>
          <Text style={styles.amountLabel}>Amount you had ({unitLabel})</Text>
          <TextInput
            style={styles.amountInput}
            placeholder={String(defaultAmount)}
            placeholderTextColor="#9CA3AF"
            value={amountValue}
            onChangeText={setAmountValue}
            keyboardType="decimal-pad"
          />
          <Text style={styles.amountEstimated}>≈ {estimatedCals} cal will be logged</Text>
          <TouchableOpacity style={styles.logButton} onPress={handleConfirmAmount} activeOpacity={0.9}>
            <LinearGradient
              colors={[t.hotPink, t.orange]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ padding: 14, alignItems: 'center' }}
            >
              <Text style={styles.logButtonText}>Log it</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelAmount}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  };

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

  if (pendingBarcodeFood) {
    return renderAmountStep();
  }

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

