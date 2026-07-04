# Firestore TTL policies (manual setup)

Configure in [Firebase Console](https://console.firebase.google.com) → Firestore → **TTL**.

| Collection | TTL field | Retention |
|------------|-----------|-----------|
| `_rateLimits` | `ttl` | 1 hour |
| `dailyReminders` | `createdAt` | 30 days |
| `dailyLogs` | `createdAt` | 90 days |
| `nutritionLogs` | `createdAt` | 90 days |

After enabling TTL, Firestore deletes expired documents automatically (typically within 24h of expiry).
