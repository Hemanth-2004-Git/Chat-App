// client/src/components/IncomingCallModal.jsx

import React from 'react';
import { useCall } from '../../context/callcontext.jsx';
import assets from '../assets/assets';

const IncomingCallModal = () => {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        {/* Caller Info */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <img
              src={incomingCall.userProfilePic || assets.avatar_icon}
              alt={incomingCall.userName}
              className="w-32 h-32 rounded-full object-cover border-4 border-[#00A884]"
              onError={(e) => { e.target.src = assets.avatar_icon; }}
            />
            <div className="absolute inset-0 rounded-full border-4 border-[#00A884] animate-ping opacity-20"></div>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">
            {incomingCall.userName || 'Unknown User'}
          </h2>
          <p className="text-gray-400">Incoming voice call</p>
        </div>

        {/* Call Controls */}
        <div className="flex items-center justify-center gap-6">
          {/* Reject Button */}
          <button
            onClick={rejectCall}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
            title="Reject"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Accept Button */}
          <button
            onClick={acceptCall}
            className="w-16 h-16 rounded-full bg-[#00A884] hover:bg-[#00B894] flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
            title="Accept"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;

