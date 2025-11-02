# 3D Avatar Creator - Production Setup Guide

This guide will help you set up Ready Player Me's 3D Avatar Creator for production use in your chat application.

## Current Status

The avatar creator is currently configured to use **demo mode** (no API key required). This works for testing, but for production you should set up your own Ready Player Me subdomain.

## Quick Start (Demo Mode)

The app works out of the box using Ready Player Me's demo subdomain. No additional setup required!

## Production Setup

### Step 1: Sign Up for Ready Player Me

### Website
**Main Website:** [https://readyplayer.me/](https://readyplayer.me/)  
**Developer Dashboard:** [https://studio.readyplayer.me/](https://studio.readyplayer.me/)  
**Documentation:** [https://docs.readyplayer.me/](https://docs.readyplayer.me/)

### Sign Up Process
1. Go to **https://readyplayer.me/** or **https://studio.readyplayer.me/**
2. Click **"Get Started"**, **"Sign Up"**, or **"Create Account"**
3. You can sign up using:
   - Email address
   - Google account
   - GitHub account
4. Create a free account (Free tier is sufficient for most use cases)
5. Verify your email if required
6. Complete the signup process

### Step 2: Create a Project and Get Your Subdomain

1. After signing up, go to **https://studio.readyplayer.me/**
2. You'll see your **Dashboard** or **Projects** page
3. Click **"Create New Project"** or **"New Project"** button
   - If this is your first project, it might create one automatically
4. Fill in the project details:
   - **Project Name**: Give your project a name (e.g., "My Chat App")
   - **Description**: Optional description
5. After creating the project, you'll see your project dashboard
6. Look for your **Subdomain** - it will be shown in:
   - Project settings
   - Project overview/dashboard
   - Usually in format: `yourproject.readyplayer.me` or just `yourproject`
7. **Important**: Copy only the subdomain part (without `.readyplayer.me`)
   - Example: If it shows `myapp.readyplayer.me`, use just `myapp`
   - Example: If it shows `myapp`, use `myapp`

### Step 3: Configure Environment Variables

1. In your `client` folder, create or edit `.env` file:

```env
# Ready Player Me Configuration
VITE_READY_PLAYER_ME_SUBDOMAIN=yourproject
```

**Important**: 
- Replace `yourproject` with your actual Ready Player Me subdomain (without `.readyplayer.me`)
- The subdomain is the part before `.readyplayer.me` in your URL
- For example, if your URL is `myapp.readyplayer.me`, use `myapp`

### Step 4: Restart Development Server

After adding the environment variable:

```bash
# Stop your current dev server (Ctrl+C)
# Then restart it
cd client
npm run dev
```

### Step 5: Build for Production

When building for production:

```bash
cd client
npm run build
```

Make sure your production environment has the `VITE_READY_PLAYER_ME_SUBDOMAIN` variable set.

## Environment Variable Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_READY_PLAYER_ME_SUBDOMAIN` | Your Ready Player Me subdomain (without .readyplayer.me) | No | `demo` |

## Example `.env` File

Create a `.env` file in the `client` folder with the following:

```env
# Backend API URL
VITE_BACKEND_URL=http://localhost:5000/api

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Ready Player Me Configuration
# For production: Replace 'yourproject' with your actual subdomain
# For demo: Leave blank or omit this line
VITE_READY_PLAYER_ME_SUBDOMAIN=yourproject
```

**Note**: The `.env` file is already in `.gitignore`, so it won't be committed to version control.

## Ready Player Me Pricing

- **Free Tier**: 
  - 10,000 avatar generations/month
  - Basic customization options
  - Perfect for most chat applications

- **Pro Tier** (if you need more):
  - Higher generation limits
  - Premium features
  - Priority support

Check [Ready Player Me Pricing](https://readyplayer.me/pricing) for current plans.

## Troubleshooting

### Avatar Creator Not Loading

1. **Check subdomain**: Verify your subdomain is correct in `.env`
2. **Check console**: Open browser DevTools and check for errors
3. **Check network**: Ensure you're not blocking `readyplayer.me` domains
4. **Try demo mode**: Remove `VITE_READY_PLAYER_ME_SUBDOMAIN` from `.env` to test with demo

### Avatar Not Saving

1. **Check API connection**: Ensure your backend API is running
2. **Check authentication**: Make sure you're logged in
3. **Check console**: Look for error messages in browser console
4. **Verify profile update endpoint**: Ensure `/api/users/update` is working

### CORS Errors

If you see CORS errors:
1. Add your domain to Ready Player Me's allowed origins (in Ready Player Me dashboard)
2. Check your `vite.config.js` has proper headers (already configured)

## Security Notes

- Never commit your `.env` file to version control
- The `.env` file should be in `.gitignore`
- For production, set environment variables in your hosting platform (Vercel, Netlify, etc.)

## Integration Details

The avatar creator:
- Uses Ready Player Me's Web Avatar Creator via iframe
- Listens for avatar export events via postMessage API
- Automatically saves the avatar URL to your user profile
- Works with your existing profile picture system
- Supports both demo and production modes automatically

## Deployment Checklist

When deploying to production:

- [ ] Sign up for Ready Player Me account
- [ ] Get your subdomain from Ready Player Me dashboard
- [ ] Add `VITE_READY_PLAYER_ME_SUBDOMAIN` to production environment variables
- [ ] Test avatar creation in production
- [ ] Verify avatars are saving correctly
- [ ] Check Ready Player Me dashboard for usage/limits

### Platform-Specific Setup

**Vercel:**
1. Go to Project Settings → Environment Variables
2. Add `VITE_READY_PLAYER_ME_SUBDOMAIN` with your subdomain value
3. Redeploy your application

**Netlify:**
1. Go to Site Settings → Build & Deploy → Environment
2. Add `VITE_READY_PLAYER_ME_SUBDOMAIN` with your subdomain value
3. Redeploy your application

**Other Platforms:**
- Add the environment variable through your hosting platform's dashboard
- Make sure it's prefixed with `VITE_` for Vite to expose it to the client

## Support

- **Ready Player Me Docs**: [https://docs.readyplayer.me/](https://docs.readyplayer.me/)
- **Ready Player Me Support**: Contact through their dashboard
- **Avatar Creator Component**: `client/src/components/AvatarCreator.jsx`
- **Setup Guide**: `client/AVATAR_SETUP.md` (this file)

---

**Note**: The demo mode works perfectly for development and testing. Only set up a production subdomain when you're ready to deploy to production or need higher generation limits.

