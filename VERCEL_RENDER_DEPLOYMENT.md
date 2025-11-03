# Deployment Guide: Frontend on Vercel + Backend on Render

This guide will help you deploy your Chat App with:
- **Frontend** → Vercel (Fast CDN, great for React/Vite apps)
- **Backend** → Render (Reliable Node.js hosting)

## Overview

This hybrid deployment gives you:
- ⚡ **Fast frontend** with Vercel's global CDN
- 🚀 **Reliable backend** with Render's web service
- 💰 **Free tier** available on both platforms

## Prerequisites

- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com))
- Render account (sign up at [render.com](https://render.com))
- Firebase project credentials
- Cloudinary account credentials
- Ready Player Me subdomain (optional)

---

## Part 1: Deploy Backend on Render

### Step 1: Push Code to GitHub

1. Initialize git repository (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Ready for deployment"
   ```

2. Create a new repository on GitHub

3. Push your code:
   ```bash
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

### Step 2: Deploy Backend Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `chat-app-server`
   - **Environment**: `Node`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or choose paid plan)

5. **Add Environment Variables** (go to Environment tab):
   ```
   NODE_ENV=production
   PORT=10000
   FIREBASE_SERVICE_ACCOUNT=<your_firebase_service_account_json>
   CLOUDINARY_CLOUD_NAME=<your_cloudinary_cloud_name>
   CLOUDINARY_API_KEY=<your_cloudinary_api_key>
   CLOUDINARY_API_SECRET=<your_cloudinary_api_secret>
   ```
   **Note**: `FRONTEND_URL` will be added after Vercel deployment (Step 3 in Part 2)

6. Click **"Create Web Service"**

7. **Wait for deployment** and note your server URL:
   - Example: `https://chat-app-server.onrender.com`
   - Save this URL! You'll need it for the frontend

---

## Part 2: Deploy Frontend on Vercel

### Step 1: Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect your project settings

### Step 2: Configure Project Settings

1. **Framework Preset**: Should auto-detect as "Vite"
2. **Root Directory**: Set to `client`
   - Click **"Edit"** next to Root Directory
   - Enter: `client`
3. **Build Command**: Should be `npm run build` (auto-detected)
4. **Output Directory**: Should be `dist` (auto-detected)
5. **Install Command**: `npm install`

### Step 3: Add Environment Variables

Before deploying, add all environment variables:

Click **"Environment Variables"** section and add:

```
VITE_BACKEND_URL=https://chat-app-server.onrender.com/api
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_READY_PLAYER_ME_SUBDOMAIN=chatapp-t8bhfc
```

**Important**: 
- Replace `https://chat-app-server.onrender.com/api` with your actual Render backend URL from Part 1
- Make sure to add `/api` at the end of the backend URL

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (usually 1-2 minutes)
3. Vercel will provide you with a URL:
   - Example: `https://your-app.vercel.app`
   - Save this URL!

---

## Part 3: Connect Frontend and Backend

### Step 1: Update Backend with Frontend URL

1. Go back to **Render Dashboard** → Your backend service
2. Go to **Environment** tab
3. Add/Update environment variable:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```
   Replace with your actual Vercel frontend URL from Part 2

4. Render will automatically redeploy with the new configuration

### Step 2: Verify CORS Configuration

The server is already configured to allow:
- ✅ Vercel URLs (`*.vercel.app`)
- ✅ Render URLs (`*.onrender.com`)
- ✅ Localhost (for development)

No additional configuration needed!

---

## Getting Your Credentials

### Firebase Service Account JSON

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Download the JSON file
6. Copy the **entire JSON content** (as a single-line string)
7. Use it as the value for `FIREBASE_SERVICE_ACCOUNT` in Render

**Tip**: In Render, you can paste the JSON directly. Render will handle the formatting.

### Firebase Client Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** → **General** tab
4. Scroll to **"Your apps"** section
5. If you don't have a web app, click **"Add app"** → **Web** (</> icon)
6. Copy these values:
   - `apiKey` → `VITE_FIREBASE_API_KEY`
   - `authDomain` → `VITE_FIREBASE_AUTH_DOMAIN`
   - `databaseURL` → `VITE_FIREBASE_DATABASE_URL`
   - `projectId` → `VITE_FIREBASE_PROJECT_ID`
   - `storageBucket` → `VITE_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `VITE_FIREBASE_APP_ID`

### Cloudinary Credentials

1. Go to [Cloudinary Dashboard](https://cloudinary.com/console)
2. Go to **Dashboard** or **Settings**
3. Copy:
   - `Cloud name` → `CLOUDINARY_CLOUD_NAME`
   - `API Key` → `CLOUDINARY_API_KEY`
   - `API Secret` → `CLOUDINARY_API_SECRET`

---

## Environment Variables Summary

### Render Backend (`chat-app-server`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Set to `production` | Yes |
| `PORT` | Server port (Render sets automatically) | Optional |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (entire JSON) | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `FRONTEND_URL` | Your Vercel frontend URL | Yes |

### Vercel Frontend (`client`)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_BACKEND_URL` | Render backend URL with `/api` (e.g., `https://chat-app-server.onrender.com/api`) | Yes |
| `VITE_FIREBASE_API_KEY` | Firebase API key | Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Yes |
| `VITE_FIREBASE_DATABASE_URL` | Firebase database URL | Yes |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Yes |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | Yes |
| `VITE_READY_PLAYER_ME_SUBDOMAIN` | Ready Player Me subdomain | Optional |

---

## Testing Your Deployment

### 1. Test Backend
Visit: `https://chat-app-server.onrender.com/api/test`

Expected response:
```json
{
  "success": true,
  "message": "Backend server is working with Firebase!",
  "timestamp": "..."
}
```

### 2. Test Frontend
1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Try creating an account
3. Test logging in
4. Test sending messages
5. Test image uploads

### 3. Test Socket.io (Real-time)
1. Open two browser windows
2. Login with different accounts in each window
3. Send messages and verify real-time updates work

---

## Troubleshooting

### Backend Issues

**Problem**: Server won't start
- **Solution**: Check Render logs (Dashboard → Logs tab)
- Verify `FIREBASE_SERVICE_ACCOUNT` is valid JSON
- Check all environment variables are set

**Problem**: CORS errors
- **Solution**: Verify `FRONTEND_URL` is set correctly
- Check that your Vercel URL matches `FRONTEND_URL`
- Server is configured to allow `vercel.app` domains automatically

**Problem**: Firebase connection fails
- **Solution**: Verify `FIREBASE_SERVICE_ACCOUNT` is correctly formatted
- Ensure it's the entire JSON as a single string
- Check Firebase service account has proper permissions

### Frontend Issues

**Problem**: Can't connect to backend
- **Solution**: 
  - Verify `VITE_BACKEND_URL` includes `/api` at the end
  - Check backend URL is correct (from Render)
  - Ensure backend service is running (check Render dashboard)

**Problem**: Environment variables not working
- **Solution**:
  - In Vercel, environment variables must start with `VITE_` for Vite projects
  - Redeploy after adding/changing environment variables
  - Clear browser cache

**Problem**: Build fails on Vercel
- **Solution**:
  - Check Root Directory is set to `client`
  - Verify `package.json` exists in client folder
  - Check build logs in Vercel dashboard

**Problem**: 404 errors on routes
- **Solution**: 
  - `vercel.json` is already configured with rewrites
  - Ensure `vercel.json` is in the `client` folder
  - Redeploy if you just added `vercel.json`

### General Issues

**Problem**: Services not communicating
- **Solution**:
  - Verify `VITE_BACKEND_URL` in Vercel matches your Render backend URL
  - Verify `FRONTEND_URL` in Render matches your Vercel frontend URL
  - Check both services are deployed and running

**Problem**: Images not uploading
- **Solution**: 
  - Verify Cloudinary credentials are set in Render backend
  - Check Cloudinary dashboard for upload logs

---

## Deployment Order Checklist

✅ **Step 1**: Deploy backend on Render
   - Add all backend environment variables
   - Save backend URL

✅ **Step 2**: Deploy frontend on Vercel
   - Set Root Directory to `client`
   - Add all frontend environment variables
   - Use backend URL from Step 1 in `VITE_BACKEND_URL`
   - Save frontend URL

✅ **Step 3**: Update backend with frontend URL
   - Add `FRONTEND_URL` in Render environment variables
   - Backend will auto-redeploy

✅ **Step 4**: Test everything
   - Test backend API endpoint
   - Test frontend login/signup
   - Test messaging
   - Test real-time features

---

## Custom Domains

### Vercel Custom Domain

1. Go to Vercel Dashboard → Your project
2. Go to **Settings** → **Domains**
3. Add your domain
4. Follow DNS configuration instructions
5. Update `VITE_BACKEND_URL` if needed (usually not needed)
6. Update `FRONTEND_URL` in Render with your custom domain

### Render Custom Domain

1. Go to Render Dashboard → Your backend service
2. Go to **Settings** → **Custom Domain**
3. Add your domain (optional, usually not needed if frontend is on Vercel)
4. Follow DNS configuration instructions

---

## Advantages of This Setup

- ⚡ **Fast Frontend**: Vercel's global CDN provides ultra-fast load times
- 🔄 **Auto-Deploy**: Both platforms auto-deploy on git push
- 📊 **Monitoring**: Both platforms provide logs and metrics
- 🔒 **Secure**: Environment variables are encrypted
- 💰 **Free Tier**: Both platforms offer generous free tiers
- 🚀 **Scalable**: Easy to upgrade when needed

---

## Next Steps

- Monitor your application using Vercel and Render dashboards
- Set up custom domains (optional)
- Configure automatic deployments from main branch (already enabled by default)
- Consider upgrading to paid plans for production:
  - Vercel Pro: Faster builds, team features
  - Render Paid: Always-on service, faster cold starts

---

## Quick Reference

- **Vercel Dashboard**: [vercel.com/dashboard](https://vercel.com/dashboard)
- **Render Dashboard**: [dashboard.render.com](https://dashboard.render.com)
- **Backend API Test**: `https://your-backend.onrender.com/api/test`
- **Frontend URL**: `https://your-app.vercel.app`

---

**Your app is now live! 🎉**

Frontend: Vercel (Fast CDN)  
Backend: Render (Reliable hosting)

