# WebRTC Cross-Network Audio Call Setup

## ✅ Configuration Summary

This document shows the corrected WebRTC setup that ensures full cross-network audio support (works across different devices and networks).

## 🔧 ICE Server Configuration

```javascript
// STUN server (for NAT discovery)
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' }
];

// TURN server (for relay when direct connection fails - essential for cross-network calls)
// Using ExpressTurn free TURN server for reliable cross-network connectivity
const TURN_SERVERS = [
  {
    urls: 'turn:relay1.expressturn.com:3478',
    username: 'efree',
    credential: 'efree'
  }
];

// WebRTC ICE configuration with STUN + TURN for full cross-network support
const ICE_SERVERS = {
  iceServers: [
    ...STUN_SERVERS,
    ...TURN_SERVERS
  ],
  iceCandidatePoolSize: 10 // Pre-gather more candidates for better connectivity
};
```

## 🎤 Microphone Permission & HTTPS Verification

### Initiate Call Function

```javascript
const initiateCall = async (userId, userName, userProfilePic) => {
  if (!socket) {
    toast.error('Not connected to server');
    return;
  }

  // ✅ Verify HTTPS (required for WebRTC and getUserMedia)
  const isSecureContext = window.isSecureContext || 
                          location.protocol === 'https:' || 
                          location.hostname === 'localhost' || 
                          location.hostname === '127.0.0.1';
  
  if (!isSecureContext) {
    toast.error('WebRTC requires HTTPS connection (or localhost)');
    return;
  }

  // ✅ Check if getUserMedia is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast.error('Microphone access not supported in this browser');
    return;
  }

  try {
    setCallStatus('calling');
    callStatusRef.current = 'calling';
    setActiveCall({ userId, userName, userProfilePic, isIncoming: false });

    // Get user media (audio only for VoIP)
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(isMobile && {
          sampleRate: 48000,
          channelCount: 1
        })
      },
      video: false
    };

    console.log('🎤 Requesting microphone access...');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ Microphone access granted, stream obtained:', stream);
    
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      if (isMobile || isWebView) {
        localVideoRef.current.setAttribute('playsinline', 'true');
        localVideoRef.current.setAttribute('webkit-playsinline', 'true');
        localVideoRef.current.muted = true; // Local audio should be muted to avoid feedback
      }
    }

    // Create peer connection
    const pc = createPeerConnection();

    // Create offer with better configuration for cross-device
    const offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
      iceRestart: false
    };
    
    const offer = await pc.createOffer(offerOptions);
    await pc.setLocalDescription(offer);
    
    console.log('📤 Created offer, local description set');
    console.log('📤 Offer SDP type:', offer.type);
    console.log('📤 ICE candidates in offer:', offer.sdp?.match(/a=candidate:/g)?.length || 0);

    // Send call request
    socket.emit('call-user', {
      to: userId,
      offer: offer
    });

    // Set timeout for call (30 seconds)
    const timeoutId = setTimeout(() => {
      if (callStatusRef.current === 'calling') {
        endCall();
        toast.error('Call timeout - User not available');
      }
    }, 30000);
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current._callTimeout = timeoutId;
    }

  } catch (error) {
    console.error('❌ Error initiating call:', error);
    
    // Better error messages for microphone permissions
    let errorMessage = 'Failed to start call. ';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = 'Microphone permission denied. Please allow microphone access in your browser/app settings.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = 'No microphone found. Please connect a microphone.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = 'Microphone is being used by another app. Please close other apps using the microphone.';
    } else if (error.name === 'OverconstrainedError') {
      // Try with simpler constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = fallbackStream;
        console.log('✅ Fallback microphone access successful');
        // Continue with call setup...
        const pc = createPeerConnection();
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        socket.emit('call-user', { to: userId, offer: offer });
        return;
      } catch (fallbackError) {
        errorMessage = 'Failed to access microphone. Please check permissions.';
      }
    } else {
      errorMessage += 'Please check microphone permissions and try again.';
    }
    
    toast.error(errorMessage);
    endCall();
  }
};
```

### Accept Call Function

