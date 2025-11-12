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

// STUN server (for NAT discovery)
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' }
];

// TURN server (for relay when direct connection fails - essential for cross-network calls)
// Using OpenRelay free TURN server for reliable cross-network connectivity
const TURN_SERVERS = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
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
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const trackMonitorIntervalRef = useRef(null);
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
      console.log('🧊 Received ICE candidate from:', data.from);
      if (peerConnectionRef.current && data.candidate) {
        try {
          // Check if peer connection is in valid state
          if (peerConnectionRef.current.signalingState === 'closed') {
            console.warn('⚠️ Cannot add ICE candidate: peer connection is closed');
            return;
          }
          
          const candidate = new RTCIceCandidate(data.candidate);
          await peerConnectionRef.current.addIceCandidate(candidate);
          console.log('✅ ICE candidate added successfully');
        } catch (error) {
          // Don't log error if candidate was already added (common and harmless)
          if (error.message && !error.message.includes('already been added')) {
            console.error('Error adding ICE candidate:', error);
          }
        }
      } else {
        console.warn('⚠️ Received ICE candidate but peer connection or candidate missing');
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
          reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful answer
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

    const handleRestartIce = async (data) => {
      console.log('🔄 Received ICE restart offer:', data);
      if (peerConnectionRef.current && data.sdp) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await peerConnectionRef.current.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
          await peerConnectionRef.current.setLocalDescription(answer);
          
          const targetUserId = activeCall?.userId || incomingCall?.from;
          if (targetUserId && socket) {
            socket.emit('restart-ice-answer', {
              to: targetUserId,
              sdp: answer
            });
            console.log('📤 Sent ICE restart answer');
          }
        } catch (error) {
          console.error('Error handling ICE restart:', error);
        }
      }
    };

    const handleRestartIceAnswer = async (data) => {
      console.log('📥 Received ICE restart answer:', data);
      if (peerConnectionRef.current && data.sdp) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          console.log('✅ ICE restart answer processed');
        } catch (error) {
          console.error('Error handling ICE restart answer:', error);
        }
      }
    };

    const handleRenegotiate = async (data) => {
      console.log('🔄 Received renegotiation offer:', data);
      if (peerConnectionRef.current && data.sdp) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await peerConnectionRef.current.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
          await peerConnectionRef.current.setLocalDescription(answer);
          
          const targetUserId = activeCall?.userId || incomingCall?.from;
          if (targetUserId && socket) {
            socket.emit('renegotiate-answer', {
              to: targetUserId,
              answer: answer
            });
            console.log('📤 Sent renegotiation answer');
          }
        } catch (error) {
          console.error('Error handling renegotiation:', error);
        }
      }
    };

    const handleRenegotiateAnswer = async (data) => {
      console.log('📥 Received renegotiation answer:', data);
      if (peerConnectionRef.current && data.sdp) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          console.log('✅ Renegotiation answer processed');
        } catch (error) {
          console.error('Error handling renegotiation answer:', error);
        }
      }
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-answer', handleAnswer); // This handles the WebRTC answer
    socket.on('ice-candidate', handleICE);
    socket.on('restart-ice', handleRestartIce);
    socket.on('restart-ice-answer', handleRestartIceAnswer);
    socket.on('renegotiate', handleRenegotiate);
    socket.on('renegotiate-answer', handleRenegotiateAnswer);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-answer', handleAnswer);
      socket.off('ice-candidate', handleICE);
      socket.off('restart-ice', handleRestartIce);
      socket.off('restart-ice-answer', handleRestartIceAnswer);
      socket.off('renegotiate', handleRenegotiate);
      socket.off('renegotiate-answer', handleRenegotiateAnswer);
    };
  }, [socket]);

  // Create peer connection
  const createPeerConnection = () => {
    console.log('🔧 Creating RTCPeerConnection with configuration:', {
      iceServers: ICE_SERVERS.iceServers.length,
      iceCandidatePoolSize: ICE_SERVERS.iceCandidatePoolSize
    });
    
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    // Add local stream tracks
    if (localStreamRef.current) {
      const localStream = localStreamRef.current;
      localStream.getTracks().forEach(track => {
        console.log('🎤 Adding local track:', track.kind, track.id, 'enabled:', track.enabled);
        pc.addTrack(track, localStream);
      });
      console.log('✅ Local stream tracks added to peer connection');
    } else {
      console.warn('⚠️ No local stream available when creating peer connection');
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('📹 Received remote stream event');
      console.log('📹 Track kind:', event.track.kind);
      console.log('📹 Track id:', event.track.id);
      console.log('📹 Track enabled:', event.track.enabled);
      console.log('📹 Track readyState:', event.track.readyState);
      
      if (event.streams && event.streams.length > 0) {
        const remoteStream = event.streams[0];
        const tracks = remoteStream.getTracks();
        console.log('📹 Remote stream received with', tracks.length, 'tracks');
        
        // Log audio track details
        tracks.forEach(track => {
          if (track.kind === 'audio') {
            console.log('🎵 Remote audio track:', {
              id: track.id,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState
            });
          }
        });
        
        // Ensure all tracks are enabled and monitor for recovery
        tracks.forEach(track => {
          if (track.kind === 'audio') {
            track.enabled = true;
            console.log('🎵 Audio track enabled:', track.id, 'enabled:', track.enabled, 'muted:', track.muted, 'readyState:', track.readyState);
            
            // Monitor track state for recovery
            track.onended = () => {
              console.warn('⚠️ Audio track ended! Attempting recovery...');
              // Track ended - try to recover by checking if we can get a new stream
              recoverTrack(track);
            };
            
            track.onmute = () => {
              console.warn('⚠️ Audio track muted!');
            };
            
            track.onunmute = () => {
              console.log('✅ Audio track unmuted');
            };
            
            // Monitor track readyState changes (less aggressive logging)
            const checkTrackState = setInterval(() => {
              if (track.readyState === 'ended') {
                console.warn('⚠️ Track readyState changed to ended');
                
                // Check if this is a temporary state change (WebRTC might be switching tracks)
                setTimeout(() => {
                  // Check again after a delay
                  if (track.readyState === 'ended') {
                    // Also check if there are other live tracks
                    const stream = remoteStreamRef.current;
                    if (stream) {
                      const liveTracks = stream.getAudioTracks().filter(t => t.readyState === 'live');
                      if (liveTracks.length === 0) {
                        console.warn('⚠️ All tracks ended, attempting recovery...');
                        clearInterval(checkTrackState);
                        recoverTrack(track);
                      } else {
                        console.log('ℹ️ Track ended but other tracks are live, no recovery needed');
                      }
                    } else {
                      clearInterval(checkTrackState);
                      recoverTrack(track);
                    }
                  } else {
                    console.log('✅ Track recovered automatically');
                  }
                }, 2000);
              } else if (track.readyState === 'live') {
                // Log occasionally (not every 2 seconds)
                if (Math.random() < 0.1) { // 10% chance to log
                  console.log('✅ Remote audio active: track is live');
                }
              }
            }, 3000); // Check every 3 seconds instead of 2
            
            // Store interval for cleanup
            track._monitorInterval = checkTrackState;
          }
        });
        
        // Monitor stream active state (less aggressive - only log, don't immediately recover)
        const checkStreamActive = setInterval(() => {
          if (!remoteStream.active) {
            console.warn('⚠️ Remote stream became inactive!');
            
            // Check if there are any live tracks despite stream being inactive
            const liveTracks = remoteStream.getTracks().filter(t => t.readyState === 'live');
            if (liveTracks.length > 0) {
              console.log('ℹ️ Stream inactive but tracks are live, stream may recover...');
              // Don't clear interval - keep monitoring
              return;
            }
            
            // Check connection state before attempting recovery
            if (peerConnectionRef.current) {
              const pcState = peerConnectionRef.current.connectionState;
              if (pcState === 'connected' || pcState === 'connecting') {
                console.log('ℹ️ Connection still active, waiting for stream recovery...');
                // Wait a bit before attempting recovery
                setTimeout(() => {
                  if (!remoteStream.active && liveTracks.length === 0) {
                    console.warn('⚠️ Stream still inactive after waiting, attempting recovery...');
                    clearInterval(checkStreamActive);
                    recoverStream();
                  }
                }, 3000);
              } else {
                console.warn('⚠️ Connection state:', pcState, '- attempting recovery...');
                clearInterval(checkStreamActive);
                recoverStream();
              }
            } else {
              clearInterval(checkStreamActive);
              recoverStream();
            }
          } else {
            // Stream is active - log occasionally (not every 2 seconds)
            if (Math.random() < 0.1) { // 10% chance to log
              console.log('✅ Remote stream active');
            }
          }
        }, 3000); // Check every 3 seconds instead of 2
        
        remoteStream._activeCheck = checkStreamActive;
        
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
          // Try Web Audio API first (more reliable), fallback to HTML audio
          const playRemoteAudio = () => {
            if (!remoteVideoRef.current || !remoteVideoRef.current.srcObject) {
              console.warn('⚠️ Cannot play: audio element or stream missing');
              return;
            }
            
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
            
            // Try Web Audio API approach (more reliable for MediaStreams)
            try {
              // Create or reuse AudioContext
              if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
              }
              
              const audioContext = audioContextRef.current;
              
              // Resume audio context if suspended (required by some browsers)
              if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                  console.log('✅ AudioContext resumed');
                });
              }
              
              // Create media stream source
              if (audioSourceRef.current) {
                audioSourceRef.current.disconnect();
              }
              
              audioSourceRef.current = audioContext.createMediaStreamSource(stream);
              const gainNode = audioContext.createGain();
              gainNode.gain.value = 1.0; // Full volume
              
              audioSourceRef.current.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              console.log('✅ Using Web Audio API for playback');
              
              // Also set up HTML audio element as backup
              audio.muted = false;
              audio.volume = 1.0;
              audio.play().then(() => {
                console.log('✅ HTML audio also playing (backup)');
              }).catch(err => {
                console.log('HTML audio play failed (using Web Audio API):', err);
              });
              
            } catch (webAudioError) {
              console.warn('⚠️ Web Audio API failed, using HTML audio:', webAudioError);
              
              // Fallback to HTML audio element
              audio.muted = false;
              audio.volume = 1.0;
              
              console.log('▶️ Attempting to play remote audio via HTML element...');
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
                  if (audio.paused && stream.active && audioTrack.readyState === 'live') {
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
          // Parse candidate type from candidate string
          const candidateStr = event.candidate.candidate;
          let candidateType = 'unknown';
          if (candidateStr.includes('typ host')) {
            candidateType = 'host';
          } else if (candidateStr.includes('typ srflx')) {
            candidateType = 'srflx';
          } else if (candidateStr.includes('typ relay')) {
            candidateType = 'relay';
          } else if (candidateStr.includes('typ prflx')) {
            candidateType = 'prflx';
          }
          
          console.log(`🧊 Sending ICE candidate (type: ${candidateType}):`, {
            to: targetUserId,
            candidate: candidateStr.substring(0, 100) + '...',
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
            type: candidateType
          });
          
          // Log relay candidates specifically (TURN usage)
          if (candidateType === 'relay') {
            console.log('🔹 ICE candidate type: relay (TURN server active)');
          }
          
          socket.emit('ice-candidate', {
            to: targetUserId,
            candidate: event.candidate
          });
        } else {
          console.warn('⚠️ No target user ID for ICE candidate');
        }
      } else if (!event.candidate) {
        console.log('🧊 ICE gathering complete - no more candidates');
      }
    };
    
    // Log connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('🔌 ICE connection state:', pc.iceConnectionState);
      
      // If connection fails, try to restart ICE
      if (pc.iceConnectionState === 'failed') {
        console.warn('⚠️ ICE connection failed, attempting ICE restart...');
        try {
          // Check if restartIce is available and returns a Promise
          if (pc.restartIce && typeof pc.restartIce === 'function') {
            const restartPromise = pc.restartIce();
            if (restartPromise && typeof restartPromise.catch === 'function') {
              restartPromise.catch(err => {
                console.error('Failed to restart ICE:', err);
              });
            }
          } else {
            console.warn('⚠️ restartIce() not available in this browser');
          }
        } catch (err) {
          console.error('Error calling restartIce:', err);
        }
      }
      
      // Log connection quality
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('✅ ICE connection established successfully!');
        console.log('🔌 ICE connection state: connected');
        
        // Get detailed connection stats to verify TURN usage
        pc.getStats().then(stats => {
          let selectedPair = null;
          let localCandidate = null;
          let remoteCandidate = null;
          let usingRelay = false;
          
          stats.forEach(report => {
            // Find selected candidate pair
            if (report.type === 'candidate-pair' && report.selected) {
              selectedPair = report;
              console.log('📊 Selected candidate pair:', {
                state: report.state,
                priority: report.priority,
                bytesReceived: report.bytesReceived,
                bytesSent: report.bytesSent
              });
            }
            
            // Find local candidate details
            if (report.type === 'local-candidate' && selectedPair && report.id === selectedPair.localCandidateId) {
              localCandidate = report;
              console.log('📡 Local candidate:', {
                type: report.candidateType,
                ip: report.ip,
                port: report.port,
                protocol: report.protocol
              });
              if (report.candidateType === 'relay') {
                usingRelay = true;
                console.log('🔹 Using TURN relay (local)');
              }
            }
            
            // Find remote candidate details
            if (report.type === 'remote-candidate' && selectedPair && report.id === selectedPair.remoteCandidateId) {
              remoteCandidate = report;
              console.log('📡 Remote candidate:', {
                type: report.candidateType,
                ip: report.ip,
                port: report.port,
                protocol: report.protocol
              });
              if (report.candidateType === 'relay') {
                usingRelay = true;
                console.log('🔹 Using TURN relay (remote)');
              }
            }
          });
          
          // Summary
          if (usingRelay) {
            console.log('✅ Connection using TURN relay - Good for cross-network calls!');
          } else {
            console.log('ℹ️ Connection using direct P2P (no TURN relay)');
          }
        }).catch(err => {
          console.warn('Failed to get stats:', err);
        });
      } else if (pc.iceConnectionState === 'checking') {
        console.log('🔄 ICE connection state: checking (gathering candidates...)');
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn('⚠️ ICE connection state: disconnected');
        console.log('🔄 Attempting reconnection...');
        // Attempt to reconnect by restarting ICE
        attemptReconnection();
      } else if (pc.iceConnectionState === 'new') {
        console.log('🆕 ICE connection state: new');
      } else if (pc.iceConnectionState === 'checking') {
        console.log('🔄 ICE connection state: checking (gathering candidates...)');
      }
    };
    
    pc.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', pc.iceGatheringState);
      
      if (pc.iceGatheringState === 'complete') {
        console.log('✅ ICE gathering complete - all candidates collected');
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state:', pc.connectionState);
      console.log('🔌 Signaling state:', pc.signalingState);
      console.log('🔌 ICE connection state:', pc.iceConnectionState);
      
      if (pc.connectionState === 'connected') {
        console.log('✅ Peer connection established!');
        console.log('🎧 Remote audio should be playing...');
        
        // Log connection details and verify audio flow
        pc.getStats().then(stats => {
          let hasRelay = false;
          let hasHost = false;
          let hasSrflx = false;
          let audioBytesReceived = 0;
          let audioBytesSent = 0;
          
          stats.forEach(report => {
            if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
              if (report.candidateType === 'relay') {
                hasRelay = true;
                console.log('🔹 ICE candidate type: relay (TURN active)');
              }
              if (report.candidateType === 'host') hasHost = true;
              if (report.candidateType === 'srflx') hasSrflx = true;
            }
            
            // Check audio bytes flow
            if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
              audioBytesReceived = report.bytesReceived || 0;
            }
            if (report.type === 'outbound-rtp' && report.mediaType === 'audio') {
              audioBytesSent = report.bytesSent || 0;
            }
          });
          
          console.log('📊 Connection type summary:', {
            usingRelay: hasRelay,
            usingHost: hasHost,
            usingSrflx: hasSrflx,
            audioBytesReceived: audioBytesReceived,
            audioBytesSent: audioBytesSent,
            note: hasRelay 
              ? '✅ Using TURN (relay) - Excellent for cross-network calls!' 
              : hasSrflx 
                ? 'ℹ️ Using STUN (srflx) - May work for cross-network'
                : '⚠️ Using direct connection - May fail across different networks'
          });
          
          // Verify audio is flowing
          if (audioBytesReceived > 0) {
            console.log('✅ Audio bytes flowing - receiving audio data');
          } else {
            console.warn('⚠️ No audio bytes received yet - audio may not be working');
          }
        }).catch(err => {
          console.warn('Failed to get connection stats:', err);
        });
        
        // When connected, ensure remote audio plays
        setTimeout(() => {
          if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.muted = false;
            remoteVideoRef.current.volume = 1.0;
            remoteVideoRef.current.play().then(() => {
              console.log('🎧 Remote audio playing successfully!');
            }).catch(err => {
              console.log('Audio play on connection:', err);
            });
          }
        }, 500);
      } else if (pc.connectionState === 'connecting') {
        console.log('🔄 Connection state: connecting (establishing connection...)');
      } else if (pc.connectionState === 'failed') {
        console.error('❌ Connection state: failed');
        console.error('❌ Connection failed! This may be a NAT/firewall issue.');
        console.error('💡 Try: 1) Check firewall settings 2) Verify TURN server 3) Check network');
        
        // Try ICE restart before giving up
        setTimeout(() => {
          if (peerConnectionRef.current && peerConnectionRef.current.connectionState === 'failed') {
            console.log('🔄 Attempting ICE restart...');
            try {
              const pc = peerConnectionRef.current;
              // Check if restartIce is available and returns a Promise
              if (pc.restartIce && typeof pc.restartIce === 'function') {
                const restartPromise = pc.restartIce();
                if (restartPromise && typeof restartPromise.catch === 'function') {
                  restartPromise.catch(err => {
                    console.error('ICE restart failed:', err);
                    endCall();
                    toast.error('Call failed - Check network connection');
                  });
                } else {
                  // restartIce didn't return a Promise, handle gracefully
                  console.warn('⚠️ restartIce() did not return a Promise');
                  endCall();
                  toast.error('Call failed - Check network connection');
                }
              } else {
                console.warn('⚠️ restartIce() not available in this browser');
                endCall();
                toast.error('Call failed - Check network connection');
              }
            } catch (err) {
              console.error('Error calling restartIce:', err);
              endCall();
              toast.error('Call failed - Check network connection');
            }
          }
        }, 2000);
      } else if (pc.connectionState === 'disconnected') {
        console.warn('⚠️ Connection state: disconnected');
        console.log('🔄 Attempting reconnection...');
        // Attempt to reconnect
        attemptReconnection();
      } else if (pc.connectionState === 'closed') {
        console.log('🔌 Connection state: closed');
      } else if (pc.connectionState === 'new') {
        console.log('🆕 Connection state: new');
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Attempt reconnection when connection fails or disconnects
  const attemptReconnection = async () => {
    if (!peerConnectionRef.current || !socket || !activeCall) {
      return;
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached, ending call');
      endCall();
      toast.error('Call disconnected - Unable to reconnect');
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`🔄 Reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);

    try {
      const pc = peerConnectionRef.current;
      
      // Check if we can restart ICE
      if (pc.restartIce && typeof pc.restartIce === 'function') {
        const restartPromise = pc.restartIce();
        if (restartPromise && typeof restartPromise.catch === 'function') {
          await restartPromise;
          console.log('✅ ICE restart initiated');
        }
      } else {
        // Manual ICE restart by creating a new offer
        console.log('🔄 Creating re-offer for ICE restart...');
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        
        const targetUserId = activeCall.userId;
        if (targetUserId && socket) {
          socket.emit('restart-ice', {
            to: targetUserId,
            sdp: offer
          });
          console.log('📤 Sent re-offer for ICE restart');
        }
      }
    } catch (error) {
      console.error('❌ Reconnection attempt failed:', error);
      // Wait before next attempt
      setTimeout(() => {
        if (peerConnectionRef.current && peerConnectionRef.current.connectionState !== 'connected') {
          attemptReconnection();
        }
      }, 3000);
    }
  };

  // Recover track when it ends
  const recoverTrack = async (endedTrack) => {
    console.log('🔧 Attempting track recovery...');
    
    if (!peerConnectionRef.current || !remoteStreamRef.current) {
      console.warn('⚠️ Cannot recover: peer connection or stream missing');
      return;
    }

    // Wait a bit for new tracks to potentially arrive (WebRTC might be switching tracks)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if there are other active tracks
    const stream = remoteStreamRef.current;
    const audioTracks = stream.getAudioTracks();
    const activeTracks = audioTracks.filter(t => t.readyState === 'live' && t.id !== endedTrack.id);
    
    // Also check if peer connection has new tracks
    if (peerConnectionRef.current.getReceivers) {
      const receivers = peerConnectionRef.current.getReceivers();
      const receiverTracks = receivers
        .map(r => r.track)
        .filter(t => t && t.kind === 'audio' && t.readyState === 'live');
      
      if (receiverTracks.length > 0) {
        console.log('✅ Found active tracks from receivers, reattaching...');
        if (remoteVideoRef.current) {
          const newStream = new MediaStream(receiverTracks);
          remoteStreamRef.current = newStream;
          remoteVideoRef.current.srcObject = newStream;
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = 1.0;
          remoteVideoRef.current.play().catch(err => {
            console.warn('Failed to play recovered stream:', err);
          });
          return;
        }
      }
    }
    
    if (activeTracks.length > 0) {
      console.log('✅ Found active tracks, reattaching...');
      // Reattach active tracks to audio element
      if (remoteVideoRef.current) {
        const newStream = new MediaStream(activeTracks);
        remoteStreamRef.current = newStream;
        remoteVideoRef.current.srcObject = newStream;
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.play().catch(err => {
          console.warn('Failed to play recovered stream:', err);
        });
      }
    } else {
      // Check connection state before attempting reconnection
      const pc = peerConnectionRef.current;
      if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') {
        console.log('ℹ️ Connection still active, waiting for new tracks...');
        // Wait a bit more - new tracks might arrive
        setTimeout(() => {
          const stream = remoteStreamRef.current;
          if (stream) {
            const newTracks = stream.getAudioTracks().filter(t => t.readyState === 'live');
            if (newTracks.length > 0) {
              console.log('✅ New tracks arrived, reattaching...');
              if (remoteVideoRef.current) {
                const newStream = new MediaStream(newTracks);
                remoteStreamRef.current = newStream;
                remoteVideoRef.current.srcObject = newStream;
                remoteVideoRef.current.muted = false;
                remoteVideoRef.current.volume = 1.0;
                remoteVideoRef.current.play().catch(console.warn);
              }
            } else {
              console.warn('⚠️ No active tracks found after waiting, connection may be lost');
              // Only attempt reconnection if connection is actually failing
              if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                attemptReconnection();
              }
            }
          }
        }, 2000);
      } else {
        console.warn('⚠️ No active tracks found, connection state:', pc.connectionState);
        // Only reconnect if connection is actually failed/disconnected
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          attemptReconnection();
        }
      }
    }
  };

  // Recover stream when it becomes inactive
  const recoverStream = async () => {
    console.log('🔧 Attempting stream recovery...');
    
    if (!peerConnectionRef.current) {
      console.warn('⚠️ Cannot recover: peer connection missing');
      return;
    }

    // Try to reconnect
    attemptReconnection();
  };

  // Re-capture local audio if track ends
  const reCaptureLocalAudio = async () => {
    console.log('🔄 Re-capturing local audio...');
    
    try {
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

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Replace old tracks with new ones in peer connection
      if (peerConnectionRef.current && localStreamRef.current) {
        // Remove old tracks
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current.getSenders().forEach(sender => {
            if (sender.track === track) {
              peerConnectionRef.current.removeTrack(sender);
            }
          });
          track.stop();
        });
        
        // Add new tracks
        newStream.getAudioTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, newStream);
          track.onended = () => {
            console.warn('⚠️ Local audio track ended again, attempting to re-capture...');
            reCaptureLocalAudio();
          };
        });
        
        // Update local stream ref
        localStreamRef.current = newStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }
        
        // Trigger renegotiation
        if (peerConnectionRef.current.signalingState === 'stable') {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          
          const targetUserId = activeCall?.userId;
          if (targetUserId && socket) {
            socket.emit('renegotiate', {
              to: targetUserId,
              offer: offer
            });
            console.log('📤 Sent renegotiation offer for local audio re-capture');
          }
        }
        
        console.log('✅ Local audio re-captured and added to peer connection');
      }
    } catch (error) {
      console.error('❌ Failed to re-capture local audio:', error);
      toast.error('Failed to re-capture microphone');
    }
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

    // Verify HTTPS (required for WebRTC and getUserMedia)
    const isSecureContext = window.isSecureContext || 
                            location.protocol === 'https:' || 
                            location.hostname === 'localhost' || 
                            location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      toast.error('WebRTC requires HTTPS connection (or localhost)');
      return;
    }

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Microphone access not supported in this browser');
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

      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Microphone access granted, stream obtained:', stream);
      
      // Monitor local tracks for automatic re-capture if they end
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          console.warn('⚠️ Local audio track ended, attempting to re-capture...');
          reCaptureLocalAudio();
        };
      });
      
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
      
      // Store timeout ID to clear if call connects
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
        errorMessage = 'Microphone constraints not supported. Trying with default settings...';
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

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall || !socket) return;

    // Verify HTTPS (required for WebRTC and getUserMedia)
    const isSecureContext = window.isSecureContext || 
                            location.protocol === 'https:' || 
                            location.hostname === 'localhost' || 
                            location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      toast.error('WebRTC requires HTTPS connection (or localhost)');
      setIncomingCall(null);
      return;
    }

    // Check if getUserMedia is available
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
      
      // Monitor local tracks for automatic re-capture if they end
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          console.warn('⚠️ Local audio track ended, attempting to re-capture...');
          reCaptureLocalAudio();
        };
      });
      
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
        errorMessage = 'Microphone constraints not supported. Trying with default settings...';
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
    // Reset reconnect attempts
    reconnectAttemptsRef.current = 0;
    
    // Clear any playing check intervals
    if (remoteVideoRef.current && remoteVideoRef.current._playingCheck) {
      clearInterval(remoteVideoRef.current._playingCheck);
    }
    
    // Clear stream active checks
    if (remoteStreamRef.current && remoteStreamRef.current._activeCheck) {
      clearInterval(remoteStreamRef.current._activeCheck);
    }
    
    // Clear track monitor intervals
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => {
        if (track._monitorInterval) {
          clearInterval(track._monitorInterval);
        }
      });
    }
    
    // Clear track monitor interval ref
    if (trackMonitorIntervalRef.current) {
      clearInterval(trackMonitorIntervalRef.current);
      trackMonitorIntervalRef.current = null;
    }
    
    // Disconnect Web Audio API
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      } catch (err) {
        console.warn('Error disconnecting audio source:', err);
      }
    }
    
    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(err => {
        console.warn('Error closing AudioContext:', err);
      });
      audioContextRef.current = null;
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

