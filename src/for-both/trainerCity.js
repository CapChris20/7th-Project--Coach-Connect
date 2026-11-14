// Current city for a trainer, loaded only when a screen asks for it.
// Flow: lazy import expo-location → permission → GPS fix → reverse-geocode → city label.
// Used by trainer setup when the form offers "use my current city".

import { Alert, Linking } from 'react-native';

// ===== NAMED CONSTANTS =====

// Manipulate here: message when the dev client was built without the native location module
const LOCATION_REBUILD_MESSAGE =
  'Location requires a native rebuild. Run: npx expo run:ios (or rebuild your dev client), then try again.';

const PERMISSION_GRANTED = 'granted';

// ===== MAIN FUNCTION =====

/**
 * Ask for foreground location if it is not already granted. Opens Settings when the user says no.
 * @returns {Promise<boolean>} True when the app may read the current position.
 */
export async function ensureLocationPermission() {
  // 1. Load expo-location only when someone needs city (keeps boot safe without native module).
  const Location = await loadExpoLocationModule();

  // 2. Already granted — skip the system prompt.
  const currentPermission = await Location.getForegroundPermissionsAsync();
  if (currentPermission.status === PERMISSION_GRANTED) {
    return true;
  }

  // 3. Show the OS permission dialog once.
  const permissionRequest = await Location.requestForegroundPermissionsAsync();
  if (permissionRequest.status === PERMISSION_GRANTED) {
    return true;
  }

  // 4. User denied — explain and offer Settings.
  openLocationSettingsAlert();
  return false;
}

/**
 * GPS fix plus a city label. Null when permission is denied or the geocoder returns no place.
 * @returns {Promise<{ city: string, region?: string, country?: string } | null>}
 */
export async function resolveCurrentTrainerLocation() {
  // 1. Same lazy load as permission — fail only when city is requested.
  const Location = await loadExpoLocationModule();

  // 2. No permission — stop before GPS or geocoder calls.
  const hasPermission = await ensureLocationPermission();
  if (!hasPermission) {
    return null;
  }

  // 3. Read device coordinates (Balanced = city-level accuracy, not survey-grade GPS).
  // vocab: Balanced = expo-location accuracy preset between Low and High
  const devicePosition = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const latitude = devicePosition.coords.latitude;
  const longitude = devicePosition.coords.longitude;

  // 4. Reverse-geocode the fix into address rows (first row is usually the best match).
  // vocab: reverseGeocodeAsync = lat/lng → place objects with city / region / country fields
  const places = await Location.reverseGeocodeAsync({ latitude, longitude });
  const bestPlace = places && places[0] ? places[0] : null;
  if (!bestPlace) {
    return null;
  }

  // 5. Pick a human city label — field names differ by country.
  const cityLabel = pickCityLabelFromPlace(bestPlace);
  if (!cityLabel) {
    return null;
  }

  // 6. Trim strings so the setup form gets stable values.
  return {
    city: String(cityLabel).trim(),
    region: trimOptionalPlaceField(bestPlace.region),
    country: trimOptionalPlaceField(bestPlace.country),
  };
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging =====

// vocab: dynamic import() loads expo-location at call time, not app startup.
// Why: a JS-only dev build can still open screens; we only fail when city is requested.
async function loadExpoLocationModule() {
  try {
    return await import('expo-location');
  } catch (loadError) {
    const errorMessage = String(loadError?.message || loadError);
    if (nativeLocationModuleIsMissing(errorMessage)) {
      throw new Error(LOCATION_REBUILD_MESSAGE);
    }
    throw loadError;
  }
}

function nativeLocationModuleIsMissing(errorMessage) {
  const mentionsExpoLocation = errorMessage.includes('ExpoLocation');
  const mentionsNativeModule = errorMessage.includes('native module');
  return mentionsExpoLocation || mentionsNativeModule;
}

// Geocoder rows use city, subregion, district, or name depending on locale — first non-empty wins.
function pickCityLabelFromPlace(place) {
  if (place.city) return place.city;
  if (place.subregion) return place.subregion;
  if (place.district) return place.district;
  if (place.name) return place.name;
  return '';
}

function trimOptionalPlaceField(rawValue) {
  if (!rawValue) return undefined;
  return String(rawValue).trim();
}

function openLocationSettingsAlert() {
  Alert.alert(
    'Location permission needed',
    'Enable location in Settings to use your current city.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings?.() },
    ],
  );
}
