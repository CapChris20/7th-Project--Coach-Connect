# 🔧 Quick Setup: Serper Web Search

## The Problem
For **web**, your app can't use `localhost:4000` - it needs a deployed server URL.

## Quick Fix (Choose One):

### Option 1: Deploy Server (5 minutes) - RECOMMENDED

1. **Add your Serper API key to `.env`**:
   ```bash
   SERPER_API_KEY=your_actual_serper_api_key_here
   ```

2. **Deploy to Railway** (easiest):
   - Go to: https://railway.app
   - New Project → Deploy from GitHub
   - Root Directory: `server`
   - Add environment variable: `SERPER_API_KEY=your_key`
   - Copy the URL (e.g., `https://coachconnect.railway.app`)

3. **Add to your `.env`**:
   ```bash
   EXPO_PUBLIC_API_BASE_URL=https://your-railway-url.railway.app
   ```

4. **Restart your app**: `npm start`

---

### Option 2: Test Locally First

1. **Add Serper key to `.env`**:
   ```bash
   SERPER_API_KEY=your_actual_serper_api_key_here
   ```

2. **Start the server** (in one terminal):
   ```bash
   npm run server
   ```

3. **For mobile testing** (works with localhost):
   ```bash
   npm start
   ```

4. **For web** - you still need to deploy (Option 1)

---

## Check if it's working:

1. **Test server health**:
   - Visit: `https://your-server-url.com/health`
   - Should see: `{"status":"ok","serperConfigured":true}`

2. **If `serperConfigured: false`**:
   - Make sure `SERPER_API_KEY` is in your `.env` file
   - Restart the server

3. **In your app**:
   - Try asking a question that needs web search
   - Check browser console for errors

---

## Current Status Check:

Run these to see what's missing:

```bash
# Check if Serper key is set
grep "^SERPER_API_KEY=" .env

# Check if server URL is set (for web)
grep "^EXPO_PUBLIC_API_BASE_URL=" .env

# Check if server is running
lsof -ti:4000 && echo "✅ Server running" || echo "❌ Server not running"
```









