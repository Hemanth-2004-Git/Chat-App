# Avatar Creator Troubleshooting

## Issue: Avatar URL is NULL

If you see debug output showing `avatarUrl: "NULL"`, this means the Ready Player Me iframe isn't successfully communicating the avatar URL back to your app.

## Common Causes & Solutions

### 1. Check Ready Player Me Subdomain Configuration

**Verify your environment variable:**
- Local development: Check `client/.env` file
- Production (Vercel): Check Vercel Dashboard → Environment Variables

The variable should be:
```
VITE_READY_PLAYER_ME_SUBDOMAIN=chatapp-t8bhfc
```

**Your subdomain:** `chatapp-t8bhfc` (from `ENV_SETUP.md`)

### 2. Check Browser Console

Open browser DevTools (F12) → Console tab and look for:

**Good signs:**
- ✅ `Message received from: chatapp-t8bhfc.readyplayer.me`
- ✅ `Ready Player Me message received:`
- ✅ `Avatar URL received from exported event:`

**Bad signs:**
- ❌ No messages from readyplayer.me
- ❌ `Message from invalid origin ignored`
- ❌ CORS errors
- ❌ Iframe failed to load

### 3. Verify Iframe URL

The iframe should load:
```
https://chatapp-t8bhfc.readyplayer.me/avatar?frameApi&clearCache=true
```

**In demo mode** (if subdomain not set):
```
https://demo.readyplayer.me/avatar?frameApi&clearCache=true
```

### 4. Steps to Debug

1. **Open Avatar Creator**
   - Click "Create 3D Avatar" on Profile page

2. **Open Browser Console**
   - Press F12 → Console tab

3. **Create an Avatar**
   - Customize your avatar in the iframe
   - Click "NEXT" or "Create Avatar"

4. **Check Console Messages**
   - You should see messages like:
     ```
     📨 Message received from: chatapp-t8bhfc.readyplayer.me
     ✅ Ready Player Me message received: {eventName: "v1.avatar.exported", ...}
     ✅ Avatar URL received from exported event: https://...
     ```

5. **If No Messages Appear:**
   - The iframe might not be loading correctly
   - Check Network tab for failed requests
   - Verify Ready Player Me subdomain is correct

### 5. Common Issues

#### Issue: Using Demo Mode
**Problem:** Demo mode has limitations and may not send avatar URLs consistently.

**Solution:** 
1. Get your Ready Player Me subdomain from [Ready Player Me Dashboard](https://readyplayer.me)
2. Set `VITE_READY_PLAYER_ME_SUBDOMAIN=chatapp-t8bhfc` in environment variables
3. Restart dev server or redeploy

#### Issue: Iframe Not Loading
**Problem:** The Ready Player Me iframe fails to load.

**Check:**
- Network tab for 404 or CORS errors
- Browser console for JavaScript errors
- Firewall/ad-blocker blocking the iframe

**Solution:**
- Whitelist `*.readyplayer.me` in ad-blocker
- Check browser network tab for blocked requests

#### Issue: Messages Not Received
**Problem:** Iframe loads but no postMessage events are received.

**Possible causes:**
- Browser extensions blocking messages
- Incorrect subdomain
- Ready Player Me service issue

**Solution:**
1. Try in incognito/private mode (disables extensions)
2. Verify subdomain in Ready Player Me dashboard
3. Check Ready Player Me status page

#### Issue: Wrong Message Format
**Problem:** Messages are received but not recognized.

**Check console for:**
```
📋 Non-RPM message format from Ready Player Me origin: {...}
```

This means the message format is different than expected. The code should handle this, but if it persists:

1. Check Ready Player Me documentation for latest API format
2. Update message detection logic if needed

### 6. Manual Testing

Test if Ready Player Me is working:

1. Open: `https://chatapp-t8bhfc.readyplayer.me/avatar` in a new tab
2. Create an avatar
3. See if you can download/save it
4. If this works, the issue is with postMessage communication

### 7. Production vs Development

**Development:**
- Uses `.env` file in `client/` folder
- Restart dev server after changing `.env`

**Production (Vercel):**
- Set environment variables in Vercel Dashboard
- Variables must start with `VITE_` for Vite projects
- Redeploy after adding/changing variables

### 8. Verify Configuration

Run this in browser console when Avatar Creator is open:

```javascript
// Check if iframe is loaded
const iframe = document.querySelector('iframe[title="Avatar Creator"]')
console.log('Iframe src:', iframe?.src)
console.log('Iframe loaded:', iframe?.contentWindow ? 'Yes' : 'No')

// Check environment variable
console.log('Subdomain:', import.meta.env.VITE_READY_PLAYER_ME_SUBDOMAIN || 'demo (default)')
```

### 9. Still Not Working?

1. **Check Ready Player Me Account:**
   - Go to [Ready Player Me Dashboard](https://readyplayer.me)
   - Verify your project is active
   - Check if there are any account limits

2. **Try Different Browser:**
   - Some browsers/extensions block postMessage
   - Try Chrome, Firefox, or Edge

3. **Check Network Tab:**
   - Look for requests to `readyplayer.me`
   - Check for CORS errors
   - Verify responses are successful (200 status)

4. **Review Code:**
   - Check `AvatarCreator.jsx` message listener
   - Verify event handlers are registered
   - Check for JavaScript errors in console

### 10. Quick Fix: Force Refresh

If avatar URL gets stuck:
1. Close the Avatar Creator modal
2. Clear browser cache (Ctrl+Shift+Delete)
3. Hard refresh page (Ctrl+Shift+R)
4. Open Avatar Creator again
5. Try creating avatar again

---

## Expected Flow

1. ✅ User clicks "Create 3D Avatar"
2. ✅ Modal opens, iframe loads Ready Player Me
3. ✅ User customizes avatar in iframe
4. ✅ User clicks "Create Avatar" or "NEXT"
5. ✅ Ready Player Me sends `v1.avatar.exported` event
6. ✅ AvatarCreator receives postMessage with avatar URL
7. ✅ `avatarUrl` state is updated
8. ✅ Preview appears, "Save" button becomes enabled

If any step fails, check the console logs to see where it stops.

---

## Getting Help

If you've tried everything and it still doesn't work:

1. **Collect Debug Info:**
   - Screenshot of browser console (with all messages)
   - Screenshot of Network tab (filtered to "readyplayer.me")
   - Screenshot of Avatar Creator modal
   - Your Ready Player Me subdomain

2. **Check:**
   - Ready Player Me documentation
   - Ready Player Me community forums
   - Ready Player Me support

3. **Temporary Workaround:**
   - Users can upload profile pictures manually instead of using avatar creator
   - The avatar creator is optional, not required

