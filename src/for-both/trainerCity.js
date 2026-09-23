/**
 * Trainer city/location helpers — lazy-loads expo-location so app startup
 * does not crash when the native ExpoLocation module is missing from a dev build.
 */
import { Alert, Linking } from 'react-native';

/** Lazy-load so app startup does not require the native ExpoLocation module. */
async function getLocationModule() {
  try {
    return await import('expo-location');
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('ExpoLocation') || msg.includes('native module')) {
      throw new Error(
        'Location requires a native rebuild. Run: npx expo run:ios (or rebuild your dev client), then try again.',
      );
    }
    throw e;
  }
}

export async function ensureLocationPermission() {
  const Location = await getLocationModule();
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === 'granted') return true;

  const req = await Location.requestForegroundPermissionsAsync();
  if (req.status === 'granted') return true;

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

/** @returns {{ city: string, region?: string, country?: string } | null} */
export async function resolveCurrentTrainerLocation() {
  const Location = await getLocationModule();
  const ok = await ensureLocationPermission();
  if (!ok) return null;

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const results = await Location.reverseGeocodeAsync({
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
  });
  const place = results?.[0];
  if (!place) return null;

  const city = place.city || place.subregion || place.district || place.name || '';
  if (!city) return null;

  return {
    city: String(city).trim(),
    region: place.region ? String(place.region).trim() : undefined,
    country: place.country ? String(place.country).trim() : undefined,
  };
}