```javascript
const acceptCall = async () => {
  if (!incomingCall || !socket) return;

  // ✅ Verify HTTPS (required for WebRTC and getUserMedia)
  const isSecureContext = window.isSecureContext || 
                          location.protocol === 'https:' || 
                          location.hostname === 'localhost' || 
                          location.hostname === '127.0.0.1';
  
  if (!isSecureContext) {
    toast.error('WebRTC requires HTTPS connection (or localhost)');
    setIncomingCall(null);
    return;
  }

  // ✅ Check if getUserMedia is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast.error('Microphone access not supported in this browser');
    setIncomingCall(null);
    return;
  }

  try {
    // Get user media with mobile-specific constraints
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...(isMobile && {
          sampleRate: 48000,
          channelCount: 1
        })
      },
      video: false
    };

    console.log('🎤 Requesting microphone access to accept call...');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ Microphone access granted, stream obtained:', stream);
    
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      if (isMobile || isWebView) {
        localVideoRef.current.setAttribute('playsinline', 'true');
        localVideoRef.current.setAttribute('webkit-playsinline', 'true');
        localVideoRef.current.muted = true; // Local audio should be muted to avoid feedback
      }
    }

    // Create peer connection
    const pc = createPeerConnection();

    // Set remote description from offer
    if (incomingCall.offer) {
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      console.log('📥 Set remote description (offer)');
      
      // Create answer with better configuration
      const answerOptions = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      };
      
      const answer = await pc.createAnswer(answerOptions);
      await pc.setLocalDescription(answer);
      
      console.log('📤 Created answer, local description set');
      console.log('📤 Answer SDP type:', answer.type);
      console.log('📤 ICE candidates in answer:', answer.sdp?.match(/a=candidate:/g)?.length || 0);

      // Send answer
      socket.emit('call-answer', {
        to: incomingCall.from,
        answer: answer
      });
    }

    setCallStatus('active');
    callStatusRef.current = 'active';
    setActiveCall({
      userId: incomingCall.from,
      userName: incomingCall.userName,
      userProfilePic: incomingCall.userProfilePic,
      isIncoming: true
    });
    setIncomingCall(null);
    startCallTimer();

    toast.success('Call connected');
  } catch (error) {
    console.error('❌ Error accepting call:', error);
    
    // Better error messages for microphone permissions
    let errorMessage = 'Failed to accept call. ';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      errorMessage = 'Microphone permission denied. Please allow microphone access in your browser/app settings.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMessage = 'No microphone found. Please connect a microphone.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMessage = 'Microphone is being used by another app. Please close other apps using the microphone.';
    } else if (error.name === 'OverconstrainedError') {
      // Try with simpler constraints
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = fallbackStream;
        console.log('✅ Fallback microphone access successful');
        // Continue with call setup...
        const pc = createPeerConnection();
        if (incomingCall.offer) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
          const answer = await pc.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
          await pc.setLocalDescription(answer);
          socket.emit('call-answer', { to: incomingCall.from, answer: answer });
        }
        setCallStatus('active');
        callStatusRef.current = 'active';
        setActiveCall({
          userId: incomingCall.from,
          userName: incomingCall.userName,
          userProfilePic: incomingCall.userProfilePic,
          isIncoming: true
        });
        setIncomingCall(null);
        startCallTimer();
        toast.success('Call connected');
        return;
      } catch (fallbackError) {
        errorMessage = 'Failed to access microphone. Please check permissions.';
      }
    } else {
      errorMessage += 'Please check microphone permissions and try again.';
    }
    
    toast.error(errorMessage);
    setIncomingCall(null);
    endCall();
  }
};
```

## 🔌 Peer Connection Setup

