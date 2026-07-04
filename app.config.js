const path = require('path');
// Ensure root .env is loaded when evaluating config (so REACT_NATIVE_* / YOUTUBE_* reach `extra`).
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
  /* optional dep path */
}

module.exports = {
  expo: {
    name: 'Coach Connect',
    slug: 'anatrox-app',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    scheme: 'coachconnect',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    plugins: [
      ['expo-camera', { cameraPermission: 'Allow Coach Connect to access your camera for progress photos and barcode scanning.' }],
      ['expo-image-picker', {
        photosPermission: 'Allow Coach Connect to access your photos to add images to chats.',
        cameraPermission: 'Allow Coach Connect to take photos for progress tracking.',
      }],
      'expo-asset',
      'expo-font',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#FF6B9D',
          defaultChannel: 'default',
        }
      ],
      'expo-iap',
      'expo-apple-authentication',
      [
        '@stripe/stripe-react-native',
        {
          merchantIdentifier: 'merchant.com.coachconnect',
        },
      ],
      [
        'expo-speech-recognition',
        {
          microphonePermission:
            'Allow Coach Connect to use the microphone so you can talk to your AI Coach.',
          speechRecognitionPermission:
            'Allow Coach Connect to transcribe your voice for AI Coach messages.',
        },
      ],
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.coachconnect',
      buildNumber: '1',
      /** Apple Developer Team — required for device builds & IAP. */
      appleTeamId: 'PFTT3AW4H3',
      icon: './assets/icon.png',
      usesAppleSignIn: true,
      entitlements: {
        'aps-environment':
          process.env.EAS_BUILD_PROFILE === 'development' ? 'development' : 'production',
      },
      infoPlist: {
        // Export compliance: app only uses HTTPS/TLS via iOS (Firebase, API, etc.) — no custom crypto.
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'This app uses the camera for progress photos and barcode scanning.',
        NSMicrophoneUsageDescription: 'This app uses the microphone so you can talk to your AI Coach.',
        NSSpeechRecognitionUsageDescription:
          'This app uses speech recognition to turn your voice into messages for your AI Coach.',
        NSPhotoLibraryUsageDescription: 'This app needs access to your photo library to save progress photos.',
        // Allow insecure HTTP loads to local dev API (LAN IP / localhost).
        // Without this, iOS may block `http://192.168.x.x:4000` with "Network request failed".
        NSAppTransportSecurity: {
          NSExceptionDomains: {
            localhost: {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSIncludesSubdomains: true,
            },
            '127.0.0.1': {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSIncludesSubdomains: true,
            },
            '192.168.0.178': {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSIncludesSubdomains: true,
            },
          },
        },
      },
    },
    newArchEnabled: true,
    android: {
      package: 'com.coachconnect',
      versionCode: 1,
      icon: './assets/icon.png',
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#000000',
      },
      permissions: ['CAMERA', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE'],
    },
    extra: {
      eas: {
        projectId: "79b8563c-1e15-49e0-8a8b-76f5d1f316b6"
      },
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      /** Always-on Cloud Run API — override with EXPO_PUBLIC_API_BASE_URL if needed. */
      API_BASE_URL:
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        'https://coachconnect-api-421005574501.us-central1.run.app',
      /** Optional: shown for Contact support / Report a bug in Settings. */
      supportEmail: (process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'coachconnect0@gmail.com').trim(),
      /** Google OAuth — set in .env / EAS secrets (never commit values). */
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      /** Stripe publishable key (test/live). Secret key stays server-only. */
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    },
  },
};
