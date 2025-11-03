# Firebase Service Account Setup

## Getting Your Firebase Service Account JSON

### Step 1: Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the **⚙️ Settings** icon → **Project Settings**
4. Go to the **"Service Accounts"** tab
5. Click **"Generate New Private Key"**
6. Click **"Generate Key"** in the popup
7. A JSON file will download (e.g., `your-project-firebase-adminsdk-xxxxx.json`)

### Step 2: For Local Development

You have two options:

#### Option A: Use Environment Variable (Recommended)

1. Open the downloaded JSON file
2. Copy the **entire JSON content**
3. Create `.env` file in the `server` folder:
   ```bash
   cd server
   # Create .env file
   ```

4. Add to `.env`:
   ```env
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"..."}
   ```
   
   **Important**: 
   - Paste the entire JSON as a **single line**
   - No line breaks in the JSON
   - Keep all the quotes and structure intact

#### Option B: Use JSON File (Easier for local dev)

1. Copy the downloaded JSON file to `server` folder
2. Rename it to `serviceAccountKey.json`
3. The server will automatically use it

**Note**: `serviceAccountKey.json` is in `.gitignore` so it won't be committed to git.

### Step 3: For Render Deployment

On Render, you **MUST** use the environment variable (Option A above).

1. Go to Render Dashboard → Your backend service
2. Go to **Environment** tab
3. Add environment variable:
   - **Key**: `FIREBASE_SERVICE_ACCOUNT`
   - **Value**: Paste the entire JSON as a single-line string
   
   Example:
   ```
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"my-project","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk@my-project.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk%40my-project.iam.gserviceaccount.com"}
   ```

4. Click **"Save Changes"**
5. Render will automatically redeploy

## Troubleshooting

### Error: "serviceAccountKey.json file not found"

**For Local Development:**
- Make sure you have either:
  1. `.env` file in `server` folder with `FIREBASE_SERVICE_ACCOUNT` set, OR
  2. `serviceAccountKey.json` file in `server` folder

**For Render:**
- Make sure `FIREBASE_SERVICE_ACCOUNT` environment variable is set
- Verify the JSON is valid (no line breaks, proper formatting)
- Try copying the JSON again if it's not working

### Error: "Failed to parse FIREBASE_SERVICE_ACCOUNT"

- The JSON might have line breaks
- Make sure it's a single-line string
- Verify all quotes are escaped properly
- Try re-copying from the downloaded file

### How to Convert Multi-line JSON to Single Line

If your JSON file has line breaks, you can:

1. **Online Tool**: Use [jsonformatter.org](https://jsonformatter.org/json-minify)
2. **VS Code**: 
   - Select all JSON
   - Use "Join Lines" command (or Ctrl+Shift+P → "Join Lines")
3. **Command Line** (PowerShell):
   ```powershell
   (Get-Content path\to\your-file.json -Raw) -replace "`r`n", ""
   ```

### Quick Test

To verify your setup is working:

1. **Local**: Start your server
   ```bash
   cd server
   npm start
   ```
   You should see: `✅ Firebase Admin SDK Initialized`

2. **Render**: Check the logs in Render Dashboard
   - Go to your service → **Logs** tab
   - Look for: `✅ Firebase Admin SDK Initialized`

## Security Notes

⚠️ **Never commit these to Git:**
- `serviceAccountKey.json`
- `.env` files
- The service account JSON content

✅ **Already in .gitignore:**
- `serviceAccountKey.json`
- `.env` files

✅ **Safe to use:**
- Environment variables in Render Dashboard (they're encrypted)
- Environment variables locally (not in git)

## Example .env File Structure

Create `server/.env`:

```env
# Firebase - Required
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"my-chat-app","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk@my-chat-app.iam.gserviceaccount.com","client_id":"123456","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/..."}

# Cloudinary - Required
CLOUDINARY_CLOUD_NAME=my-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456

# Optional
FRONTEND_URL=http://localhost:5173
PORT=5000
```

---

**Once you set this up, restart your server and the Firebase error should be resolved!** ✅

