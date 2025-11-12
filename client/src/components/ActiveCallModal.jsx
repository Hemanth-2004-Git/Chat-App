// client/src/components/ActiveCallModal.jsx

import React from 'react';
import { useCall } from '../../context/callcontext.jsx';
import assets from '../assets/assets';
import { toast } from 'react-hot-toast';

const ActiveCallModal = () => {
  const {
    activeCall,
    callDuration,
    isMuted,
    toggleMute,
    endCall,
    localVideoRef,
    remoteVideoRef
  } = useCall();

  // Debug: Log audio element state and ensure stream is attached
  React.useEffect(() => {
    if (activeCall) {
      // Wait a bit for the ref to be ready
      const checkRef = () => {
        if (remoteVideoRef.current) {
          const audio = remoteVideoRef.current;
          
          // If we have a stored stream but audio element doesn't have it, attach it
          // This handles the case where stream arrives before modal renders
          const interval = setInterval(() => {
            if (audio.srcObject) {
              const tracks = audio.srcObject.getTracks();
              console.log('🔊 Audio element state:', {
                paused: audio.paused,
                muted: audio.muted,
                volume: audio.volume,
                readyState: audio.readyState,
                srcObject: !!audio.srcObject,
                tracks: tracks.length,
                trackEnabled: tracks.length > 0 ? tracks[0].enabled : false,
                trackReadyState: tracks.length > 0 ? tracks[0].readyState : 'none'
              });
            } else {
              // Try to get stream from context if available
              console.log('⏳ Audio element has no stream yet');
            }
          }, 2000);
          
          return () => clearInterval(interval);
        } else {
          console.warn('⚠️ remoteVideoRef not ready yet');
        }
      };
      
      // Check immediately and retry if needed
      const timeout = setTimeout(checkRef, 100);
      return () => clearTimeout(timeout);
    }
  }, [activeCall]);

  if (!activeCall) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black z-50 flex flex-col">
      {/* Remote Video/Audio Area */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Remote video/audio display */}
        <div className="text-center">
          <div className="relative inline-block mb-6">
            <img
              src={activeCall.userProfilePic || assets.avatar_icon}
              alt={activeCall.userName}
              className="w-48 h-48 rounded-full object-cover border-4 border-[#00A884] shadow-2xl"
              onError={(e) => { e.target.src = assets.avatar_icon; }}
            />
            {/* Pulse animation */}
            <div className="absolute inset-0 rounded-full border-4 border-[#00A884] animate-pulse opacity-30"></div>
          </div>
          <h2 className="text-3xl font-semibold text-white mb-2">
            {activeCall.userName || 'Unknown User'}
          </h2>
          <p className="text-gray-400 text-lg">{callDuration}</p>
          <p className="text-gray-500 text-sm mt-2">Voice call</p>
        </div>

        {/* Hidden audio elements - Mobile/WebView compatible */}
        <audio 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="hidden"
          style={{ display: 'none' }}
          muted={false}
          volume={1.0}
          onLoadedMetadata={() => {
            // Force play when metadata is loaded
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.volume = 1.0;
              remoteVideoRef.current.muted = false;
              remoteVideoRef.current.play().catch(err => {
                console.log('Auto-play prevented, will play on user interaction:', err);
              });
            }
          }}
          onCanPlay={() => {
            // Also try to play when audio can play
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.volume = 1.0;
              remoteVideoRef.current.muted = false;
              remoteVideoRef.current.play().catch(console.error);
            }
          }}
          onPlay={() => {
            console.log('🎵 Remote audio started playing');
          }}
        />
        <audio 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          muted 
          className="hidden"
          style={{ display: 'none' }}
        />
      </div>

      {/* Call Controls */}
      <div className="bg-black/50 backdrop-blur-md border-t border-gray-700 p-6">
        <div className="flex items-center justify-center gap-6 max-w-md mx-auto">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {/* End Call Button */}
          <button
            onClick={endCall}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
            title="End Call"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Manual Audio Play Button - Fallback if auto-play fails */}
          <button
            onClick={() => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.muted = false;
                remoteVideoRef.current.volume = 1.0;
                if (remoteVideoRef.current.srcObject) {
                  remoteVideoRef.current.play().then(() => {
                    console.log('✅ Manual audio play successful');
                    toast.success('Audio playing');
                  }).catch(err => {
                    console.error('Manual audio play failed:', err);
                    toast.error('Failed to play audio. Check console for details.');
                  });
                } else {
                  toast.error('No audio stream available');
                }
              }
            }}
            className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            title="Play Audio (if not hearing)"
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveCallModal;

