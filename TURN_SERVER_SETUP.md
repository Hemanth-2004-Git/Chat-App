# TURN Server Setup Guide

## Current Status

Your app is configured with multiple free TURN servers. Here's what to do:

## Option 1: Use Metered.ca Free Tier (Recommended - 100GB/month)

1. **Sign up**: Go to https://www.metered.ca/
2. **Get credentials**: After signup, you'll get:
   - Server URL: `turn:a.relay.metered.ca`
   - Username: (provided by Metered)
   - Password: (provided by Metered)

3. **Update credentials** in `client/context/callcontext.jsx`:
   ```javascript
   // Replace these lines (around line 44-58):
   {
     urls: 'turn:a.relay.metered.ca:80',
     username: 'YOUR_METERED_USERNAME',  // Replace this
     credential: 'YOUR_METERED_PASSWORD' // Replace this
   },
   ```

## Option 2: Self-Host Coturn (Best for Production)

See `COTURN_SETUP.md` for complete instructions.

**Quick Docker setup:**
```bash
docker run -d \
  --name coturn \
  -p 3478:3478/udp \
  -p 3478:3478/tcp \
  -p 5349:5349/udp \
  -p 5349:5349/tcp \
  -e EXTERNAL_IP=YOUR_SERVER_IP \
  -e USERNAME=yourusername \
  -e PASSWORD=yourpassword \
  coturn/coturn
```

Then update your config:
```javascript
{
  urls: 'turn:YOUR_SERVER_IP:3478',
  username: 'yourusername',
  credential: 'yourpassword'
}
```

## Option 3: Test Current Setup First

The current setup uses OpenRelay which should work. Test it:

1. **Test same network**: Open two tabs on same device - should work
2. **Test different networks**: 
   - Device 1: Wi-Fi
   - Device 2: Mobile data
   - Make a call

3. **Check console logs**:
   - Look for: `🔹 ICE candidate type: relay`
   - If you see this, TURN is working!
   - If you see `⚠️ Using direct connection`, TURN failed

## Troubleshooting

### If audio doesn't work across networks:

1. **Check console for errors**
2. **Verify TURN server is being used**:
   - Look for `🔹 ICE candidate type: relay` in logs
   - If not present, TURN servers aren't connecting

3. **Try self-hosting Coturn** (most reliable)

### Common Issues:

- **"Connection failed"**: TURN servers might be down or blocked
- **"No audio bytes"**: Check microphone permissions
- **"ICE disconnected"**: Network/firewall issue, need TURN relay

## Testing Tools

Use this to test your TURN server:
https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

Enter your TURN server details and click "Gather candidates" to test.

