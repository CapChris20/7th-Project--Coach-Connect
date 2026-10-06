// Current city for a trainer, loaded only when a screen asks for it.
// Flow: import expo-location → ask permission → read GPS → reverse-geocode to city, region, country.
// Used by trainer setup when the form offers "use my current city".

import { Alert, Linking } from 'react-native';

// ===== NAMED CONSTANTS =====

const LOCATION_REBUILD_MESSAGE =
  'Location requires a native rebuild. Run: npx expo run:ios (or rebuild your dev client), then try again.';

// ===== HELPER FUNCTIONS =====

// vocab: import() = load the package when this runs, not at startup. A dev build without the native
// module can still boot; the crash only happens if someone actually requests the city.
function isMissingNativeLocationModule(errorMessage) {
  return errorMessage.includes('ExpoLocation') || errorMessage.includes('native module');
}

async function getLocationModule() {
  try {
    return await import('expo-location');
  } catch (loadError) {
    const errorMessage = String(loadError?.message || loadError);
    if (isMissingNativeLocationModule(errorMessage)) {
      throw new Error(LOCATION_REBUILD_MESSAGE);
    }
    throw loadError;
  }
}

// City can live on different fields depending on the country. First non-empty wins.
function cityLabelFromPlace(place) {
  return place.city || place.subregion || place.district || place.name || '';
}

function trimmedPlaceField(value) {
  if (!value) return undefined;
  return String(value).trim();
}

// ===== MAIN FUNCTION =====

/**
 * Ask for foreground location if it is not already granted. Opens Settings when the user says no.
 * @returns {Promise<boolean>} True when the app may read the current position.
 */
export async function ensureLocationPermission() {
  const Location = await getLocationModule();
  const currentPermission = await Location.getForegroundPermissionsAsync();
  if (currentPermission.status === 'granted') return true;

  const permissionRequest = await Location.requestForegroundPermissionsAsync();
  if (permissionRequest.status === 'granted') return true;

  Alert.alert(
    'Location permission needed',
    'Enable location in Settings to use your current city.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings?.() },
    ],
  );
  return false;
}

/**
 * GPS fix plus a city label. Null when permission is denied or the geocoder returns no place.
 * @returns {Promise<{ city: string, region?: string, country?: string } | null>}
 */
export async function resolveCurrentTrainerLocation() {
  const Location = await getLocationModule();
  const hasPermission = await ensureLocationPermission();
  if (!hasPermission) return null;

  // vocab: Balanced = a city-level fix, not the highest-accuracy GPS mode.
  const devicePosition = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const places = await Location.reverseGeocodeAsync({
    latitude: devicePosition.coords.latitude,
    longitude: devicePosition.coords.longitude,
  });
  const place = places?.[0];
  if (!place) return null;

  const cityLabel = cityLabelFromPlace(place);
  if (!cityLabel) return null;

  return {
    city: String(cityLabel).trim(),
    region: trimmedPlaceField(place.region),
    country: trimmedPlaceField(place.country),
  };
}
