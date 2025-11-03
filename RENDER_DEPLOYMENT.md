# Render Deployment Guide

This guide will help you deploy your Chat App to Render.com.

## Overview

Your application consists of two services:
1. **Backend Server** - Express.js API with Socket.io (Node.js)
2. **Frontend Client** - React/Vite application (Static Site)

## Prerequisites

- Render account (sign up at [render.com](https://render.com))
- GitHub repository with your code
- Firebase project credentials
- Cloudinary account credentials (for image uploads)
- Ready Player Me subdomain (optional, for avatar creation)

## Step 1: Push Code to GitHub

1. Initialize git repository (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Create a new repository on GitHub

3. Push your code:
   ```bash
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

## Step 2: Deploy Backend Server

### Option A: Using render.yaml (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and create both services

### Option B: Manual Setup

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

5. Add Environment Variables (scroll down to Environment Variables section):
   ```
   NODE_ENV=production
   PORT=10000
   FIREBASE_SERVICE_ACCOUNT=<your_firebase_service_account_json_string>
   CLOUDINARY_CLOUD_NAME=<your_cloudinary_cloud_name>
   CLOUDINARY_API_KEY=<your_cloudinary_api_key>
   CLOUDINARY_API_SECRET=<your_cloudinary_api_secret>
   ```

6. Click **"Create Web Service"**

7. **Wait for deployment** and note your server URL (e.g., `https://chat-app-server.onrender.com`)

## Step 3: Deploy Frontend Client

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New"** → **"Static Site"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `chat-app-client`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Plan**: Free (or choose paid plan)

5. Add Environment Variables:
   ```
   VITE_BACKEND_URL=https://chat-app-server.onrender.com/api
   VITE_FIREBASE_API_KEY=<your_firebase_api_key>
   VITE_FIREBASE_AUTH_DOMAIN=<your_project>.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://<your_project>.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=<your_project_id>
   VITE_FIREBASE_STORAGE_BUCKET=<your_project>.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=<your_sender_id>
   VITE_FIREBASE_APP_ID=<your_app_id>
   VITE_READY_PLAYER_ME_SUBDOMAIN=chatapp-t8bhfc
   ```
   **Important**: Replace `https://chat-app-server.onrender.com/api` with your actual server URL from Step 2.

6. Click **"Create Static Site"**

7. **Wait for deployment** and note your client URL (e.g., `https://chat-app-client.onrender.com`)

## Step 4: Update Backend with Frontend URL

1. Go back to your **Backend Server** service in Render Dashboard
2. Go to **Environment** tab
3. Add/Update environment variable:
   ```
   FRONTEND_URL=https://chat-app-client.onrender.com
   ```
   Replace with your actual client URL from Step 3.
4. Render will automatically redeploy with the new configuration

## Step 5: Get Environment Variables

### Firebase Service Account JSON

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Download the JSON file
6. Copy the **entire JSON content** and use it as the value for `FIREBASE_SERVICE_ACCOUNT` environment variable

**Important**: In Render, paste the entire JSON as a single-line string (you can remove line breaks or Render will handle it).

### Firebase Client Configuration

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** → **General** tab
4. Scroll down to **"Your apps"** section
5. If you don't have a web app, click **"Add app"** → **Web** (</> icon)
6. Copy the configuration values:
   - `apiKey`
   - `authDomain`
   - `databaseURL`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

### Cloudinary Credentials

1. Go to [Cloudinary Dashboard](https://cloudinary.com/console)
2. Go to **Dashboard** or **Settings**
3. Copy your credentials:
   - `Cloud name`
   - `API Key`
   - `API Secret`

### Ready Player Me Subdomain

- Use your existing subdomain: `chatapp-t8bhfc`
- Or create a new one at [Ready Player Me](https://readyplayer.me)

## Environment Variables Summary

### Backend Server (`chat-app-server`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Set to `production` | Yes |
| `PORT` | Server port (Render sets this automatically, but 10000 is default) | Optional |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (entire JSON as string) | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `FRONTEND_URL` | Your frontend URL (e.g., `https://chat-app-client.onrender.com`) | Yes |

### Frontend Client (`chat-app-client`)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_BACKEND_URL` | Backend API URL (e.g., `https://chat-app-server.onrender.com/api`) | Yes |
| `VITE_FIREBASE_API_KEY` | Firebase API key | Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | Yes |
| `VITE_FIREBASE_DATABASE_URL` | Firebase database URL | Yes |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Yes |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | Yes |
| `VITE_READY_PLAYER_ME_SUBDOMAIN` | Ready Player Me subdomain | Optional |

## Troubleshooting

### Backend Issues

**Problem**: Server won't start
- **Solution**: Check logs in Render Dashboard → Logs tab
- Verify all environment variables are set correctly
- Ensure `FIREBASE_SERVICE_ACCOUNT` is valid JSON

**Problem**: CORS errors
- **Solution**: Make sure `FRONTEND_URL` is set correctly in backend environment variables
- The server is configured to allow `onrender.com` URLs automatically

**Problem**: Firebase connection fails
- **Solution**: Verify `FIREBASE_SERVICE_ACCOUNT` is correctly formatted (entire JSON as single string)
- Check Firebase service account has proper permissions

### Frontend Issues

**Problem**: Can't connect to backend
- **Solution**: Verify `VITE_BACKEND_URL` is set to your backend URL (include `/api` at the end)
- Check backend is running and accessible

**Problem**: Firebase not initialized
- **Solution**: Verify all `VITE_FIREBASE_*` environment variables are set
- Check Firebase console to ensure web app is configured

**Problem**: Images not uploading
- **Solution**: Verify Cloudinary credentials are set in backend
- Check Cloudinary dashboard for upload logs

### General Issues

**Problem**: Build fails
- **Solution**: Check build logs in Render Dashboard
- Verify all dependencies are listed in `package.json`
- Ensure Node.js version is compatible (Render uses Node 18+ by default)

**Problem**: Services go to sleep (Free plan)
- **Solution**: Free plan services sleep after 15 minutes of inactivity
- First request after sleep may take 30-60 seconds (cold start)
- Upgrade to paid plan for always-on services

## Testing Deployment

1. **Test Backend**:
   - Visit: `https://chat-app-server.onrender.com/api/test`
   - Should return: `{"success": true, "message": "Backend server is working with Firebase!", ...}`

2. **Test Frontend**:
   - Visit your client URL (e.g., `https://chat-app-client.onrender.com`)
   - Try logging in or signing up
   - Test messaging functionality
   - Test image uploads

3. **Test Socket.io**:
   - Open multiple browser windows
   - Login with different accounts
   - Send messages and verify real-time updates work

## Custom Domain (Optional)

1. Go to your service in Render Dashboard
2. Go to **Settings** → **Custom Domain**
3. Add your domain
4. Follow DNS configuration instructions
5. Update `FRONTEND_URL` and `VITE_BACKEND_URL` with your custom domain

## Security Notes

- ✅ Never commit `.env` files or `serviceAccountKey.json` to Git
- ✅ Use environment variables for all sensitive data
- ✅ The `render.yaml` file has commented environment variables - update them in Render Dashboard
- ✅ Consider using Render's secrets management for sensitive data

## Next Steps

- Monitor your application using Render's logs and metrics
- Set up automatic deployments from your main branch
- Configure health checks for better reliability
- Consider upgrading to paid plan for production use (always-on, faster builds)

## Support

If you encounter issues:
1. Check Render logs for error messages
2. Verify all environment variables are correct
3. Test locally with the same environment variables
4. Check Render status page: [status.render.com](https://status.render.com)

---

**Happy Deploying! 🚀**

