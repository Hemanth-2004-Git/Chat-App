# VoIP Calling Setup Guide

This guide explains how to use the VoIP calling feature in your chat app.

## Features

✅ **Voice calling** - Make and receive voice calls like WhatsApp
✅ **Free STUN servers** - Uses Google's public STUN servers (no setup needed)
✅ **WebRTC** - Peer-to-peer audio communication
✅ **Real-time signaling** - Uses Socket.io for call signaling
✅ **Call controls** - Mute, end call, call timer
✅ **Incoming call notifications** - Beautiful modal for incoming calls

## How It Works

1. **Call Initiation**: Click the phone icon in the chat header to start a call
2. **Call Signaling**: The app uses Socket.io to exchange WebRTC offers/answers
3. **Peer Connection**: WebRTC establishes a direct peer-to-peer connection
4. **Audio Streaming**: Audio streams directly between users

## Free Resources Used

### STUN Servers (Free)
- Google's public STUN servers (no credentials needed)
- Automatically configured in the app

### TURN Servers (Optional)
For users behind strict firewalls/NAT, you may need TURN servers. Free options:

1. **Metered.ca** (100GB/month free)
   - Sign up at: https://www.metered.ca/
   - Get your credentials
   - Update `client/context/callcontext.jsx` with your credentials

2. **Twilio** (Free tier available)
   - Sign up at: https://www.twilio.com/
   - Get TURN server credentials
   - Update the ICE_SERVERS configuration

3. **Self-hosted TURN** (Free)
   - Use coturn: https://github.com/coturn/coturn
   - Deploy on a VPS (free tier available on many cloud providers)

## Configuration

### Adding TURN Servers (Optional)

Edit `client/context/callcontext.jsx`:

```javascript
const TURN_SERVERS = [
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'your-username',
    credential: 'your-password'
  }
];

const ICE_SERVERS = {
  iceServers: [
    ...STUN_SERVERS,
    ...TURN_SERVERS  // Uncomment this line
  ]
};
```

## Browser Permissions

The app will request microphone permissions when:
- Making a call
- Receiving a call

**Important**: Users must grant microphone permissions for calls to work.

## Testing

1. **Open two browser windows/tabs**
2. **Log in as two different users**
3. **Start a chat between them**
4. **Click the phone icon** in one window
5. **Accept the call** in the other window
6. **Test audio** - you should hear each other

## Troubleshooting

### No Audio
- Check browser permissions (microphone access)
- Check browser console for errors
- Ensure both users are online
- Try refreshing the page

### Call Not Connecting
- Check Socket.io connection (should see connection in console)
- Check if both users are online
- Check browser console for WebRTC errors
- If behind strict firewall, add TURN servers

### Call Drops
- Check network stability
- Check browser console for errors
- Ensure both users have stable internet

## Future Enhancements

- Video calling support
- Group calling
- Call history
- Call recording (with user consent)
- Push notifications for missed calls

## Security Notes

- All calls are peer-to-peer (not routed through server)
- Server only handles signaling (call setup)
- Audio streams directly between users
- No call recording by default

## Support

For issues or questions:
1. Check browser console for errors
2. Check server logs
3. Verify Socket.io connection
4. Verify WebRTC permissions

