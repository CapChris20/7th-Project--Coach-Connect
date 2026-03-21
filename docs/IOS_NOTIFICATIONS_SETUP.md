# iOS Notifications – Enable & Test on Simulator

## 1. Enable notifications in your app

- **expo-notifications** is already in the project and the **expo-notifications** plugin is now in `app.json` so the native iOS project gets the right capabilities.
- Notifications are configured in `src/shared/services/notificationsService.js` and used from **Settings → Notifications** (e.g. `NotificationsOverviewScreen`).

**Rebuild the iOS app** after changing `app.json` (the plugin runs at build time):

```bash
npx expo run:ios
```

Or, if you use a dev client:

```bash
npx expo prebuild --clean
npx expo run:ios
```

On first launch, when your app calls `requestNotificationPermissionsAsync()`, iOS will show the system “Allow Notifications?” dialog. The user must tap **Allow** for notifications to work.

---

## 2. See notifications on the **iOS Simulator**

### Local notifications (work on Simulator)

- Your app can **schedule local notifications** (e.g. “Send Test Notification” in Settings → Notifications) with `expo-notifications`.
- These **do work on the iOS Simulator**: tap the button, wait a second, and the notification should appear as a banner / in Notification Center.
- If you don’t see the prompt or the notification:
  - In Simulator: **Settings → Notifications → CoachConnect** and ensure “Allow Notifications” is On.
  - In your app, open the screen that calls `requestNotificationPermissionsAsync()` and try again.

### Push (remote) notifications on Simulator (Xcode 11.4+)

- **Expo Push Token** and sending via Expo’s push service **do not work on Simulator**; you need a real device for that.
- You can still **simulate a remote push** on the Simulator using a **.apns file**:

1. **Create a file** `test.apns` with something like:

```json
{
  "Simulator Target Bundle": "com.yourcompany.coachconnect",
  "aps": {
    "alert": {
      "title": "CoachConnect",
      "body": "Test push on simulator"
    },
    "sound": "default"
  }
}
```

2. **Run your app in the iOS Simulator** (same bundle id as above).
3. **Drag and drop** `test.apns` onto the **Simulator window** (not the Xcode window).
4. The simulator will show the push as if it were sent by APNs.

Use your app’s real `bundleIdentifier` from `app.json` in `Simulator Target Bundle` (e.g. `com.yourcompany.coachconnect`).

---

## 3. Checklist

| Step | Action |
|------|--------|
| 1 | `app.json` has the `expo-notifications` plugin (done). |
| 2 | Rebuild: `npx expo run:ios` (or `prebuild --clean` then `run:ios`). |
| 3 | On device/simulator: allow notifications when the app asks. |
| 4 | Test **local**: open Settings → Notifications in the app and tap “Send Test Notification”. |
| 5 | Test **push on simulator** (optional): use a `.apns` file and drag it onto the Simulator. |
| 6 | For **real push** (Expo Push, FCM, etc.): use a **physical device** and configure credentials (EAS, APNs key, etc.) as needed. |

---

## 4. If notifications still don’t show

- **Simulator**: **Device → Erase All Content and Settings**, then run the app again and accept the permission.
- **Device**: **Settings → CoachConnect → Notifications** and ensure “Allow Notifications” is On.
- Ensure your app calls `configureNotifications()` early (e.g. in root `App.js` or where you mount the app) so the notification handler is set before any notification is received.
