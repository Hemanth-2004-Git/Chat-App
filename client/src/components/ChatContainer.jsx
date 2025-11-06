import React, {useEffect, useRef, useState} from 'react'
import assets from '../assets/assets'
import { formatMessageTime } from '../libs/utils'
import { chatContext } from '../../context/chatcontext'
import { authcontext } from '../../context/authcontext'
import { useContext } from 'react'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import ForwardMessageModal from './ForwardMessageModal'
import ImageViewerModal from './ImageViewerModal'
import EmojiPicker from './EmojiPicker'
import CameraModal from './CameraModal'

const ChatContainer = () => {
  const {messages, selectedUser, setSelectedUser, sendMessage, getMessages, users, deleteMessage, editMessage, forwardMessage, loadingMessages} = useContext(chatContext)
  const {authuser, onlineUsers, logout} = useContext(authcontext)
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

  // Safe message sending
  const handleSendMessage = async () => {
    if(!input.trim()) {
      toast.error("Message cannot be empty")
      return
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
    }
  }, [selectedUser])

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

  if (!selectedUser) {
    return (
      <div className='flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden'>
        <img src={assets.logo_icon} className='max-w-16' alt=""/>
        <p className='text-lg font-medium text-white'>Select a user to start chatting</p>
      </div>
    )
  }

  return (
    <div 
      className='h-full overflow-scroll relative'
      style={{
        backgroundImage: `url(${assets.bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'scroll'
      }}
    >
      {/* Overlay for better readability */}
      <div className='absolute inset-0 bg-black/20 backdrop-blur-sm'></div>
      
      {/* Content with relative positioning */}
      <div className='relative z-10 h-full'>
      {/* Header */}
        <div className='flex items-center gap-3 py-3 mx-4 border-b border-stone-500/50 bg-black/10 backdrop-blur-sm'>
        <img src={selectedUser.profilePic || assets.avatar_icon} alt="" className="w-8 rounded-full"/>
        <p className='flex-1 text-lg text-white flex items-center gap-2'>
          {selectedUser.fullName}
          {!selectedUser.isGroup && (onlineUsers.includes(selectedUser._id) ? 
            <span className="w-2 h-2 rounded-full bg-green-500"></span> : 
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
          )}
        </p>
        <img 
          onClick={() => setSelectedUser(null)} 
          src={assets.arrow_icon} 
          alt=""
          className='md:hidden max-w-7 cursor-pointer'
        />
        <img 
          src={assets.help_icon} 
          alt="Info" 
          onClick={() => {
            // Toggle right sidebar via parent component
            const event = new CustomEvent('toggleInfo', { detail: { user: selectedUser } });
            window.dispatchEvent(event);
          }}
          className='max-md:hidden max-w-5 cursor-pointer hover:opacity-80 transition-opacity'
        />
      </div>

        {/* Messages - WhatsApp Style */}
        <div className='flex flex-col h-[calc(100%-120px)] overflow-y-auto px-4 py-2 gap-1'>
        {loadingMessages && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm">Loading messages...</p>
            </div>
          </div>
        ) : messages && messages.length > 0 ? messages.map((msg, index) => {
          // SAFE CHECK: Ensure message has required properties
          if (!msg || typeof msg !== 'object') return null
          
          // Check if message is from current user - compare as strings to handle ID mismatches
                  const currentUserId = String(authuser?._id || authuser?.uid || '');
                  const messageSenderId = String(msg.senderId || '');
                  const isOwnMessage = messageSenderId === currentUserId && currentUserId !== '';
                  const isGroup = selectedUser?.isGroup === true;
                  const isSystemMessage = msg.type === 'system' || msg.senderId === 'system';
                  
          const messageText = msg.text || ''
          const messageImage = msg.image
          const messageTime = msg.createdAt ? formatMessageTime(msg.createdAt) : (msg.timestamp ? formatMessageTime(msg.timestamp) : '')
          const senderName = isGroup && !isOwnMessage ? (msg.senderName || 'Unknown') : null

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
            <div 
                  key={msg._id || msg.id || index} 
                  className={`flex items-end gap-2 w-full mb-2 ${isOwnMessage ? 'justify-end' : 'justify-start'} relative group`}
                  onMouseEnter={() => setHoveredMessageId(msg._id || msg.id)}
                  onMouseLeave={() => !showDeleteMenu && setHoveredMessageId(null)}
                >
                  {/* Other user's profile pic - shown on LEFT for received messages */}
              {!isOwnMessage && (
                <img 
                      src={senderProfilePic} 
                      alt={isGroup ? senderName : selectedUser?.fullName} 
                      className='w-8 h-8 rounded-full object-cover flex-shrink-0 mb-1'
                    />
                  )}
                  
                  {/* Message content - WhatsApp style bubbles */}
                  <div className={`flex flex-col ${isOwnMessage ? 'items-end max-w-[75%]' : 'items-start max-w-[75%]'} relative ${isOwnMessage ? 'pr-2' : ''}`}>
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
                        (onlineUsers.includes(selectedUser?._id) || onlineUsers.includes(selectedUser?.uid) || onlineUsers.includes(selectedUser?.id)) ? (
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
                        <span className='text-xs ml-1'>
                          {msg.isSending ? (
                            <span className='inline-block w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin'></span>
                          ) : !isGroup ? (
                            (onlineUsers.includes(selectedUser?._id) || onlineUsers.includes(selectedUser?.uid) || onlineUsers.includes(selectedUser?.id)) ? (
                              '✓✓'
                            ) : (
                              '✓'
                            )
                          ) : (
                            '✓✓'
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
          )
        }) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <p>No messages yet. Start a conversation!</p>
          </div>
        )}
        <div ref={scrollEnd}></div>
      </div>

      {/* Input Area */}
            <div ref={inputAreaRef} className='absolute bottom-0 left-0 right-0 bg-black/20 backdrop-blur-md z-20'>
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
              
              <div className='flex items-center gap-3 p-3'>
        <div className='flex-1 flex items-center bg-gray-100/12 px-3 rounded-full'>
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
              <label htmlFor="image" className="cursor-pointer">
                <img src={assets.gallery_icon} alt="Attach image" className="w-5"/>
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