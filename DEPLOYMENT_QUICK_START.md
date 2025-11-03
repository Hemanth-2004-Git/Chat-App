# Quick Start: Vercel (Frontend) + Render (Backend)

## 🚀 Deploy in 3 Steps

### Step 1: Deploy Backend on Render (5 minutes)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New"** → **"Web Service"**
3. Connect GitHub repo
4. Configure:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables:
   ```
   NODE_ENV=production
   FIREBASE_SERVICE_ACCOUNT={...your_json...}
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret
   ```
6. Deploy and **save the URL** (e.g., `https://chat-app-server.onrender.com`)

### Step 2: Deploy Frontend on Vercel (5 minutes)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repo
4. Configure:
   - **Root Directory**: `client`
   - Build settings auto-detected
5. Add Environment Variables:
   ```
   VITE_BACKEND_URL=https://chat-app-server.onrender.com/api
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_DATABASE_URL=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_READY_PLAYER_ME_SUBDOMAIN=chatapp-t8bhfc
   ```
   **Replace** `https://chat-app-server.onrender.com/api` with your actual backend URL
6. Deploy and **save the URL** (e.g., `https://your-app.vercel.app`)

### Step 3: Connect Them (2 minutes)

1. Go back to **Render Dashboard** → Your backend service
2. Go to **Environment** tab
3. Add:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```
   (Use your actual Vercel URL)
4. Backend will auto-redeploy

## ✅ Done!

- Frontend: `https://your-app.vercel.app`
- Backend: `https://chat-app-server.onrender.com`
- Test API: `https://chat-app-server.onrender.com/api/test`

## 📚 Full Guide

For detailed instructions and troubleshooting, see:
- **`VERCEL_RENDER_DEPLOYMENT.md`** - Complete deployment guide

