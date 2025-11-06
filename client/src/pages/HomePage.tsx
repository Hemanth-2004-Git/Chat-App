import React, { useState, useEffect, useContext, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import RightSidebar from '../components/RightSidebar'
import ChatContainer from '../components/ChatContainer'
import assets from '../assets/assets'
import { chatContext } from '../../context/chatcontext'

const HomePage = () => {
  const [showInfoPanel, setShowInfoPanel] = useState(false)
  const previousSelectedUserIdRef = useRef(null)
  const { selectedUser: contextSelectedUser, messages } = useContext(chatContext)

  // Listen for info icon click
  useEffect(() => {
    const handleToggleInfo = () => {
      if (contextSelectedUser) {
        setShowInfoPanel(prev => !prev)
      }
    }

    window.addEventListener('toggleInfo', handleToggleInfo)
    return () => {
      window.removeEventListener('toggleInfo', handleToggleInfo)
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
