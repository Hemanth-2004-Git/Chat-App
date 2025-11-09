import React, { useState, useEffect, useContext, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import RightSidebar from '../components/RightSidebar'
import ChatContainer from '../components/ChatContainer'
import assets from '../assets/assets'
import { chatContext } from '../../context/chatcontext'

// Extend Window interface for toggleInfoPanel
declare global {
  interface Window {
    toggleInfoPanel?: () => void
  }
}

const HomePage = () => {
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const previousSelectedUserIdRef = useRef<string | null>(null)
  const toggleInfoRef = useRef<(() => void) | null>(null)
  const { selectedUser: contextSelectedUser, messages } = useContext(chatContext)

  // Create toggle function and store it globally for direct access
  useEffect(() => {
    const toggleInfo = () => {
      if (contextSelectedUser) {
        setShowInfoPanel(prev => !prev)
      }
    }
    
    toggleInfoRef.current = toggleInfo
    // Also store on window for direct access (fallback for APK)
    if (typeof window !== 'undefined') {
      // @ts-ignore - Adding function to window for APK compatibility
      window.toggleInfoPanel = toggleInfo
    }

    // Listen for info icon click via CustomEvent (primary method)
    const handleToggleInfo = () => {
      toggleInfo()
    }

    window.addEventListener('toggleInfo', handleToggleInfo)
    return () => {
      window.removeEventListener('toggleInfo', handleToggleInfo)
      if (typeof window !== 'undefined' && 'toggleInfoPanel' in window) {
        delete window.toggleInfoPanel
      }
    }
  }, [contextSelectedUser])

  // Close info panel when user changes (different user selected) or when no user selected
  useEffect(() => {
    const currentUserId = contextSelectedUser?._id || contextSelectedUser?.uid || contextSelectedUser?.id || null
    const previousUserId = previousSelectedUserIdRef.current
    
    // If user changed (different user selected), close the info panel
    if (previousUserId !== null && currentUserId !== previousUserId) {
      setShowInfoPanel(false)
    }
    
    // If no user selected, close the info panel
    if (!contextSelectedUser) {
      setShowInfoPanel(false)
    }
    
    // Update previous selected user ID (using ref to avoid re-renders)
    previousSelectedUserIdRef.current = currentUserId
  }, [contextSelectedUser])

  return (
    <div 
      className="w-full h-screen sm:px-[15%] sm:py-[5%]"
      style={{
        backgroundImage: `url(${assets.bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll'
      }}
    >
      <div
        className={`backdrop-blur-xl border-2 border-gray-600/50 rounded-2xl h-[100%] grid grid-cols-1 relative bg-black/10 ${
          contextSelectedUser
            ? showInfoPanel
              ? 'md:grid-cols-[1fr_1.5fr_1fr] xl:grid-cols-[1fr_2fr_1fr]'
              : 'md:grid-cols-[1fr_2fr]'
            : 'md:grid-cols-2'
        }`}
      >

        <Sidebar  />
        <ChatContainer />
        {showInfoPanel && contextSelectedUser && (
          <RightSidebar 
            selectedUser={contextSelectedUser} 
            messages={messages || []} 
            onClose={() => setShowInfoPanel(false)} 
          />
        )}
      </div>
    </div>
  )
}

export default HomePage
