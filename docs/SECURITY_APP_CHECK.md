# Firebase App Check (TODO)

Enable App Check to reduce abuse of Firestore and API endpoints with stolen ID tokens.

1. Firebase Console → App Check → register iOS/Android apps (Play Integrity / DeviceCheck).
2. Enforce App Check for Firestore, Storage, and Callable Functions when ready.
3. Client: install `@react-native-firebase/app-check` or Expo-compatible App Check module and call `initializeAppCheck()` after Firebase init in `src/app/config.js`.
4. Server: verify App Check tokens on sensitive HTTP routes if using the App Check REST API.

Until enforced, all routes rely on Firebase ID token auth only.
