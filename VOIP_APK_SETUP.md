# VoIP Calling in APK - Setup Guide

This guide explains how VoIP calling works in your APK (Android WebView) app.

## Overview

The VoIP calling feature has been optimized to work in APK/WebView environments. It uses WebRTC for peer-to-peer audio communication, just like in the web version.

## Mobile/APK Optimizations

### 1. **Audio Element Configuration**
- Audio elements are configured with `playsinline` and `webkit-playsinline` attributes
- Auto-play handling for mobile browsers
- Proper muted state for local audio (prevents feedback)

### 2. **Microphone Permissions**
- Proper permission requests for Android WebView
- Better error messages for permission issues
- Mobile-specific audio constraints

### 3. **WebRTC Configuration**
- Mobile-optimized audio constraints
- Sample rate and channel configuration for Android
- Echo cancellation and noise suppression enabled

## Android Manifest Requirements

If you're building an APK using a WebView wrapper (like Cordova, Capacitor, or custom WebView), ensure your Android manifest includes:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

## WebView Configuration

### For Cordova

Add to `config.xml`:
```xml
<platform name="android">
    <config-file target="AndroidManifest.xml" parent="/manifest">
        <uses-permission android:name="android.permission.RECORD_AUDIO" />
        <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    </config-file>
</platform>
```

### For Capacitor

Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

### For Custom WebView

Ensure your WebView has:
```java
webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
webView.getSettings().setJavaScriptEnabled(true);
webView.getSettings().setDomStorageEnabled(true);
```

## Testing in APK

1. **Build your APK** with proper permissions
2. **Install on Android device**
3. **Grant microphone permission** when prompted
4. **Test calling** between two devices
5. **Check audio** - you should hear each other

## Common Issues & Solutions

### Issue: No Audio
**Solution:**
- Check Android permissions (Settings > Apps > Your App > Permissions)
- Ensure microphone permission is granted
- Check if another app is using the microphone
- Restart the app after granting permissions

### Issue: Call Not Connecting
**Solution:**
- Check internet connection
- Verify Socket.io connection (check console logs)
- Ensure both users are online
- Check WebView console for errors

### Issue: Auto-play Blocked
**Solution:**
- The app handles this automatically
- Audio will play on first user interaction (tap/click)
- This is normal behavior for mobile browsers

### Issue: Echo/Feedback
**Solution:**
- Local audio is automatically muted to prevent feedback
- Ensure you're using headphones for better quality
- Check device audio settings

## Mobile-Specific Features

1. **Touch-Optimized UI** - All buttons are touch-friendly
2. **Auto-play Handling** - Handles mobile browser auto-play restrictions
3. **Permission Management** - Clear error messages for permission issues
4. **Audio Optimization** - Mobile-specific audio constraints

## Performance Tips

1. **Use headphones** for better audio quality
2. **Close other apps** using the microphone
3. **Stable internet** connection recommended
4. **WiFi preferred** over mobile data for better quality

## Browser Compatibility

- ✅ Chrome (Android) - Full support
- ✅ Firefox (Android) - Full support
- ✅ Samsung Internet - Full support
- ✅ WebView (Android 5.0+) - Full support
- ⚠️ Older WebView versions may have limitations

## Security Notes

- All calls are peer-to-peer (not routed through server)
- Microphone access is only used during active calls
- Permissions are requested only when needed
- No call recording by default

## Troubleshooting

### Check Permissions
```javascript
// In browser console (if accessible)
navigator.permissions.query({ name: 'microphone' }).then(result => {
  console.log('Microphone permission:', result.state);
});
```

### Check WebRTC Support
```javascript
// In browser console
console.log('WebRTC supported:', !!window.RTCPeerConnection);
console.log('getUserMedia supported:', !!navigator.mediaDevices?.getUserMedia);
```

### Check Audio Elements
```javascript
// In browser console
const audio = document.querySelector('audio');
console.log('Audio element:', audio);
console.log('Can play:', audio?.canPlayType('audio/mpeg'));
```

## Support

For issues:
1. Check Android permissions
2. Check WebView console logs
3. Verify internet connection
4. Test in Chrome browser first (to isolate WebView issues)

