# Ready Player Me Avatar Creator - Test Page

This is a standalone HTML test page to verify the Ready Player Me Avatar Creator integration works correctly.

## How to Use

1. **Open the test page:**
   - Navigate to: `http://localhost:5173/avatar-creator-test.html`
   - Or open it directly from the `public` folder in your browser

2. **Test the integration:**
   - Click "Open Ready Player Me" button
   - Customize your avatar in the iframe
   - Click "NEXT" or "Create Avatar" when finished
   - The avatar URL will be captured automatically
   - The iframe will hide and show the avatar preview

## Configuration

### For Demo/Testing:
- Uses `demo` subdomain (no configuration needed)
- Works immediately, no API keys required

### For Production:
1. Open `avatar-creator-test.html`
2. Find the `SUBDOMAIN` variable in the JavaScript section
3. Change from `'demo'` to your Ready Player Me subdomain
   ```javascript
   const SUBDOMAIN = 'your-subdomain'; // Change this
   ```

## What This Tests

- ✅ Iframe loading and display
- ✅ postMessage event listening
- ✅ `v1.avatar.exported` event capture
- ✅ Avatar URL extraction
- ✅ GLB to Render API URL conversion
- ✅ Avatar preview display
- ✅ Error handling

## Integration Pattern

This test page follows the official Ready Player Me integration pattern:

1. **Embed iframe:**
   ```html
   <iframe src="https://[SUBDOMAIN].readyplayer.me/avatar?frameApi"></iframe>
   ```

2. **Listen for events:**
   ```javascript
   window.addEventListener('message', (event) => {
     if (event.data.eventName === 'v1.avatar.exported') {
       const avatarUrl = event.data.data.url;
       // Handle avatar URL
     }
   });
   ```

3. **Hide iframe after creation:**
   ```javascript
   document.getElementById('avatarCreator').style.display = 'none';
   ```

## Troubleshooting

- **Iframe not loading:** Check your subdomain and network connection
- **Avatar URL not captured:** Check browser console for postMessage logs
- **Preview not showing:** Render API URLs may not work in demo mode; the URL is still valid for saving

## Related Files

- `client/src/components/AvatarCreator.jsx` - React component implementation
- `client/AVATAR_SETUP.md` - Production setup guide
- `READY_PLAYER_ME_SETUP.md` - Detailed Ready Player Me configuration

