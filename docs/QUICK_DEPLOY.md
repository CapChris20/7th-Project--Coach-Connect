# ⚡ Quick Deploy - 5 Minutes

## Step 1: Deploy to Railway (Easiest)

1. **Go to**: https://railway.app
2. **Sign up** with GitHub
3. **Click**: "New Project" → "Deploy from GitHub repo"
4. **Select**: Your repository
5. **Settings**:
   - Click on the service
   - Settings → Root Directory: `server`
   - Variables tab → Add:
     - `SERPER_API_KEY` = (your Serper API key)
     - `OPENAI_API_KEY` = (your OpenAI key - optional)
6. **Wait** for deployment (2-3 minutes)
7. **Copy** the URL (e.g., `https://coachconnect-production.up.railway.app`)

## Step 2: Update Your App

1. **Add to your `.env` file** (in project root):
   ```bash
   EXPO_PUBLIC_API_BASE_URL=https://your-railway-url.railway.app
   ```

2. **Restart your app**:
   ```bash
   npm start
   ```

## Step 3: Test

1. Visit: `https://your-railway-url.railway.app/health`
2. Should see: `{"status":"ok","serperConfigured":true}`
3. Try asking a question in your app that needs web search!

---

## Alternative: Render.com

1. Go to: https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Settings:
   - Build: `cd server && npm install`
   - Start: `cd server && npm start`
   - Root: `server`
5. Add environment variables (same as Railway)
6. Deploy!

---

## That's It! 🎉

Your GPT feature with web search should now work on web!









