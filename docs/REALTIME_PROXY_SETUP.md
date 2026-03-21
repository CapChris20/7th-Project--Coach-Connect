# 🔌 Realtime API WebSocket Proxy - Setup Guide

## ✅ Implementation Complete

The OpenAI Realtime API WebSocket proxy has been implemented using your existing Express server. The proxy handles authentication server-side, solving the React Native WebSocket header limitation.

---

## 📁 Files Modified/Created

### **Created:**
1. `server/index.js` - Added WebSocket proxy endpoint (`/realtime-proxy`)
2. `server/package.json` - Added `ws` dependency

### **Modified:**
1. `src/voice-ai/screens/VoiceCoachHomeScreen.js` - Updated to connect to proxy URL instead of OpenAI directly

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

This will install the `ws` package needed for WebSocket support.

### 2. Set Environment Variables

Make sure your `.env` file (in project root) has:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Start the Server

```bash
npm run server
```

You should see:
```
🚀 Server listening on port 4000
🌐 HTTP endpoints: http://localhost:4000
🔌 WebSocket proxy: ws://localhost:4000/realtime-proxy
🔐 Serper API: ✅ Configured (or ❌ Not configured)
🔐 OpenAI API: ✅ Configured
```

### 4. Test the Proxy

1. **Health Check**:
   ```bash
   curl http://localhost:4000/health
   ```
   Should return:
   ```json
   {
     "status": "ok",
     "serperConfigured": true,
     "openaiConfigured": true,
     "websocketProxy": "Available at /realtime-proxy"
   }
   ```

2. **In Your App**:
   - Start your Expo app: `npm start`
   - Open the Voice AI screen
   - Tap the microphone
   - You should see connection logs in both server and app

---

## 🌐 Deployment

### For Production (Railway, Render, etc.)

The WebSocket proxy works with your existing server deployment:

1. **Deploy Server** (if not already deployed):
   - Follow `DEPLOYMENT.md` or `QUICK_DEPLOY.md`
   - Make sure `OPENAI_API_KEY` is set in deployment environment variables

2. **Update Client**:
   - Set `EXPO_PUBLIC_API_BASE_URL` in your `.env`:
     ```bash
     EXPO_PUBLIC_API_BASE_URL=https://your-server-url.railway.app
     ```
   - The app will automatically use `wss://your-server-url.railway.app/realtime-proxy`

3. **Test**:
   - Visit: `https://your-server-url.railway.app/health`
   - Check that `openaiConfigured: true`

---

## 🔄 How It Works

### Architecture Flow:
```
Expo Client (React Native)
    ↓ WebSocket (ws://server/realtime-proxy)
Express Server (Proxy)
    ↓ WebSocket (wss://api.openai.com) + Authorization Header
OpenAI Realtime API
    ↓ Responses (text + audio)
Express Server (Proxy)
    ↓ Forward messages
Expo Client
    ↓ Convert PCM16 → WAV → Play audio
```

### Key Points:
- ✅ **No API key exposure**: OpenAI API key stays server-side only
- ✅ **No header issues**: Server adds `Authorization: Bearer` header
- ✅ **Full compatibility**: Works with all existing audio recording/playback code
- ✅ **Automatic URL resolution**: Uses same server URL pattern as other API calls

---

## 🐛 Troubleshooting

### "Failed to connect to OpenAI"
- Check that `OPENAI_API_KEY` is set in server environment
- Verify server logs show `🔐 OpenAI API: ✅ Configured`

### "WebSocket connection failed"
- Ensure server is running: `npm run server`
- Check that server URL is correct in `.env`:
  - Local: `EXPO_PUBLIC_API_BASE_URL=http://localhost:4000`
  - Production: `EXPO_PUBLIC_API_BASE_URL=https://your-server-url.com`

### "Missing bearer or basic authorization"
- This error should no longer occur (it was the reason for the proxy)
- If you still see it, check server logs to verify proxy is handling the connection

### Audio not playing
- Check Expo audio permissions
- Verify audio session is configured correctly (already handled in code)
- Check server logs for OpenAI response messages

---

## 📝 Notes

- **Firebase Functions**: Firebase Cloud Functions v2 doesn't natively support WebSocket upgrades. The Express server approach is the recommended solution for WebSocket proxying.
- **Security**: The OpenAI API key is stored server-side only and never exposed to clients.
- **Development**: For local development, use `ws://localhost:4000/realtime-proxy`
- **Production**: For deployed servers, use `wss://your-server-url.com/realtime-proxy` (automatically converted from HTTP URL)

---

## ✅ Testing Checklist

- [ ] Server starts without errors
- [ ] Health check shows `openaiConfigured: true`
- [ ] WebSocket proxy URL is accessible
- [ ] Client connects to proxy (check server logs)
- [ ] Audio recording works
- [ ] Audio playback works
- [ ] Text transcripts appear
- [ ] No "missing bearer authorization" errors

---

## 🎉 You're Done!

The proxy is now set up and ready to use. Your Voice AI screen should connect to OpenAI Realtime API through the proxy without authentication errors.






