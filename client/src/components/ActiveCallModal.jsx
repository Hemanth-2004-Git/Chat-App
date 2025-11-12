// client/src/components/ActiveCallModal.jsx

import React from 'react';
import { useCall } from '../../context/callcontext.jsx';
import assets from '../assets/assets';

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
          onLoadedMetadata={() => {
            // Force play on mobile/WebView
            if (remoteVideoRef.current) {
              remoteVideoRef.current.play().catch(err => {
                console.log('Auto-play prevented, will play on user interaction');
              });
            }
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

          {/* Speaker Button (placeholder for future enhancement) */}
          <button
            className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-all hover:scale-110 active:scale-95 opacity-50 cursor-not-allowed"
            title="Speaker (Coming soon)"
            disabled
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveCallModal;

