# Firebase Admin SDK Setup for Push Notifications

## Quick Setup

To enable push notifications, you need to add your Firebase service account credentials.

### Option 1: Service Account Key File (Recommended for Development)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Save the downloaded JSON file as `serviceAccountKey.json` in the `server/` folder

**Important:** Add `server/serviceAccountKey.json` to your `.gitignore` to keep it secure!

### Option 2: Environment Variable (Recommended for Production)

Set the `FIREBASE_SERVICE_ACCOUNT` environment variable with the entire JSON content:

```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project",...}'
```

## Testing

Once configured, restart your server:

```bash
npm run server
```

You should see: `✅ Firebase Admin initialized`

If not configured, you'll see: `⚠️ Firebase Admin not initialized - notifications will not work`

## How It Works

1. When a user logs in, their Expo push token is saved to Firestore (`users/{userId}/pushToken`)
2. When someone sends a message, `sendMessage()` calls `/api/notifications/send`
3. The server fetches the recipient's push token from Firestore
4. The server sends the notification via Expo Push API
5. The recipient gets a push notification on their device

## Troubleshooting

- **"Firebase Admin not initialized"**: Add service account credentials
- **"Recipient has no push token"**: User needs to log in and grant notification permissions
- **"Invalid push token format"**: Token should start with `ExponentPushToken[` or `ExpoPushToken[`
- **Notifications not appearing**: Check device notification settings and Expo Go app permissions
