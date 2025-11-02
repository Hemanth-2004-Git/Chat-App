# Ready Player Me Production Setup Guide

Complete step-by-step guide to set up Ready Player Me for production use in your chat application.

## 🌐 Important Websites

- **Main Website**: [https://readyplayer.me/](https://readyplayer.me/)
- **Developer Studio/Dashboard**: [https://studio.readyplayer.me/](https://studio.readyplayer.me/)
- **Documentation**: [https://docs.readyplayer.me/](https://docs.readyplayer.me/)
- **Pricing**: [https://readyplayer.me/pricing](https://readyplayer.me/pricing)
- **Support**: Contact through your dashboard at [https://studio.readyplayer.me/](https://studio.readyplayer.me/)

---

## 📋 Step-by-Step Setup Instructions

### Step 1: Create an Account

1. **Go to Ready Player Me Website**
   - Visit: [https://readyplayer.me/](https://readyplayer.me/)
   - Or directly: [https://studio.readyplayer.me/](https://studio.readyplayer.me/)

2. **Sign Up**
   - Click **"Get Started"**, **"Sign Up"**, or **"Create Account"** button
   - You can sign up using:
     - ✉️ Email address
     - 🔵 Google account
     - 💼 GitHub account (recommended for developers)

3. **Complete Registration**
   - Fill in required information
   - Verify your email if prompted
   - Accept terms and conditions

### Step 2: Create a New Project

1. **Access Developer Studio**
   - After login, you'll be redirected to [https://studio.readyplayer.me/](https://studio.readyplayer.me/)
   - This is your developer dashboard

2. **Create Project**
   - Click **"Create New Project"** or **"New Project"** button
   - If you see a welcome screen, click **"Get Started"**

3. **Configure Project**
   - **Project Name**: Enter a name (e.g., "My Chat App" or "ChatApp Avatars")
   - **Description**: Optional - describe your project
   - **Avatar Style**: Choose your preferred style (optional)
   - Click **"Create"** or **"Save"**

### Step 3: Get Your Subdomain

1. **Find Your Subdomain**
   - After creating the project, go to your **Project Dashboard**
   - Navigate to **Settings** or **Project Settings**
   - Look for **"Subdomain"** or **"Custom Domain"** section
   - Your subdomain will be shown (e.g., `myapp` or `myapp.readyplayer.me`)

2. **Copy Your Subdomain**
   - Copy ONLY the subdomain name (without `.readyplayer.me`)
   - Example:
     - ✅ Correct: `myapp`
     - ❌ Wrong: `myapp.readyplayer.me`
     - ❌ Wrong: `https://myapp.readyplayer.me`

### Step 4: Configure Environment Variable

1. **Open Your Project**
   - Navigate to your chat app's `client` folder

2. **Create or Edit `.env` File**
   - Create `.env` file if it doesn't exist
   - Or edit the existing `.env` file

3. **Add Subdomain**
   ```env
   # Ready Player Me Configuration
   VITE_READY_PLAYER_ME_SUBDOMAIN=myapp
   ```
   - Replace `myapp` with your actual subdomain from Step 3

4. **Example `.env` File**
   ```env
   # Backend API URL
   VITE_BACKEND_URL=http://localhost:5000/api

   # Firebase Configuration (your existing config)
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id

   # Ready Player Me Production Subdomain
   VITE_READY_PLAYER_ME_SUBDOMAIN=myapp
   ```

### Step 5: Restart Development Server

1. **Stop Current Server**
   - Press `Ctrl + C` in your terminal

2. **Restart Server**
   ```bash
   cd client
   npm run dev
   # or
   pnpm dev
   ```

3. **Verify**
   - Open your chat app
   - Go to Profile page
   - Click "Create 3D Avatar"
   - The avatar creator should now use your production subdomain

### Step 6: Test the Integration

1. **Open Avatar Creator**
   - Navigate to Profile page
   - Click "Create 3D Avatar" button

2. **Create an Avatar**
   - Customize your avatar in Ready Player Me interface
   - Click "NEXT" or "Create Avatar"

3. **Verify Preview**
   - Avatar preview should appear
   - "Save as Profile Picture" button should be enabled

4. **Save Avatar**
   - Click "Save as Profile Picture"
   - Check if avatar is saved to your profile

---

## 🔧 Production Deployment

### For Vercel

1. **Go to Vercel Dashboard**
   - Visit: [https://vercel.com/dashboard](https://vercel.com/dashboard)
   - Select your project

2. **Add Environment Variable**
   - Go to **Settings** → **Environment Variables**
   - Click **"Add New"**
   - **Name**: `VITE_READY_PLAYER_ME_SUBDOMAIN`
   - **Value**: Your subdomain (e.g., `myapp`)
   - **Environments**: Select "Production", "Preview", "Development"
   - Click **"Save"**

3. **Redeploy**
   - Go to **Deployments** tab
   - Click **"Redeploy"** on latest deployment
   - Or push a new commit to trigger redeploy

### For Netlify

1. **Go to Netlify Dashboard**
   - Visit: [https://app.netlify.com/](https://app.netlify.com/)
   - Select your site

2. **Add Environment Variable**
   - Go to **Site Settings** → **Build & Deploy** → **Environment**
   - Click **"Add variable"**
   - **Key**: `VITE_READY_PLAYER_ME_SUBDOMAIN`
   - **Value**: Your subdomain (e.g., `myapp`)
   - Click **"Save"**

3. **Redeploy**
   - Go to **Deploys** tab
   - Click **"Trigger deploy"** → **"Deploy site"**

### For Other Platforms

1. **Find Environment Variables Section**
   - Look for "Environment Variables", "Config Vars", or "Settings"
   - Usually in project settings or deployment configuration

2. **Add Variable**
   - **Key**: `VITE_READY_PLAYER_ME_SUBDOMAIN`
   - **Value**: Your Ready Player Me subdomain
   - Make sure it's prefixed with `VITE_` for Vite projects

3. **Redeploy**
   - Trigger a new build/deployment

---

## 📊 Ready Player Me Pricing

### Free Tier (Recommended for Start)
- ✅ **10,000 avatar generations/month**
- ✅ Basic customization options
- ✅ Perfect for development and small apps
- ✅ No credit card required

### Pro Tier (If Needed Later)
- 💰 Higher generation limits
- 🚀 Premium features
- 📞 Priority support
- Check current pricing: [https://readyplayer.me/pricing](https://readyplayer.me/pricing)

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Account created at readyplayer.me
- [ ] Project created in studio.readyplayer.me
- [ ] Subdomain copied and saved
- [ ] `.env` file updated with subdomain
- [ ] Development server restarted
- [ ] Avatar creator loads with production subdomain
- [ ] Avatar can be created successfully
- [ ] Avatar preview appears (or shows fallback message)
- [ ] Avatar saves to profile correctly
- [ ] Environment variable added to production platform
- [ ] Production deployment successful

---

## 🐛 Troubleshooting

### Avatar Creator Not Loading

1. **Check Subdomain**
   - Verify subdomain is correct in `.env`
   - No `.readyplayer.me` suffix
   - No `https://` prefix

2. **Check Console**
   - Open browser DevTools (F12)
   - Look for errors
   - Check if iframe loads correctly

3. **Verify Project Status**
   - Go to [https://studio.readyplayer.me/](https://studio.readyplayer.me/)
   - Check if project is active
   - Ensure project hasn't been deleted

### Avatar Not Saving

1. **Check Backend**
   - Verify backend API is running
   - Check `/api/auth/update` endpoint
   - Review server logs

2. **Check Authentication**
   - Ensure user is logged in
   - Check auth token is valid

3. **Check Console**
   - Look for error messages
   - Verify avatar URL is being sent

### Preview Not Showing

- **In Demo Mode**: Expected - preview may not load
- **In Production**: Should work better
- **Fallback Message**: Shows "Avatar ready to save" - this is fine
- **Save Still Works**: Avatar can be saved even if preview doesn't load

---

## 📚 Additional Resources

- **API Documentation**: [https://docs.readyplayer.me/](https://docs.readyplayer.me/)
- **Avatar Creator SDK**: [https://docs.readyplayer.me/avatar-creator-sdk](https://docs.readyplayer.me/avatar-creator-sdk)
- **Support**: Contact through [https://studio.readyplayer.me/](https://studio.readyplayer.me/)
- **Community**: Check Ready Player Me Discord or forums

---

## 💡 Tips

1. **Start with Free Tier**: Test everything on free tier first
2. **Keep Subdomain Safe**: Don't share your subdomain publicly
3. **Monitor Usage**: Check your dashboard for avatar generation count
4. **Test Thoroughly**: Test avatar creation and saving before production
5. **Backup `.env`**: Keep your `.env` file secure and backed up

---

**Need Help?** Contact Ready Player Me support through your dashboard or check their documentation.

