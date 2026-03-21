# 🚀 Server Deployment Guide

This guide will help you deploy the CoachConnect AI server so web search works on the web version.

## Quick Deploy Options

### Option 1: Railway (Recommended - Easiest)

1. **Sign up**: Go to [railway.app](https://railway.app) and sign up with GitHub

2. **Create Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure**:
   - Click on the service
   - Go to "Settings" → "Root Directory"
   - Set to: `server`
   - Go to "Variables" tab
   - Add these environment variables:
     ```
     SERPER_API_KEY=your_serper_api_key_here
     OPENAI_API_KEY=your_openai_api_key_here (optional)
     ```

4. **Deploy**:
   - Railway will auto-deploy
   - Wait for deployment to complete
   - Copy the URL (e.g., `https://your-app.railway.app`)

5. **Update your app**:
   - Add to your `.env` file:
     ```
     EXPO_PUBLIC_API_BASE_URL=https://your-app.railway.app
     ```

---

### Option 2: Render

1. **Sign up**: Go to [render.com](https://render.com) and sign up

2. **Create Web Service**:
   - Click "New" → "Web Service"
   - Connect your GitHub repository

3. **Configure**:
   - **Name**: `coachconnect-server`
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Root Directory**: `server`

4. **Environment Variables**:
   - Click "Environment" tab
   - Add:
     ```
     SERPER_API_KEY=your_serper_api_key_here
     OPENAI_API_KEY=your_openai_api_key_here (optional)
     ```

5. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment
   - Copy the URL (e.g., `https://coachconnect-server.onrender.com`)

6. **Update your app**:
   - Add to your `.env` file:
     ```
     EXPO_PUBLIC_API_BASE_URL=https://coachconnect-server.onrender.com
     ```

---

## After Deployment

1. **Test the server**:
   - Visit: `https://your-server-url.com/health`
   - Should see: `{"status":"ok","serperConfigured":true}`

2. **Update your `.env`**:
   ```bash
   EXPO_PUBLIC_API_BASE_URL=https://your-deployed-server-url.com
   ```

3. **Restart your app**:
   ```bash
   npm start
   ```

4. **Test web search**:
   - Try asking a question that needs web search
   - Should work now! 🎉

---

## Troubleshooting

- **Server not responding**: Check Railway/Render logs
- **Serper not working**: Verify `SERPER_API_KEY` is set correctly
- **CORS errors**: Server already has CORS enabled
- **Timeout errors**: Increase timeout in server code if needed

---

## Local Testing

To test locally before deploying:

```bash
cd server
npm install
SERPER_API_KEY=your_key npm start
```

Then in your `.env`:
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```









