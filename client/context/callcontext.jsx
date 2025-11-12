// client/context/callcontext.jsx

import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';

// Detect mobile and WebView environment
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isWebView = window.navigator.standalone || 
                  window.matchMedia('(display-mode: standalone)').matches ||
                  /wv|WebView/i.test(navigator.userAgent) ||
                  (!window.chrome && navigator.userAgent.includes('Android'));

export const CallContext = createContext();

// Free STUN servers (Google's public STUN)
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

// Free TURN server (Metered.ca - 100GB/month free)
// You can also use your own TURN server or other free services
const TURN_SERVERS = [
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'a1b2c3d4e5f6g7h8i9j0', // Replace with your Metered.ca credentials
    credential: 'a1b2c3d4e5f6g7h8i9j0' // Replace with your Metered.ca credentials
  },
  {
    urls: 'turn:a.relay.metered.ca:443',
    username: 'a1b2c3d4e5f6g7h8i9j0',
    credential: 'a1b2c3d4e5f6g7h8i9j0'
  }
];

// For now, use only STUN (works for most cases)
// Add TURN servers if you have credentials
const ICE_SERVERS = {
  iceServers: [
    ...STUN_SERVERS,
    // Uncomment and add your TURN credentials if needed:
    // ...TURN_SERVERS
  ]
};

