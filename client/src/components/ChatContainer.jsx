import React, {useEffect, useRef, useState} from 'react'
import assets from '../assets/assets'
import { formatMessageTime } from '../libs/utils'
import { chatContext } from '../../context/chatcontext'
import { authcontext } from '../../context/authcontext'
import { useContext } from 'react'
import { toast } from 'react-hot-toast'

const ChatContainer = () => {
  const {messages, selectedUser, setSelectedUser, sendMessage, getMessages} = useContext(chatContext)
  const {authuser, onlineUsers} = useContext(authcontext)

  const scrollEnd = useRef()
  const [input, setInput] = useState('')

  // Safe message sending
  const handleSendMessage = async () => {
    if(!input.trim()) {
      toast.error("Message cannot be empty")
      return
    }
    
    try {
      await sendMessage({text: input.trim()})
      setInput("")
    } catch (error) {
      console.error(error)
      toast.error("Failed to send message")
    }
  }

  const handleKeyDown = (e) => {
    if(e.key === "Enter") {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handlesendimage = async (e) => {
    const file = e.target.files[0]
    if(!file || !file.type.startsWith("image/")) {
      toast.error("Please select a valid image file")
      return
    }

    const reader = new FileReader()
    reader.onloadend = async () => {
      try {
        await sendMessage({image: reader.result})
        e.target.value = ""
      } catch (error) {
        console.error(error)
        toast.error("Failed to send image")
      }
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if(selectedUser && selectedUser._id) {
      getMessages(selectedUser._id)
    }
  }, [selectedUser])

  useEffect(() => {
    if(scrollEnd.current) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  if (!selectedUser) {
    return (
      <div className='flex flex-col items-center justify-center gap-2 text-gray-500 bg-white/10 max-md:hidden'>
        <img src={assets.logo_icon} className='max-w-16' alt=""/>
        <p className='text-lg font-medium text-white'>Select a user to start chatting</p>
      </div>
    )
  }

  return (
    <div className='h-full overflow-scroll relative backdrop-blur-lg'>
      {/* Header */}
      <div className='flex items-center gap-3 py-3 mx-4 border-b border-stone-500'>
        <img src={selectedUser.profilePic || assets.avatar_icon} alt="" className="w-8 rounded-full"/>
        <p className='flex-1 text-lg text-white flex items-center gap-2'>
          {selectedUser.fullName}
          {onlineUsers.includes(selectedUser._id) ? 
            <span className="w-2 h-2 rounded-full bg-green-500"></span> : 
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
          }
        </p>
        <img 
          onClick={() => setSelectedUser(null)} 
          src={assets.arrow_icon} 
          alt=""
          className='md:hidden max-w-7 cursor-pointer'
        />
        <img src={assets.help_icon} alt="" className='max-md:hidden max-w-5 cursor-pointer'/>
      </div>

      {/* Messages - COMPLETELY SAFE */}
      <div className='flex flex-col h-[calc(100%-120px)] overflow-y-scroll p-3 pb-6'>
        {messages && messages.length > 0 ? messages.map((msg, index) => {
          // SAFE CHECK: Ensure message has required properties
          if (!msg || typeof msg !== 'object') return null
          
          const isOwnMessage = msg.senderId === authuser?._id
          const messageText = msg.text || ''
          const messageImage = msg.image
          const messageTime = msg.createdAt ? formatMessageTime(msg.createdAt) : ''

          return (
            <div 
              key={msg._id || index} 
              className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              {/* Other user's profile pic */}
              {!isOwnMessage && (
                <img 
                  src={selectedUser?.profilePic || assets.avatar_icon} 
                  alt="" 
                  className='w-7 rounded-full'
                />
              )}
              
              {/* Message content */}
              <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                {messageImage ? (
                  <img 
                    src={messageImage} 
                    alt="Sent image" 
                    className='max-w-[230px] border border-gray-700 rounded-lg overflow-hidden mb-1'
                  />
                ) : (
                  <p 
                    className={`p-2 max-w-[200px] md:text-sm font-light rounded-lg mb-1 break-all bg-violet-500/30 text-white ${
                      isOwnMessage ? 'rounded-br-none' : 'rounded-bl-none'
                    }`}
                  >
                    {messageText}
                  </p>
                )}
                <p className='text-gray-500 text-xs'>{messageTime}</p>
              </div>
              
              {/* Current user's profile pic */}
              {isOwnMessage && (
                <img 
                  src={authuser?.profilePic || assets.avatar_icon} 
                  alt="" 
                  className='w-7 rounded-full'
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
      <div className='absolute bottom-0 left-0 right-0 flex items-center gap-3 p-3'>
        <div className='flex-1 flex items-center bg-gray-100/12 px-3 rounded-full'>
          <input 
            onChange={(e) => setInput(e.target.value)} 
            value={input} 
            onKeyDown={handleKeyDown}
            type="text" 
            placeholder="Type a message..." 
            className='flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400 bg-transparent'
          />
          <input onChange={handlesendimage} type="file" id='image' accept='image/png,image/jpeg' hidden/>
          <label htmlFor="image" className="cursor-pointer">
            <img src={assets.gallery_icon} alt="Attach image" className="w-5 mr-2"/>
          </label>
        </div>
        <button 
          onClick={handleSendMessage} 
          disabled={!input.trim()}
          className="p-2 disabled:opacity-50"
        >
          <img src={assets.send_button} alt="Send" className='w-7' />
        </button>
      </div>
    </div>
  )
}

export default ChatContainer