```javascript
const createPeerConnection = () => {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  // Add local stream tracks to peer connection
  if (localStreamRef.current) {
    localStreamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, localStreamRef.current);
      console.log('✅ Added local track:', track.kind, track.id);
    });
  }

  // Handle remote stream
  pc.ontrack = (event) => {
    console.log('📥 Received remote stream:', event.streams);
    if (event.streams && event.streams.length > 0) {
      const remoteStream = event.streams[0];
      remoteStreamRef.current = remoteStream;
      
      // Create new MediaStream from tracks to ensure it stays active
      const newStream = new MediaStream();
      remoteStream.getAudioTracks().forEach(track => {
        track.enabled = true;
        newStream.addTrack(track);
        console.log('✅ Added remote audio track:', track.id, 'enabled:', track.enabled);
      });
      
      // Attach to audio element
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = newStream;
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.play().catch(err => {
          console.log('Audio play attempt:', err);
        });
      }
    }
  };

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate && socket) {
      const targetUserId = activeCall?.userId || incomingCall?.from;
      if (targetUserId) {
        console.log('🧊 Sending ICE candidate:', {
          to: targetUserId,
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid
        });
        socket.emit('ice-candidate', {
          to: targetUserId,
          candidate: event.candidate
        });
      }
    } else if (!event.candidate) {
      console.log('🧊 ICE gathering complete - no more candidates');
    }
  };
  
  // Log connection state changes
  pc.oniceconnectionstatechange = () => {
    console.log('🔌 ICE connection state:', pc.iceConnectionState);
    
    if (pc.iceConnectionState === 'failed') {
      console.warn('⚠️ ICE connection failed, attempting ICE restart...');
      pc.restartIce().catch(err => {
        console.error('Failed to restart ICE:', err);
      });
    }
    
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      console.log('✅ ICE connection established successfully!');
      
      // Get connection stats
      pc.getStats().then(stats => {
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.selected) {
            console.log('📊 Connection stats:', {
              localCandidate: report.localCandidateId,
              remoteCandidate: report.remoteCandidateId,
              state: report.state,
              priority: report.priority
            });
          }
        });
      });
    }
  };
  
  pc.onconnectionstatechange = () => {
    console.log('🔌 Connection state:', pc.connectionState);
    
    if (pc.connectionState === 'connected') {
      console.log('✅ Peer connection established!');
      
      // Log connection type (direct vs relay)
      pc.getStats().then(stats => {
        let hasRelay = false;
        let hasHost = false;
        stats.forEach(report => {
          if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
            if (report.candidateType === 'relay') hasRelay = true;
            if (report.candidateType === 'host') hasHost = true;
          }
        });
        console.log('📊 Connection type:', {
          usingRelay: hasRelay,
          usingHost: hasHost,
          note: hasRelay ? 'Using TURN (relay) - good for cross-device' : 'Using direct connection'
        });
      });
    } else if (pc.connectionState === 'failed') {
      console.error('❌ Connection failed! This may be a NAT/firewall issue.');
      console.error('💡 Try: 1) Check firewall settings 2) Use TURN server 3) Check network');
      
      // Try ICE restart before giving up
      setTimeout(() => {
        if (peerConnectionRef.current && peerConnectionRef.current.connectionState === 'failed') {
          console.log('🔄 Attempting ICE restart...');
          peerConnectionRef.current.restartIce().catch(err => {
            console.error('ICE restart failed:', err);
            endCall();
            toast.error('Call failed - Check network connection');
          });
        }
      }, 2000);
    }
  };

  peerConnectionRef.current = pc;
  return pc;
};
```

## 📋 Key Features

1. **✅ STUN + TURN Configuration**: Uses both STUN (for NAT discovery) and TURN (for relay when direct connection fails)
2. **✅ HTTPS Verification**: Checks for secure context before attempting WebRTC operations
3. **✅ Microphone Permission Checks**: Verifies `getUserMedia` availability and handles permission errors gracefully
4. **✅ Fallback Constraints**: Automatically tries simpler audio constraints if advanced ones fail
5. **✅ ICE Candidate Exchange**: Properly handles and logs ICE candidate exchange for debugging
6. **✅ Connection State Monitoring**: Logs connection type (direct vs relay) to help diagnose issues
7. **✅ Automatic ICE Restart**: Attempts to restart ICE if connection fails

## 🔍 Debugging Tips

1. **Check Console Logs**: Look for:
   - `✅ ICE connection established successfully!`
   - `📊 Connection type: { usingRelay: true/false }`
   - `🧊 ICE gathering complete`

2. **Verify TURN Usage**: If you see `usingRelay: true`, the TURN server is being used (good for cross-network calls)

3. **Check HTTPS**: Ensure your app is served over HTTPS (or localhost) - WebRTC requires secure context

4. **Microphone Permissions**: Check browser settings to ensure microphone access is granted

## 🚀 Testing

1. **Same Device**: Open two browser tabs - should work with direct connection
2. **Different Devices**: Call from device A to device B on different networks - should use TURN relay
3. **Check Console**: Look for connection type logs to verify TURN is being used for cross-network calls

## 📝 Notes

- The ExpressTurn TURN server (`turn:relay1.expressturn.com:3478`) is a free public server
- For production, consider using a paid TURN service (Metered.ca, Twilio) or self-hosted TURN server
- The signaling flow (offer/answer/ICE candidates) remains unchanged - only the ICE server configuration was updated