export const CallContextProvider = ({ children, socket }) => {
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, ringing, active, ended
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callTimerRef = useRef(null);
  const callStatusRef = useRef('idle');
  const [callDuration, setCallDuration] = useState(0);

  // Effect to ensure remote audio plays when stream is available
  useEffect(() => {
    if (activeCall) {
      // Function to check and attach stream if ref becomes available
      const checkAndAttachStream = () => {
        if (remoteVideoRef.current && remoteStreamRef.current) {
          const audio = remoteVideoRef.current;
          
          // If audio doesn't have the stream, attach it
          if (!audio.srcObject || audio.srcObject !== remoteStreamRef.current) {
            console.log('🔗 Attaching stored stream to audio element');
            audio.srcObject = remoteStreamRef.current;
            audio.muted = false;
            audio.volume = 1.0;
          }
          
          // Check if stream is available and try to play
          if (audio.srcObject) {
            audio.muted = false;
            audio.volume = 1.0;
            
            // Try to play audio
            const tryPlay = () => {
              if (audio.srcObject && audio.readyState >= 2) {
                audio.play().then(() => {
                  console.log('✅ Remote audio playing via useEffect');
                }).catch(err => {
                  console.log('Audio play attempt:', err);
                });
              }
            };
            
            tryPlay();
            
            // Also try when audio can play
            audio.addEventListener('canplay', tryPlay, { once: true });
            audio.addEventListener('loadedmetadata', tryPlay, { once: true });
            
            return () => {
              audio.removeEventListener('canplay', tryPlay);
              audio.removeEventListener('loadedmetadata', tryPlay);
            };
          }
        }
      };
      
      // Check immediately
      let cleanup = checkAndAttachStream();
      
      // Also check after delays (in case ref becomes available later)
      const timeouts = [
        setTimeout(() => { cleanup = checkAndAttachStream(); }, 100),
        setTimeout(() => { cleanup = checkAndAttachStream(); }, 500),
        setTimeout(() => { cleanup = checkAndAttachStream(); }, 1000),
        setTimeout(() => { cleanup = checkAndAttachStream(); }, 2000)
      ];
      
      return () => {
        if (cleanup) cleanup();
        timeouts.forEach(clearTimeout);
      };
    }
  }, [activeCall]);

  // Initialize socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      console.log('📞 Incoming call:', data);
      setIncomingCall(data);
      setCallStatus('ringing');
      callStatusRef.current = 'ringing';
      
      // Play ringtone (optional)
      // You can add a ringtone audio file here
    };

    const handleCallAccepted = (data) => {
      console.log('✅ Call accepted:', data);
      if (callStatusRef.current === 'calling') {
        setCallStatus('active');
        callStatusRef.current = 'active';
        setActiveCall(data);
        setIncomingCall(null);
        startCallTimer();
      }
    };

    const handleCallRejected = (data) => {
      console.log('❌ Call rejected:', data);
      // Reset call state without calling endCall to avoid cleanup issues
      setActiveCall(null);
      setIncomingCall(null);
      setCallStatus('idle');
      callStatusRef.current = 'idle';
      stopCallTimer();
      toast.error('Call rejected');
    };

    const handleCallEnded = (data) => {
      console.log('📴 Call ended:', data);
      // Reset call state
      setActiveCall(null);
      setIncomingCall(null);
      setCallStatus('idle');
      callStatusRef.current = 'idle';
      stopCallTimer();
      toast('Call ended', { icon: '📴' });
    };

    const handleCallAnswer = (data) => {
      console.log('📞 Call answered:', data);
      if (callStatusRef.current === 'calling') {
        setCallStatus('active');
        callStatusRef.current = 'active';
        setActiveCall(prev => prev || data);
        setIncomingCall(null);
        startCallTimer();
      }
    };

    const handleICE = async (data) => {
      console.log('🧊 Received ICE candidate:', data);
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    };

    const handleOffer = async (data) => {
      console.log('📥 Received offer:', data);
      // This is handled in acceptCall, but we can also handle it here if needed
      // The offer is already in incomingCall state
    };

    const handleAnswer = async (data) => {
      console.log('📥 Received answer:', data);
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setCallStatus('active');
          callStatusRef.current = 'active';
          startCallTimer();
          
          // Clear call timeout if exists
          if (peerConnectionRef.current._callTimeout) {
            clearTimeout(peerConnectionRef.current._callTimeout);
            peerConnectionRef.current._callTimeout = null;
          }
          
          // Ensure remote audio is ready to play when stream arrives
          setTimeout(() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.muted = false;
              if (remoteVideoRef.current.srcObject) {
                remoteVideoRef.current.play().catch(err => {
                  console.log('Remote audio play attempt after answer:', err);
                });
              }
            }
          }, 500);
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      }
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-answer', handleAnswer); // This handles the WebRTC answer
    socket.on('ice-candidate', handleICE);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-answer', handleAnswer);
      socket.off('ice-candidate', handleICE);
    };
  }, [socket]);

  // Create peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('🎤 Adding local track:', track.kind, track.id);
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📹 Received remote stream event:', event);
      console.log('📹 Streams:', event.streams);
      console.log('📹 Track:', event.track);
      
      if (event.streams && event.streams.length > 0) {
        const remoteStream = event.streams[0];
        const tracks = remoteStream.getTracks();
        console.log('📹 Remote stream tracks:', tracks);
        
        // Ensure all tracks are enabled
        tracks.forEach(track => {
          if (track.kind === 'audio') {
            track.enabled = true;
            console.log('🎵 Audio track enabled:', track.id, 'enabled:', track.enabled, 'muted:', track.muted, 'readyState:', track.readyState);
            
            // Monitor track state
            track.onended = () => {
              console.warn('⚠️ Audio track ended!');
            };
            
            track.onmute = () => {
              console.warn('⚠️ Audio track muted!');
            };
            
            track.onunmute = () => {
              console.log('✅ Audio track unmuted');
            };
          }
        });
        
        // Store stream in ref for later use
        remoteStreamRef.current = remoteStream;
        
        // Function to attach stream to audio element
        const attachStreamToAudio = () => {
          if (remoteVideoRef.current) {
            // Stop any existing stream tracks (but keep the stream object)
            if (remoteVideoRef.current.srcObject) {
              const oldTracks = remoteVideoRef.current.srcObject.getTracks();
              oldTracks.forEach(track => {
                if (track.readyState !== 'ended') {
                  track.stop();
                }
              });
            }
            
            // Create a new MediaStream with the tracks to ensure it stays alive
            const newStream = new MediaStream();
            tracks.forEach(track => {
              if (track.readyState !== 'ended') {
                newStream.addTrack(track);
              }
            });
            
            remoteVideoRef.current.srcObject = newStream;
          
          // Ensure remote audio is NOT muted and volume is set
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = 1.0;
          
          // Set attributes for proper playback
          remoteVideoRef.current.setAttribute('playsinline', 'true');
          remoteVideoRef.current.setAttribute('webkit-playsinline', 'true');
          remoteVideoRef.current.setAttribute('autoplay', 'true');
          
          console.log('🔊 Audio element configured:', {
            muted: remoteVideoRef.current.muted,
            volume: remoteVideoRef.current.volume,
            srcObject: !!remoteVideoRef.current.srcObject,
            readyState: remoteVideoRef.current.readyState
          });
          
          // Force play audio - works for both desktop and mobile
          const playRemoteAudio = () => {
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
              const audio = remoteVideoRef.current;
              const stream = audio.srcObject;
              const audioTracks = stream.getAudioTracks();
              
              // Check track state
              if (audioTracks.length === 0) {
                console.warn('⚠️ No audio tracks in stream!');
                return;
              }
              
              const audioTrack = audioTracks[0];
              console.log('🎵 Audio track state:', {
                enabled: audioTrack.enabled,
                muted: audioTrack.muted,
                readyState: audioTrack.readyState,
                id: audioTrack.id
              });
              
              // Ensure track is enabled
              if (!audioTrack.enabled) {
                console.log('🔧 Enabling audio track...');
                audioTrack.enabled = true;
              }
              
              // Ensure not muted and volume is max
              audio.muted = false;
              audio.volume = 1.0;
              
              console.log('▶️ Attempting to play remote audio...');
              audio.play().then(() => {
                console.log('✅ Remote audio playing successfully!');
                console.log('🔊 Audio state:', {
                  paused: audio.paused,
                  muted: audio.muted,
                  volume: audio.volume,
                  readyState: audio.readyState,
                  trackEnabled: audioTrack.enabled,
                  trackMuted: audioTrack.muted
                });
                
                // Monitor if audio pauses unexpectedly
                const checkPlaying = setInterval(() => {
                  if (audio.paused && stream.active) {
                    console.warn('⚠️ Audio paused unexpectedly, attempting to resume...');
                    audio.play().catch(err => {
                      console.warn('Failed to resume:', err);
                    });
                  }
                }, 1000);
                
                // Store interval to clear later
                audio._playingCheck = checkPlaying;
              }).catch(err => {
                console.warn('⚠️ Auto-play prevented, will retry:', err);
                // Retry on user interaction
                const retryPlay = () => {
                  if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
                    const audio = remoteVideoRef.current;
                    audio.muted = false;
                    audio.volume = 1.0;
                    console.log('🔄 Retrying audio play on user interaction...');
                    audio.play().then(() => {
                      console.log('✅ Remote audio playing after user interaction!');
                    }).catch(console.error);
                  }
                  document.removeEventListener('touchstart', retryPlay);
                  document.removeEventListener('click', retryPlay);
                  document.removeEventListener('touchend', retryPlay);
                };
                document.addEventListener('touchstart', retryPlay, { once: true });
                document.addEventListener('click', retryPlay, { once: true });
                document.addEventListener('touchend', retryPlay, { once: true });
              });
            } else {
              console.warn('⚠️ Cannot play: audio element or stream missing');
            }
          };
          
          // Try to play immediately
          setTimeout(playRemoteAudio, 100);
          
          // Also try when metadata is loaded
          remoteVideoRef.current.onloadedmetadata = () => {
            console.log('📋 Metadata loaded, attempting play...');
            playRemoteAudio();
          };
          
          // Also try on canplay event
          remoteVideoRef.current.oncanplay = () => {
            console.log('▶️ Can play, attempting play...');
            playRemoteAudio();
          };
          
          // Also try on play event
          remoteVideoRef.current.onplay = () => {
            console.log('🎵 Remote audio onplay event fired');
          };
          
          // Log when audio starts/stops
          remoteVideoRef.current.onplaying = () => {
            console.log('🎵 Remote audio is now playing!');
          };
          
          remoteVideoRef.current.onpause = () => {
            console.warn('⏸️ Remote audio paused');
            // Try to resume if stream is still active
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
              const stream = remoteVideoRef.current.srcObject;
              if (stream.active) {
                const tracks = stream.getAudioTracks();
                if (tracks.length > 0 && tracks[0].readyState === 'live') {
                  console.log('🔄 Attempting to resume paused audio...');
                  setTimeout(() => {
                    if (remoteVideoRef.current && !remoteVideoRef.current.paused) return;
                    remoteVideoRef.current?.play().catch(err => {
                      console.warn('Failed to resume:', err);
                    });
                  }, 100);
                }
              }
            }
          };
          
          remoteVideoRef.current.onerror = (e) => {
            console.error('❌ Remote audio error:', e);
          };
          
          // Monitor stream active state
          if (remoteStream) {
            const checkStreamActive = setInterval(() => {
              if (!remoteStream.active) {
                console.warn('⚠️ Remote stream became inactive!');
                clearInterval(checkStreamActive);
              }
            }, 2000);
            
            // Store interval reference
            remoteStream._activeCheck = checkStreamActive;
          }
          
          return true; // Successfully attached
        } else {
          console.warn('⚠️ remoteVideoRef.current is null, will retry...');
          return false; // Not ready yet
        }
      };
      
      // Try to attach immediately
      if (!attachStreamToAudio()) {
        // If ref is not ready, retry after a short delay
        // This can happen if the modal hasn't rendered yet
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = setInterval(() => {
          retryCount++;
          if (attachStreamToAudio() || retryCount >= maxRetries) {
            clearInterval(retryInterval);
            if (retryCount >= maxRetries) {
              console.error('❌ Failed to attach stream after', maxRetries, 'retries');
            }
          }
        }, 200);
      }
      } else {
        console.warn('⚠️ No streams in event');
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        const targetUserId = activeCall?.userId || incomingCall?.from;
        if (targetUserId) {
          console.log('🧊 Sending ICE candidate to:', targetUserId);
          socket.emit('ice-candidate', {
            to: targetUserId,
            candidate: event.candidate
          });
        }
      } else if (!event.candidate) {
        console.log('🧊 ICE gathering complete');
      }
    };
    
    // Log connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('🔌 ICE connection state:', pc.iceConnectionState);
    };
    
    pc.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', pc.iceGatheringState);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state:', pc.connectionState);
      console.log('🔌 Signaling state:', pc.signalingState);
      
      if (pc.connectionState === 'connected') {
        console.log('✅ Peer connection established!');
        // When connected, ensure remote audio plays
        setTimeout(() => {
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.muted = false;
            remoteVideoRef.current.volume = 1.0;
            remoteVideoRef.current.play().catch(err => {
              console.log('Audio play on connection:', err);
            });
          }
        }, 500);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        endCall();
        toast.error('Call disconnected');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Start call timer
  const startCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Stop call timer
  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
  };

  // Format call duration
  const formatCallDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initiate call
  const initiateCall = async (userId, userName, userProfilePic) => {
    if (!socket) {
      toast.error('Not connected to server');
      return;
    }

    try {
      setCallStatus('calling');
      callStatusRef.current = 'calling';
      setActiveCall({ userId, userName, userProfilePic, isIncoming: false });

      // Get user media (audio only for VoIP)
      // For mobile/WebView, request with specific constraints
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // For Android WebView, sometimes need to specify sample rate
          ...(isMobile && {
            sampleRate: 48000,
            channelCount: 1
          })
        },
        video: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // For mobile, ensure audio element is set up correctly
        if (isMobile || isWebView) {
          localVideoRef.current.setAttribute('playsinline', 'true');
          localVideoRef.current.setAttribute('webkit-playsinline', 'true');
          localVideoRef.current.muted = true; // Local audio should be muted to avoid feedback
        }
      }

      // Create peer connection
      const pc = createPeerConnection();

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

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
      
      // Store timeout ID to clear if call connects
      if (peerConnectionRef.current) {
        peerConnectionRef.current._callTimeout = timeoutId;
      }

    } catch (error) {
      console.error('Error initiating call:', error);
      
      // Better error messages for mobile
      let errorMessage = 'Failed to start call. ';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow microphone access in your browser/app settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage += 'Microphone is being used by another app.';
      } else {
        errorMessage += 'Please check microphone permissions.';
      }
      
      toast.error(errorMessage);
      endCall();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall || !socket) return;

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

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // For mobile, ensure audio element is set up correctly
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
        
        // Create answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

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

      // Ensure remote audio element is ready and not muted
      // Check multiple times as stream might arrive later
      const checkAndPlayAudio = () => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = 1.0;
          
          if (remoteVideoRef.current.srcObject) {
            const tracks = remoteVideoRef.current.srcObject.getTracks();
            console.log('🔊 Checking audio after accept:', {
              hasStream: !!remoteVideoRef.current.srcObject,
              tracks: tracks.length,
              trackEnabled: tracks.length > 0 ? tracks[0].enabled : false
            });
            
            remoteVideoRef.current.play().then(() => {
              console.log('✅ Remote audio playing after accept');
            }).catch(err => {
              console.log('Remote audio play attempt after accept:', err);
            });
          } else {
            console.log('⏳ Waiting for remote stream...');
          }
        }
      };
      
      // Check immediately and then retry
      checkAndPlayAudio();
      setTimeout(checkAndPlayAudio, 500);
      setTimeout(checkAndPlayAudio, 1000);
      setTimeout(checkAndPlayAudio, 2000);

      toast.success('Call connected');
    } catch (error) {
      console.error('Error accepting call:', error);
      
      // Better error messages for mobile
      let errorMessage = 'Failed to accept call. ';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow microphone access in your browser/app settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage += 'Microphone is being used by another app.';
      } else {
        errorMessage += 'Please check microphone permissions.';
      }
      
      toast.error(errorMessage);
      rejectCall();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    if (!incomingCall || !socket) return;

    socket.emit('reject-call', {
      to: incomingCall.from
    });

    setIncomingCall(null);
    setCallStatus('idle');
  };

  // End call
  const endCall = () => {
    // Clear any playing check intervals
    if (remoteVideoRef.current && remoteVideoRef.current._playingCheck) {
      clearInterval(remoteVideoRef.current._playingCheck);
    }
    
    // Clear stream active checks
    if (remoteStreamRef.current && remoteStreamRef.current._activeCheck) {
      clearInterval(remoteStreamRef.current._activeCheck);
    }
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Stop remote stream
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
      remoteStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear video refs
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Emit end call event
    if (socket && activeCall) {
      socket.emit('end-call', {
        to: activeCall.userId
      });
    }

    // Reset state
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('idle');
    callStatusRef.current = 'idle';
    setIsMuted(false);
    setIsVideoEnabled(false);
    stopCallTimer();
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle video (for future video call support)
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const value = {
    // State
    incomingCall,
    activeCall,
    callStatus,
    isMuted,
    isVideoEnabled,
    callDuration: formatCallDuration(callDuration),
    
    // Refs
    localVideoRef,
    remoteVideoRef,
    
    // Functions
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallContextProvider');
  }
  return context;
};

