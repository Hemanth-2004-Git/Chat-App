# Environment Variables Setup

## Ready Player Me Configuration

Your Ready Player Me subdomain: **chatapp-t8bhfc**

### Setup Steps

1. **Create a `.env` file** in the `client` directory (if it doesn't exist)

2. **Add the following line:**
   ```
   VITE_READY_PLAYER_ME_SUBDOMAIN=chatapp-t8bhfc
   ```

3. **Restart your development server** for the changes to take effect:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   npm run dev
   # or
   pnpm dev
   ```

### Full .env File Example

Create `client/.env` with:
```
VITE_READY_PLAYER_ME_SUBDOMAIN=chatapp-t8bhfc
```

### Verify It's Working

1. Open your app and go to Profile page
2. Click "Create 3D Avatar"
3. The iframe should load from: `https://chatapp-t8bhfc.readyplayer.me/avatar`
4. Check browser console - you should see logs confirming the subdomain

### Troubleshooting

- **If the iframe doesn't load:**
  - Verify `.env` file exists in `client/` directory
  - Make sure variable name is exactly: `VITE_READY_PLAYER_ME_SUBDOMAIN`
  - Restart the dev server after creating/editing `.env`
  - Check browser console for errors

- **Still using demo mode:**
  - Clear browser cache
  - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
  - Verify the `.env` file is in the correct location (`client/.env`, not root)

### Test Page

You can also test the integration using the standalone HTML page:
- Open: `http://localhost:5173/avatar-creator-test.html`
- The test page is already configured with your subdomain

