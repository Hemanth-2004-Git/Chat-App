import React, {useEffect, useRef, useState} from 'react'
import assets from '../assets/assets'
import { formatMessageTime, formatMessageDate } from '../libs/utils'
import { chatContext } from '../../context/chatcontext.jsx'
import { authcontext } from '../../context/authcontext.jsx'
import { useCall } from '../../context/callcontext.jsx'
import { useContext } from 'react'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import ForwardMessageModal from './ForwardMessageModal'
import ImageViewerModal from './ImageViewerModal'
import EmojiPicker from './EmojiPicker'
import CameraModal from './CameraModal'

const ChatContainer = () => {
  const {messages, selectedUser, setSelectedUser, sendMessage, getMessages, users, deleteMessage, editMessage, forwardMessage, loadingMessages} = useContext(chatContext)
  const {authuser, onlineUsers, logout, socket} = useContext(authcontext)
  const { initiateCall, activeCall } = useCall()
  const navigate = useNavigate()

  const scrollEnd = useRef()
  const inputAreaRef = useRef()
  const [input, setInput] = useState('')
  const [hoveredMessageId, setHoveredMessageId] = useState(null)
  const [showDeleteMenu, setShowDeleteMenu] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [editText, setEditText] = useState('')
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [messagesToForward, setMessagesToForward] = useState([])
  const [viewingImage, setViewingImage] = useState(null)
  const [showCamera, setShowCamera] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [typingUsers, setTypingUsers] = useState([])
  const typingTimeoutRef = useRef(null)
  const [swipeOffset, setSwipeOffset] = useState({})
  const [swipingMessageId, setSwipingMessageId] = useState(null)
  const touchStartRef = useRef({})
  const [showMediaInfo, setShowMediaInfo] = useState(false)
  const containerSwipeStartRef = useRef(null)

  // Typing indicator logic
  useEffect(() => {
    if (!socket || !selectedUser || editingMessage) return;

    const handleTyping = () => {
      if (!isTyping) {
        setIsTyping(true);
        const receiverId = selectedUser._id || selectedUser.uid;
        const isGroup = selectedUser.isGroup === true;
        
        socket.emit("typing", {
          receiverId,
          isGroup,
          senderId: authuser?._id || authuser?.uid,
          senderName: authuser?.fullName || 'Someone'
        });
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing indicator after 3 seconds of no typing
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        const receiverId = selectedUser._id || selectedUser.uid;
        const isGroup = selectedUser.isGroup === true;
        
        socket.emit("stoptyping", {
          receiverId,
          isGroup,
          senderId: authuser?._id || authuser?.uid
        });
      }, 3000);
    };

    if (input.trim()) {
      handleTyping();
    } else {
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [input, socket, selectedUser, isTyping, editingMessage, authuser]);

  // Listen for typing events - only show for currently selected chat
  useEffect(() => {
    if (!socket || !selectedUser) return;

    const handleUserTyping = (data) => {
      const { senderId, senderName, groupId } = data;
      const currentUserId = authuser?._id || authuser?.uid;
      
      // Don't show typing indicator for own messages
      if (senderId === currentUserId) return;

      // Check if this typing event is for the currently selected chat
      const selectedUserId = selectedUser._id || selectedUser.uid;
      const isGroup = selectedUser.isGroup === true;
      
      // For direct messages: only show if sender is typing to the selected user
      // For groups: only show if it's for the current group
      if (isGroup) {
        // For groups, check if the groupId matches
        if (groupId !== selectedUserId) {
          return; // Not for this group, ignore
        }
      } else {
        // For direct messages, check if the sender is the selected user
        if (senderId !== selectedUserId) {
          return; // Not typing to the selected user, ignore
        }
      }

      // Only show typing indicator if it's for the current chat
      setTypingUsers(prev => {
        if (!prev.find(u => u.senderId === senderId)) {
          return [...prev, { senderId, senderName: senderName || 'Someone' }];
        }
        return prev;
      });

      // Remove typing indicator after 5 seconds
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u.senderId !== senderId));
      }, 5000);
    };

    const handleUserStopTyping = (data) => {
      const { senderId, groupId } = data;
      const selectedUserId = selectedUser._id || selectedUser.uid;
      const isGroup = selectedUser.isGroup === true;
      
      // Only remove typing indicator if it's for the current chat
      if (isGroup) {
        if (groupId !== selectedUserId) return;
      } else {
        if (senderId !== selectedUserId) return;
      }
      
      setTypingUsers(prev => prev.filter(u => u.senderId !== senderId));
    };

    socket.on("usertyping", handleUserTyping);
    socket.on("userstoptyping", handleUserStopTyping);

    // Clear typing indicators when switching chats
    setTypingUsers([]);

    return () => {
      socket.off("usertyping", handleUserTyping);
      socket.off("userstoptyping", handleUserStopTyping);
      setTypingUsers([]);
    };
  }, [socket, selectedUser, authuser]);

  // Safe message sending
  const handleSendMessage = async () => {
    if(!input.trim()) {
      toast.error("Message cannot be empty")
      return
    }
    
    // Safety check: ensure selectedUser and sendMessage exist
    if (!selectedUser) {
      toast.error("Please select a user to send a message")
      return
    }
    
    if (!sendMessage || typeof sendMessage !== 'function') {
      toast.error("Message sending is not available")
      return
    }
    
    // Stop typing indicator when sending
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (socket && selectedUser) {
      const receiverId = selectedUser._id || selectedUser.uid;
      const isGroup = selectedUser.isGroup === true;
      socket.emit("stoptyping", {
        receiverId,
        isGroup,
        senderId: authuser?._id || authuser?.uid
      });
    }
    
    const isGroup = selectedUser?.isGroup === true
    
    try {
      await sendMessage({
        text: input.trim(),
        replyTo: replyingTo ? {
          messageId: replyingTo._id || replyingTo.id,
          text: replyingTo.text || '',
          senderId: replyingTo.senderId,
          senderName: replyingTo.senderName || (isGroup ? replyingTo.senderName : selectedUser?.fullName)
        } : null
      })
      setInput("")
      setReplyingTo(null)
    } catch (error) {
      console.error(error)
      toast.error("Failed to send message")
    }
  }

  const handleEditMessage = async () => {
    if (!editText.trim() || !editingMessage) {
      toast.error("Message cannot be empty")
      return
    }

    try {
      await editMessage(editingMessage._id || editingMessage.id, editText.trim())
      setEditingMessage(null)
      setEditText('')
      setShowDeleteMenu(null)
    } catch (error) {
      console.error(error)
      toast.error("Failed to edit message")
    }
  }


  const handleReplyToMessage = (message) => {
    setReplyingTo(message)
    setEditingMessage(null)
    setShowDeleteMenu(null)
    // Focus input for immediate typing
    setTimeout(() => {
      const inputElement = document.querySelector('input[type="text"]');
      if (inputElement) {
        inputElement.focus();
      }
    }, 100)
  }

  const handleForwardMessage = (message) => {
    setMessagesToForward([message])
    setShowForwardModal(true)
    setShowDeleteMenu(null)
  }

  const handleForwardMessages = async (recipients) => {
    if (!recipients || recipients.length === 0) {
      setShowForwardModal(false)
      setMessagesToForward([])
      return
    }

    if (!forwardMessage) {
      toast.error("Forward functionality not available")
      setShowForwardModal(false)
      setMessagesToForward([])
      return
    }

    try {
      // Forward each message to each recipient
      for (const recipientId of recipients) {
        await forwardMessage(messagesToForward, recipientId)
      }
      toast.success(`Message${messagesToForward.length > 1 ? 's' : ''} forwarded successfully`)
      setShowForwardModal(false)
      setMessagesToForward([])
    } catch (error) {
      console.error("Error forwarding messages:", error)
      toast.error(error.response?.data?.message || "Failed to forward messages")
    }
  }

  const handleKeyDown = (e) => {
    if(e.key === "Enter") {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Swipe to reply handlers
  const handleTouchStart = (e, messageId) => {
    const touch = e.touches[0]
    touchStartRef.current[messageId] = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }
  }

  const handleTouchMove = (e, messageId, isOwnMessage) => {
    if (!touchStartRef.current[messageId]) return
    
    const touch = e.touches[0]
    const start = touchStartRef.current[messageId]
    const deltaX = touch.clientX - start.x
    const deltaY = Math.abs(touch.clientY - start.y)
    
    // Only allow horizontal swipe (not vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault()
      
      // For own messages, swipe left to reply. For others, swipe right to reply
      const maxSwipe = 100
      let offset = 0
      
      if (isOwnMessage && deltaX < 0) {
        // Own message: swipe left
        offset = Math.max(-maxSwipe, deltaX)
      } else if (!isOwnMessage && deltaX > 0) {
        // Other's message: swipe right
        offset = Math.min(maxSwipe, deltaX)
      }
      
      setSwipeOffset(prev => ({ ...prev, [messageId]: offset }))
      setSwipingMessageId(messageId)
    }
  }

  const handleTouchEnd = (e, messageId, msg, isOwnMessage) => {
    if (!touchStartRef.current[messageId]) return
    
    const start = touchStartRef.current[messageId]
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = Math.abs(touch.clientY - start.y)
    const deltaTime = Date.now() - start.time
    
    // Check if it's a valid swipe gesture
    const isSwipe = Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) && deltaTime < 300
    
    if (isSwipe) {
      if ((isOwnMessage && deltaX < -50) || (!isOwnMessage && deltaX > 50)) {
        // Trigger reply
        handleReplyToMessage(msg)
      }
    }
    
    // Reset swipe state
    setSwipeOffset(prev => {
      const newState = { ...prev }
      delete newState[messageId]
      return newState
    })
    setSwipingMessageId(null)
    delete touchStartRef.current[messageId]
    
    // Animate back
    setTimeout(() => {
      setSwipeOffset(prev => {
        const newState = { ...prev }
        delete newState[messageId]
        return newState
      })
    }, 200)
  }

  const handleEmojiSelect = (emoji) => {
    setInput(prev => prev + emoji)
    // Focus back on input after emoji selection
    setTimeout(() => {
      const inputElement = document.querySelector('input[type="text"]')
      if (inputElement) {
        inputElement.focus()
      }
    }, 100)
  }

  const handleCameraCapture = async (imageData) => {
    try {
      await sendMessage({ image: imageData })
      toast.success("Photo sent!")
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || "Failed to send photo")
    }
  }

  const handlesendimage = async (e) => {
    const file = e.target.files[0]
    if(!file) return
    
    if(!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file")
      e.target.value = ""
      return
    }

    // Check file size (limit to 5MB - Firebase can handle larger, Cloudinary can handle even more)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(`Image size should be less than 5MB. Current: ${(file.size / (1024 * 1024)).toFixed(2)}MB`)
      e.target.value = ""
      return
    }

    const reader = new FileReader()
    reader.onloadend = async () => {
      try {
        await sendMessage({image: reader.result})
        e.target.value = ""
        toast.success("Image sent!")
      } catch (error) {
        console.error(error)
        toast.error(error.response?.data?.message || "Failed to send image")
      }
    }
    reader.onerror = () => {
      toast.error("Failed to read image file")
      e.target.value = ""
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if(selectedUser && selectedUser._id) {
      const isGroup = selectedUser.isGroup === true;
      // Messages are cleared automatically in getMessages for instant feedback
      getMessages(selectedUser._id, isGroup)
      // Close media view when user changes
      setShowMediaInfo(false)
    }
  }, [selectedUser])

  // Handle system/APK back button to close media view
  useEffect(() => {
    if (!showMediaInfo) return;

    const handlePopState = (e) => {
      e.preventDefault();
      setShowMediaInfo(false);
      // Push a new state to prevent navigation
      window.history.pushState(null, '', window.location.href);
    };

    // Push a state when media view opens
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showMediaInfo])

  useEffect(() => {
    if(scrollEnd.current) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showDeleteMenu) {
        // Check if click is outside the menu and menu button
        const menuElement = e.target.closest('.bg-gray-900.rounded-lg');
        const buttonElement = e.target.closest('button[title="Options"]');
        if (!menuElement && !buttonElement) {
          setShowDeleteMenu(null)
        }
      }
    }
    
    if (showDeleteMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showDeleteMenu])

  // Close reply preview when clicking outside input area
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (replyingTo && inputAreaRef.current) {
        // Check if click is outside the input area
        if (!inputAreaRef.current.contains(e.target)) {
          setReplyingTo(null)
        }
      }
    }
    
    if (replyingTo) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [replyingTo])

  // Handle toggle info panel - show media/info view like WhatsApp
  const handleToggleInfo = () => {
    try {
      setShowMediaInfo(prev => !prev);
    } catch (error) {
      console.error('Error toggling info panel:', error);
    }
  }

  // Extract media (images) from messages
  const mediaMessages = (messages || []).filter(msg => msg.image).slice(-20)

  // Container swipe handlers for navigation (left swipe to go back)
  const handleContainerTouchStart = (e) => {
    // Only handle if touch starts on empty space (background, header area, etc.)
    // Don't interfere if touching a message, button, input, or other interactive element
    const target = e.target
    
    // Check if touching interactive elements
    const isButton = target.closest('button, [role="button"]')
    const isInput = target.closest('input, textarea')
    const isLink = target.closest('a')
    const isImage = target.tagName === 'IMG'
    const isMessage = target.closest('[class*="flex items-end gap-2"]') || // Message container
                       target.closest('[class*="px-3 py-2 rounded-lg"]') || // Message bubble
                       target.closest('[class*="relative rounded-lg overflow-hidden"]') // Image message
    
    // Only track swipe if not on interactive element, not on message, and not in media view
    if (!isButton && !isInput && !isLink && !isImage && !isMessage && !showMediaInfo) {
      const touch = e.touches[0]
      containerSwipeStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now()
      }
    } else {
      // Clear any existing swipe tracking if touching interactive element
      containerSwipeStartRef.current = null
    }
  }

  const handleContainerTouchMove = (e) => {
    // Prevent default only if it's a horizontal swipe
    if (!containerSwipeStartRef.current) return
    
    const touch = e.touches[0]
    const start = containerSwipeStartRef.current
    const deltaX = touch.clientX - start.x
    const deltaY = Math.abs(touch.clientY - start.y)
    
    // Only prevent default for horizontal swipes (not vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      // Allow left swipe (negative deltaX) to navigate back
      if (deltaX < -20) {
        e.preventDefault()
      }
    }
  }

  const handleContainerTouchEnd = (e) => {
    if (!containerSwipeStartRef.current) return
    
    const start = containerSwipeStartRef.current
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = Math.abs(touch.clientY - start.y)
    const deltaTime = Date.now() - start.time
    
    // Check if it's a valid left swipe gesture
    // Left swipe: deltaX is negative, horizontal movement > vertical, fast gesture
    const isLeftSwipe = deltaX < -100 && Math.abs(deltaX) > Math.abs(deltaY) && deltaTime < 500
    
    if (isLeftSwipe && !showMediaInfo) {
      // Navigate back to home
      setSelectedUser(null)
    }
    
    // Reset swipe tracking
    containerSwipeStartRef.current = null
  }

  if (!selectedUser) {
    return (
      <div className='flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden'>
        <img src={assets.logo_icon} className='max-w-16' alt=""/>
        <p className='text-lg font-medium text-white'>Select a user to start chatting</p>
      </div>
    )
  }

  // Safety check - prevent crash if selectedUser is null
  if (!selectedUser) {
    return (
      <div className='h-full flex items-center justify-center text-gray-400'>
        <p>Select a chat to start messaging</p>
      </div>
    )
  }

  return (
    <div 
      className='h-full flex flex-col relative overflow-hidden'
      style={{
        backgroundImage: `url(${assets.bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll'
      }}
      onTouchStart={handleContainerTouchStart}
      onTouchMove={handleContainerTouchMove}
      onTouchEnd={handleContainerTouchEnd}
    >
      {/* Overlay for better readability */}
      <div className='absolute inset-0 bg-black/20 backdrop-blur-sm'></div>
      
      {/* Content with relative positioning */}
      <div className='relative z-10 flex-1 flex flex-col overflow-hidden'>
      {/* Header */}
        <div className='flex items-center gap-2 md:gap-3 py-2 md:py-3 px-2 md:px-4 border-b border-stone-500/50 bg-black/10 backdrop-blur-sm flex-shrink-0 z-20'>
        <img src={selectedUser?.profilePic || assets.avatar_icon} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0" onError={(e) => { e.target.src = assets.avatar_icon; }}/>
        <div className='flex-1 min-w-0'>
          <p className='text-sm md:text-base lg:text-lg text-white flex items-center gap-2 truncate'>
            {selectedUser?.fullName || selectedUser?.name || 'Unknown User'}
            {!selectedUser?.isGroup && selectedUser?._id && Array.isArray(onlineUsers) && onlineUsers.includes(selectedUser._id) && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
            )}
          </p>
          {!selectedUser?.isGroup && (
            <p className='text-xs text-gray-400'>
              {selectedUser?._id && Array.isArray(onlineUsers) && (onlineUsers.includes(selectedUser._id) || onlineUsers.includes(selectedUser.uid) || onlineUsers.includes(selectedUser.id)) ? (
                <span className="text-green-400">online</span>
              ) : (
                <span className="text-gray-500">offline</span>
              )}
            </p>
          )}
          {selectedUser?.isGroup && (
            <p className='text-xs text-gray-400'>
              {selectedUser?.members?.length || 0} participants
            </p>
          )}
        </div>
        {showMediaInfo ? (
          // Back button for desktop when viewing media/info
          <button
            type="button"
            onClick={(e) => {
              try {
                e.stopPropagation();
                e.preventDefault();
                setShowMediaInfo(false);
              } catch (error) {
                console.error('Error closing media view:', error);
              }
            }}
            className="hidden md:flex p-1.5 md:p-2 cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity items-center justify-center w-9 h-9 md:w-10 md:h-10 flex-shrink-0"
            title="Back to Chat"
            aria-label="Back to Chat"
          >
            <img src={assets.arrow_icon} alt="Back" className='w-5 h-5 md:w-6 md:h-6 pointer-events-none'/>
          </button>
        ) : (
          <>
            {/* Call Button - Only show for direct chats (not groups) */}
            {!selectedUser?.isGroup && selectedUser?._id && (
              <button
                type="button"
                onClick={(e) => {
                  try {
                    e.stopPropagation();
                    e.preventDefault();
                    const userId = selectedUser._id || selectedUser.uid;
                    const userName = selectedUser.fullName || selectedUser.name || 'Unknown User';
                    const userProfilePic = selectedUser.profilePic || null;
                    if (userId && !activeCall) {
                      initiateCall(userId, userName, userProfilePic);
                    } else if (activeCall) {
                      toast.info('You are already in a call');
                    }
                  } catch (error) {
                    console.error('Error initiating call:', error);
                    toast.error('Failed to start call');
                  }
                }}
                className="p-1.5 md:p-2 cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity flex items-center justify-center w-9 h-9 md:w-10 md:h-10 touch-manipulation flex-shrink-0"
                style={{ touchAction: 'manipulation', minWidth: '36px', minHeight: '36px' }}
                title="Voice Call"
                aria-label="Voice Call"
                disabled={!!activeCall}
              >
                <svg className="w-5 h-5 md:w-6 md:h-6 text-white pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                try {
                  e.stopPropagation();
                  e.preventDefault();
                  handleToggleInfo();
                } catch (error) {
                  console.error('Error in info button click:', error);
                }
              }}
              onTouchEnd={(e) => {
                try {
                  e.stopPropagation();
                  e.preventDefault();
                  handleToggleInfo();
                } catch (error) {
                  console.error('Error in info button touch:', error);
                }
              }}
              className="p-1.5 md:p-2 cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity flex items-center justify-center w-9 h-9 md:w-10 md:h-10 touch-manipulation flex-shrink-0"
              style={{ touchAction: 'manipulation', minWidth: '36px', minHeight: '36px' }}
              title="Media & Info"
              aria-label="Media & Info"
            >
              <img src={assets.help_icon} alt="Info" className='w-5 h-5 md:w-6 md:h-6 pointer-events-none'/>
            </button>
            <button
              onClick={() => setSelectedUser(null)} 
              className='md:hidden p-1.5 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0'
              style={{ touchAction: 'manipulation', minWidth: '36px', minHeight: '36px' }}
              aria-label="Back"
            >
              <img src={assets.arrow_icon} alt="Back" className='w-5 h-5 md:w-6 md:h-6'/>
            </button>
          </>
        )}
      </div>

        {/* Media/Info View - WhatsApp Style */}
        {showMediaInfo ? (
          <div className='flex flex-col flex-1 overflow-y-auto bg-black/20 backdrop-blur-sm'>
            {/* User Info Section */}
            <div className='flex flex-col items-center gap-3 py-8 px-4 border-b border-gray-600/30'>
              <img 
                src={selectedUser?.profilePic || assets.avatar_icon} 
                alt={selectedUser?.fullName || selectedUser?.name} 
                className='w-24 h-24 rounded-full object-cover border-2 border-gray-600'
                onError={(e) => { e.target.src = assets.avatar_icon; }}
              />
              <div className='text-center'>
                <h2 className='text-xl font-semibold text-white'>
                  {selectedUser?.fullName || selectedUser?.name || 'Unknown User'}
                </h2>
                {!selectedUser?.isGroup && (
                  <p className='text-sm text-gray-400 mt-1'>
                    {selectedUser?.bio || 'No status'}
                  </p>
                )}
                {selectedUser?.isGroup && (
                  <p className='text-sm text-gray-400 mt-1'>
                    {selectedUser?.members?.length || 0} participants
                  </p>
                )}
              </div>
            </div>

            {/* Media Section */}
            <div className='p-4'>
              <h3 className='text-lg font-semibold text-white mb-4'>Media</h3>
              {mediaMessages.length > 0 ? (
                <div className='grid grid-cols-3 gap-2'>
                  {mediaMessages.map((msg, index) => {
                    const handleImageClick = () => {
                      if (msg.image) {
                        const imageUrl = msg.image;
                        const urlParts = imageUrl.split('/');
                        const filename = urlParts[urlParts.length - 1].split('?')[0] || `image-${Date.now()}.jpg`;
                        setViewingImage({ url: imageUrl, filename });
                      }
                    };

                    return (
                      <div
                        key={msg._id || msg.id || index}
                        onClick={handleImageClick}
                        className='relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity'
                      >
                        <img
                          src={msg.image}
                          alt="Media"
                          className='w-full h-full object-cover'
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className='text-gray-500 text-center py-8'>No media shared</p>
              )}
            </div>
          </div>
        ) : (
          /* Messages - WhatsApp Style */
          <div className='flex flex-col flex-1 overflow-y-auto px-2 md:px-4 py-2 touch-pan-y min-h-0' style={{ gap: '0.5rem' }}>
        {loadingMessages && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm">Loading messages...</p>
            </div>
          </div>
        ) : messages && messages.length > 0 ? (() => {
          // Remove duplicates based on message ID
          const seenIds = new Set();
          const uniqueMessages = messages.filter(msg => {
            const msgId = msg._id || msg.id;
            if (!msgId || seenIds.has(msgId)) {
              return false;
            }
            seenIds.add(msgId);
            return true;
          });
          
          return uniqueMessages.map((msg, index) => {
          // SAFE CHECK: Ensure message has required properties
          try {
            if (!msg || typeof msg !== 'object') return null
          
            // Check if message is from current user - compare as strings to handle ID mismatches
            const currentUserId = authuser?._id || authuser?.uid || '';
            const messageSenderId = msg.senderId || '';
            // Compare both as strings, but also handle empty strings and null values
            const isOwnMessage = currentUserId && messageSenderId && (
              String(currentUserId) === String(messageSenderId) ||
              currentUserId === messageSenderId
            );
            const isGroup = selectedUser?.isGroup === true;
            const isSystemMessage = msg.type === 'system' || msg.senderId === 'system';
                  
            const messageText = msg.text || ''
            const messageImage = msg.image
            const messageTime = msg.createdAt ? formatMessageTime(msg.createdAt) : (msg.timestamp ? formatMessageTime(msg.timestamp) : '')
            const messageDate = msg.createdAt || msg.timestamp
            const senderName = isGroup && !isOwnMessage ? (msg.senderName || 'Unknown') : null
          
          // Check if we need to show a date separator
          const showDateSeparator = (() => {
            if (index === 0) return true; // Always show date for first message
            const prevMsg = messages[index - 1];
            if (!prevMsg) return false;
            
            const prevDate = prevMsg.createdAt || prevMsg.timestamp;
            if (!prevDate || !messageDate) return false;
            
            const prevDateOnly = new Date(prevDate).toDateString();
            const currentDateOnly = new Date(messageDate).toDateString();
            
            return prevDateOnly !== currentDateOnly;
          })();

          // Click on message to reply (not just from menu)
          const handleMessageClick = () => {
            if (!isOwnMessage) {
              handleReplyToMessage(msg)
            }
          }

          // Handle image click - open full screen viewer (works for both own and received messages)
          const handleImageClick = (e) => {
            if (messageImage) {
              e.stopPropagation()
              // Extract filename from URL or use default
              const imageUrl = messageImage
              const urlParts = imageUrl.split('/')
              const filename = urlParts[urlParts.length - 1].split('?')[0] || `image-${Date.now()}.jpg`
              setViewingImage({ url: imageUrl, filename })
            }
          }

              // Skip rendering system messages in a special way
              if (isSystemMessage) {
                return (
                  <div key={msg._id || msg.id || index} className="flex justify-center my-2">
                    <div className="bg-gray-700/30 text-gray-400 text-xs px-3 py-1 rounded-full">
                      {messageText}
                    </div>
                  </div>
                )
              }

              // Get sender's profile picture for group chats
              let senderProfilePic = assets.avatar_icon;
              if (isGroup && !isOwnMessage) {
                // For group chats, use sender's profile picture from message
                // If not in message, try to find it from users list
                if (msg.senderPic) {
                  senderProfilePic = msg.senderPic;
                } else {
                  // Fallback: Look up sender from users list
                  const sender = (users || []).find(u => {
                    const userId = u._id || u.uid || u.id;
                    return userId && userId === msg.senderId;
                  });
                  senderProfilePic = sender?.profilePic || assets.avatar_icon;
                }
              } else if (!isOwnMessage) {
                // For regular chats, use selected user's profile picture
                senderProfilePic = selectedUser?.profilePic || assets.avatar_icon;
              }
              
              const handleDeleteMessage = () => {
                if (window.confirm('Are you sure you want to delete this message?')) {
                  deleteMessage(msg._id || msg.id)
                  setShowDeleteMenu(null)
                }
              }

          return (
            <React.Fragment key={msg._id || msg.id || index}>
              {/* Date Separator */}
              {showDateSeparator && (
                <div className="flex items-center justify-center my-4">
                  <div className="bg-gray-700/50 px-3 py-1 rounded-full">
                    <span className="text-xs text-gray-300">{formatMessageDate(messageDate)}</span>
                  </div>
                </div>
              )}
              
            <div 
                  className={`flex items-end gap-2 w-full ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  style={{
                    transform: swipeOffset[msg._id || msg.id] ? `translateX(${swipeOffset[msg._id || msg.id]}px)` : 'none',
                    transition: swipingMessageId === (msg._id || msg.id) ? 'none' : 'transform 0.2s ease-out',
                    position: swipeOffset[msg._id || msg.id] ? 'relative' : 'static',
                    zIndex: swipeOffset[msg._id || msg.id] ? 10 : 'auto'
                  }}
                  onMouseEnter={() => setHoveredMessageId(msg._id || msg.id)}
                  onMouseLeave={() => !showDeleteMenu && setHoveredMessageId(null)}
                  onTouchStart={(e) => handleTouchStart(e, msg._id || msg.id)}
                  onTouchMove={(e) => handleTouchMove(e, msg._id || msg.id, isOwnMessage)}
                  onTouchEnd={(e) => handleTouchEnd(e, msg._id || msg.id, msg, isOwnMessage)}
                >
                  {/* Swipe indicator */}
                  {swipeOffset[msg._id || msg.id] && Math.abs(swipeOffset[msg._id || msg.id]) > 30 && (
                    <div className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 flex items-center gap-2 ${isOwnMessage ? 'pr-2' : 'pl-2'}`}>
                      <div className="bg-[#00A884]/80 rounded-full p-2">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </div>
                      <span className="text-xs text-white font-medium">Reply</span>
                    </div>
                  )}
                  {/* Other user's profile pic - shown on LEFT for received messages */}
              {!isOwnMessage && (
                <img 
                      src={senderProfilePic} 
                      alt={isGroup ? senderName : selectedUser?.fullName} 
                      className='w-7 h-7 md:w-8 md:h-8 rounded-full object-cover flex-shrink-0 mb-1'
                    />
                  )}
                  
                  {/* Message content - WhatsApp style bubbles */}
                  <div className={`flex flex-col ${isOwnMessage ? 'items-end max-w-[85%] md:max-w-[75%]' : 'items-start max-w-[85%] md:max-w-[75%]'} relative ${isOwnMessage ? 'pr-2' : ''}`}>
                    {/* Show sender name in group chats */}
                    {isGroup && !isOwnMessage && senderName && (
                      <span className="text-xs text-gray-400 mb-0.5 px-1">{senderName}</span>
                    )}
                    
                {messageImage ? (
                  <div 
                    className={`relative rounded-lg overflow-hidden mb-1 group/image ${
                      isOwnMessage ? 'rounded-br-sm' : 'rounded-bl-sm'
                    } ${!isOwnMessage ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                  >
                    {/* Forwarded label for images */}
                    {msg.forwarded && (
                      <div className={`absolute top-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded p-1.5 flex items-center gap-1 z-10`}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                        <span className='text-xs text-white font-medium'>
                          Forwarded
                        </span>
                      </div>
                    )}
                    
                    {/* Quoted message (reply) */}
                    {msg.replyTo && (
                      <div className={`absolute ${msg.forwarded ? 'top-12' : 'top-2'} left-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg p-2.5 border-l-4 ${isOwnMessage ? 'border-white/40' : 'border-[#00A884]/60'}`}>
                        <p className={`text-xs font-semibold mb-1 ${isOwnMessage ? 'text-white/90' : 'text-[#00A884]'}`}>
                          {msg.replyTo.senderName || 'Unknown'}
                        </p>
                        {msg.replyTo.text ? (
                          <p className='text-xs text-white/80 truncate leading-relaxed'>
                            {msg.replyTo.text}
                          </p>
                        ) : (
                          <div className='flex items-center gap-2'>
                            <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className='text-xs text-white/70 italic'>Photo</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                  <img 
                    src={messageImage} 
                    alt="Sent image" 
                    className="max-w-full max-h-64 object-cover cursor-pointer"
                    onClick={handleImageClick}
                    />
                    <div className={`absolute bottom-1 right-2 flex items-center gap-1`}>
                      <span className='text-[10px] text-white/80'>{messageTime}</span>
                      {isOwnMessage && !isGroup && (
                        (Array.isArray(onlineUsers) && (onlineUsers.includes(selectedUser?._id) || onlineUsers.includes(selectedUser?.uid) || onlineUsers.includes(selectedUser?.id))) ? (
                          <span className='text-white/80 text-xs'>✓✓</span>
                        ) : (
                          <span className='text-white/60 text-xs'>✓</span>
                        )
                      )}
                      {isOwnMessage && isGroup && (
                        <span className='text-white/80 text-xs'>✓✓</span>
                      )}
                      {msg.edited && (
                        <span className='text-white/60 text-[9px] italic ml-1'>(edited)</span>
                      )}
                    </div>
                    
                    {/* Menu button - simple and minimal for image messages - only show on hover - available for all messages */}
                    {!msg.isSending && (
                      <div className={`absolute top-1 ${isOwnMessage ? 'right-1' : 'left-1'} opacity-0 group-hover/image:opacity-100 transition-opacity`}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowDeleteMenu(showDeleteMenu === (msg._id || msg.id) ? null : (msg._id || msg.id))
                          }}
                          onMouseEnter={() => setHoveredMessageId(msg._id || msg.id)}
                          className={`w-6 h-6 flex items-center justify-center rounded-full transition-all z-10 ${
                            showDeleteMenu === (msg._id || msg.id) 
                              ? 'bg-gray-800/90 opacity-100' 
                              : 'bg-gray-900/70 hover:bg-gray-800/80'
                          }`}
                          title="Options"
                        >
                          <span className="text-gray-300 text-lg leading-none">⋯</span>
                        </button>
                        
                        {/* Message menu dropdown - positioned relative to message side */}
                        {showDeleteMenu === (msg._id || msg.id) && (
                          <div className={`absolute ${isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 bg-gray-900 rounded-lg shadow-xl z-50 border border-gray-600 flex flex-col gap-0.5 p-1`}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleReplyToMessage(msg)
                              }}
                              className="p-1.5 text-gray-300 hover:bg-gray-800 rounded transition-colors"
                              title="Reply"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleForwardMessage(msg)
                              }}
                              className="p-1.5 text-gray-300 hover:bg-gray-800 rounded transition-colors"
                              title="Forward"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                              </svg>
                            </button>
                            {isOwnMessage && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingMessage(msg)
                                    setEditText(msg.text || '')
                                    setShowDeleteMenu(null)
                                    setReplyingTo(null)
                                  }}
                                  className="p-1.5 text-gray-300 hover:bg-gray-800 rounded transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteMessage()
                                  }}
                                  className="p-1.5 text-red-400 hover:bg-gray-800 rounded transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative group/message">
                    {/* Menu button - simple and minimal - only show on hover - available for all messages */}
                    {!msg.isSending && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowDeleteMenu(showDeleteMenu === (msg._id || msg.id) ? null : (msg._id || msg.id))
                        }}
                        onMouseEnter={() => setHoveredMessageId(msg._id || msg.id)}
                        className={`absolute ${isOwnMessage ? '-right-9' : '-left-9'} top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full transition-all z-40 opacity-0 group-hover/message:opacity-100 ${
                          showDeleteMenu === (msg._id || msg.id) 
                            ? 'bg-gray-700/80 opacity-100' 
                            : 'bg-gray-800/60 hover:bg-gray-700/70'
                        }`}
                        title="Options"
                      >
                        <span className="text-gray-300 text-lg leading-none">⋯</span>
                      </button>
                    )}
                    
                    {/* Message menu dropdown - positioned relative to message side */}
                    {showDeleteMenu === (msg._id || msg.id) && (
                      <div className={`absolute ${isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 bg-gray-900 rounded-lg shadow-xl z-50 border border-gray-600 flex flex-col gap-0.5 p-1`}>
                        {/* Reply option - for all messages */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReplyToMessage(msg)
                          }}
                          className="p-1.5 text-gray-300 hover:bg-gray-800 rounded transition-colors"
                          title="Reply"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </button>
                        
                        {/* Forward option - for all messages */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleForwardMessage(msg)
                          }}
                          className="p-1.5 text-gray-300 hover:bg-gray-800 rounded transition-colors"
                          title="Forward"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                        </button>
                        
                        {/* Edit option - only for own messages */}
                        {isOwnMessage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingMessage(msg)
                              setEditText(msg.text || '')
                              setShowDeleteMenu(null)
                              setReplyingTo(null)
                            }}
                            className="p-1.5 text-gray-300 hover:bg-gray-800 rounded transition-colors"
                            title="Edit"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        
                        {/* Delete option - only for own messages */}
                        {isOwnMessage && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteMessage()
                            }}
                            className="p-1.5 text-red-400 hover:bg-gray-800 rounded transition-colors"
                            title="Delete"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                    
                  <div 
                    className={`px-3 py-2 rounded-lg shadow-sm ${
                      isOwnMessage 
                        ? msg.isSending 
                          ? 'bg-[#00A884]/70 text-white rounded-br-sm' // Dimmed while sending
                          : 'bg-[#00A884] text-white rounded-br-sm' // Teal-green for sent messages
                        : 'bg-gray-700 text-white rounded-bl-sm' // Light gray for received messages
                    } ${!isOwnMessage ? 'cursor-pointer hover:bg-gray-600 transition-colors' : ''}`}
                    onClick={!isOwnMessage ? handleMessageClick : undefined}
                  >
                    {/* Forwarded label */}
                    {msg.forwarded && (
                      <div className={`mb-1 pb-1 flex items-center gap-1 ${isOwnMessage ? 'text-white/70' : 'text-gray-400'}`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                        <span className='text-xs font-medium'>
                          Forwarded
                        </span>
                      </div>
                    )}
                    
                    {/* Quoted message (reply) */}
                    {msg.replyTo && (
                      <div className={`mb-2 pb-2 flex items-start gap-1.5 -ml-1 -mr-1 pr-2`}>
                        <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isOwnMessage ? 'text-white/60' : 'text-[#00A884]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <div className='flex-1 min-w-0'>
                          <p className={`text-xs font-semibold mb-0.5 ${isOwnMessage ? 'text-white/90' : 'text-[#00A884]'}`}>
                          {msg.replyTo.senderName || 'Unknown'}
                        </p>
                          {msg.replyTo.text ? (
                            <p className={`text-xs truncate ${isOwnMessage ? 'text-white/70' : 'text-gray-300'}`}>
                              {msg.replyTo.text}
                            </p>
                          ) : (
                            <div className='flex items-center gap-1.5'>
                              <svg className={`w-3 h-3 ${isOwnMessage ? 'text-white/70' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className={`text-xs italic ${isOwnMessage ? 'text-white/70' : 'text-gray-400'}`}>Photo</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <p className='text-sm break-words whitespace-pre-wrap'>
                    {messageText}
                      {msg.edited && (
                        <span className='ml-2 text-xs opacity-70 italic'>(edited)</span>
                      )}
                    </p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${isOwnMessage ? 'text-white/90' : 'text-gray-400'}`}>
                      <span className='text-[10px]'>{messageTime}</span>
                      {isOwnMessage && (
                        <span className='text-xs ml-1 flex items-center'>
                          {msg.isSending ? (
                            <span className='inline-block w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin'></span>
        ) : (
          <>
            {msg.seen ? (
              // Double blue check - Read (WhatsApp style)
              <span className="flex items-center" title="Read">
                <svg className="w-4 h-4 text-blue-400" viewBox="0 0 16 15" fill="none">
                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.063-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" fill="currentColor"/>
                </svg>
              </span>
            ) : msg.delivered ? (
              // Double gray check - Delivered (WhatsApp style)
              <span className="flex items-center" title="Delivered">
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 15" fill="none">
                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.063-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" fill="currentColor"/>
                </svg>
              </span>
            ) : (
              // Single gray check - Sent (WhatsApp style)
              <span className="flex items-center" title="Sent">
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 16 15" fill="none">
                  <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.063-.512z" fill="currentColor"/>
                </svg>
              </span>
            )}
          </>
        )}
                      </span>
                    )}
                    </div>
                  </div>
                  </div>
                )}
              </div>
              
              {/* Current user's profile pic - shown on RIGHT for sent messages */}
              {isOwnMessage && (
                <img 
                  src={authuser?.profilePic || assets.avatar_icon} 
                  alt="" 
                  className='w-8 h-8 rounded-full object-cover flex-shrink-0 mb-1'
                />
              )}
            </div>
            </React.Fragment>
            )
          } catch (error) {
            console.error('Error rendering message:', error, msg);
            return null; // Return null to skip this message if there's an error
          }
          });
        })() : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}
        
        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex items-center gap-1 bg-gray-700/50 rounded-full px-4 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-xs text-gray-300 ml-2">
                {typingUsers.length === 1 
                  ? `${typingUsers[0].senderName} is typing...`
                  : typingUsers.length === 2
                  ? `${typingUsers[0].senderName} and ${typingUsers[1].senderName} are typing...`
                  : `${typingUsers.map(u => u.senderName).join(', ')} are typing...`
                }
              </span>
            </div>
          </div>
        )}
        
        <div ref={scrollEnd}></div>
      </div>
        )}

      {/* Input Area - Hidden when showing media/info */}
      {!showMediaInfo && (
            <div ref={inputAreaRef} className='relative bg-black/20 backdrop-blur-md z-20 flex-shrink-0'>
              {/* Reply/Edit Preview */}
              {(replyingTo || editingMessage) && (
                <div className='px-4 pt-3 pb-2.5 border-b border-gray-700/50 bg-black/10 backdrop-blur-sm'>
                  {replyingTo && (
                    <div className='bg-gray-700/90 backdrop-blur-sm rounded-lg p-3 flex items-start gap-3 relative'>
                      <div className='w-1 h-full bg-blue-400 rounded-full flex-shrink-0 self-stretch'></div>
                      <div className='flex-1 min-w-0'>
                        <p className='text-blue-400 text-xs font-medium mb-1'>{replyingTo.senderName || (selectedUser?.isGroup ? replyingTo.senderName : selectedUser?.fullName)}</p>
                        {replyingTo.text ? (
                          <p className='text-gray-300 text-xs leading-relaxed line-clamp-2'>{replyingTo.text}</p>
                        ) : (replyingTo.image || messages.find(m => (m._id || m.id) === (replyingTo._id || replyingTo.id))?.image) ? (
                          <div className='flex items-center gap-2'>
                            <img 
                              src={replyingTo.image || messages.find(m => (m._id || m.id) === (replyingTo._id || replyingTo.id))?.image} 
                              alt="Reply preview" 
                              className='w-10 h-10 rounded object-cover border border-gray-600/50' 
                            />
                            <span className='text-gray-400 text-xs italic'>Photo</span>
                          </div>
                        ) : (
                          <div className='flex items-center gap-2'>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className='text-gray-400 text-xs italic'>Photo</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className='text-gray-400 hover:text-white hover:bg-gray-600/50 rounded-full p-1.5 transition-all flex-shrink-0'
                        title="Cancel reply"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {editingMessage && (
                    <div className='bg-gray-800/80 rounded-lg p-3 flex items-start gap-3 relative'>
                      <div className='flex-1'>
                        <p className='text-[#00A884] text-xs font-medium mb-2 flex items-center gap-1'>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Editing message
                        </p>
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleEditMessage()
                            } else if (e.key === 'Escape') {
                              setEditingMessage(null)
                              setEditText('')
                            }
                          }}
                          className='w-full px-2 py-1 bg-gray-700/50 border border-gray-600 rounded text-white text-sm outline-none focus:border-[#00A884]'
                          autoFocus
                        />
                      </div>
                      <div className='flex gap-2 flex-shrink-0'>
                        <button
                          onClick={handleEditMessage}
                          className='px-3 py-1 bg-[#00A884] text-white text-xs rounded hover:bg-[#00A884]/80 transition-colors'
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingMessage(null)
                            setEditText('')
                          }}
                          className='px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 transition-colors'
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className='flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-black/10 backdrop-blur-sm'>
        <div className='flex-1 flex items-center bg-gray-100/12 px-2 md:px-3 rounded-full'>
          <input 
            onChange={(e) => setInput(e.target.value)} 
            value={input} 
            onKeyDown={handleKeyDown}
            type="text" 
                    placeholder={editingMessage ? "Editing..." : replyingTo ? "Type a reply..." : "Type a message..."} 
            className='flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400 bg-transparent'
                    disabled={!!editingMessage}
          />
          {!editingMessage && (
            <div className="flex items-center gap-2">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
              <button
                onClick={() => setShowCamera(true)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                title="Take photo"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input onChange={handlesendimage} type="file" id='image' accept='image/png,image/jpeg,image/jpg,image/gif,image/webp' hidden/>
              <label htmlFor="image" className="cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center" title="Attach image">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </label>
            </div>
          )}
        </div>
                {editingMessage ? (
                  <div className='flex gap-2'>
                    <button
                      onClick={handleEditMessage}
                      className='px-4 py-2 bg-[#00A884] text-white rounded-lg hover:bg-[#00A884]/80 transition-colors text-sm'
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingMessage(null)
                        setEditText('')
                      }}
                      className='px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm'
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
        <button 
          onClick={handleSendMessage} 
          disabled={!input.trim()}
          className="p-2 disabled:opacity-50"
        >
          <img src={assets.send_button} alt="Send" className='w-7' />
        </button>
                )}
              </div>
            </div>
      )}
      </div>

      {/* Forward Message Modal */}
      <ForwardMessageModal
        isOpen={showForwardModal}
        onClose={handleForwardMessages}
        messagesToForward={messagesToForward}
      />

      {/* Image Viewer Modal */}
      <ImageViewerModal
        isOpen={!!viewingImage}
        onClose={() => setViewingImage(null)}
        imageUrl={viewingImage?.url || viewingImage}
        imageName={viewingImage?.filename || `image-${Date.now()}.jpg`}
      />

      {/* Camera Modal */}
      <CameraModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  )
}

export default ChatContainer