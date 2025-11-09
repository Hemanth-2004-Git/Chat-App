import React, { useState, useContext } from 'react'
import { authcontext } from '../../context/authcontext.jsx'
import { chatContext } from '../../context/chatcontext.jsx'
import assets from '../assets/assets'

const ForwardMessageModal = ({ isOpen, onClose, messagesToForward = [] }) => {
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const { users } = useContext(chatContext)
  const { user } = useContext(authcontext)

  if (!isOpen) return null

  // Filter out current user from available recipients
  // Include both users and groups
  const currentUserId = user?._id || user?.uid || ''
  const availableRecipients = (users || []).filter(u => {
    const userId = u._id || u.uid || u.id
    return userId && userId !== currentUserId
  })

  // Filter by search query
  const filteredRecipients = searchQuery
    ? availableRecipients.filter(u => 
        (u.fullName || u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableRecipients

  const toggleRecipient = (userId) => {
    setSelectedRecipients(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  const handleForward = () => {
    if (selectedRecipients.length === 0) {
      return
    }
    
    // Call the forward callback with selected recipients
    if (onClose && typeof onClose === 'function') {
      // onClose will be called with the selected recipients
      // The actual forwarding will be handled by the parent component
      onClose(selectedRecipients)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-700/50 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Forward Messages</h2>
              <p className="text-xs text-gray-400">
                {messagesToForward.length} message{messagesToForward.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose(null)}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Preview of messages to forward */}
        {messagesToForward.length > 0 && (
          <div className="p-4 border-b border-gray-700/50 bg-gray-800/30">
            <p className="text-xs text-gray-400 mb-2">Forwarding:</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {messagesToForward.slice(0, 3).map((msg, idx) => (
                <div key={idx} className="bg-gray-900/50 rounded-lg p-2 text-sm text-gray-300">
                  {msg.image ? (
                    <div className="flex items-center gap-2">
                      <img src={msg.image} alt="Forward" className="w-10 h-10 rounded object-cover" />
                      <span className="text-xs text-gray-400">Image</span>
                    </div>
                  ) : (
                    <p className="text-xs truncate">{msg.text || 'No text'}</p>
                  )}
                </div>
              ))}
              {messagesToForward.length > 3 && (
                <p className="text-xs text-gray-400 text-center">
                  +{messagesToForward.length - 3} more message{messagesToForward.length - 3 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-4 border-b border-gray-700/50">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full px-4 py-2 pl-10 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Recipients List */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm font-medium text-gray-300 mb-3">
            Select contacts ({selectedRecipients.length} selected)
          </p>
          <div className="space-y-2">
            {filteredRecipients.length > 0 ? (
              filteredRecipients.map((recipient) => {
                const userId = recipient._id || recipient.uid || recipient.id
                const isSelected = selectedRecipients.includes(userId)
                const isGroup = recipient.isGroup === true
                
                return (
                  <div
                    key={userId}
                    onClick={() => toggleRecipient(userId)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-violet-600/30 border border-violet-500'
                        : 'bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/30'
                    }`}
                  >
                    {isGroup ? (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    ) : (
                      <img
                        src={recipient.profilePic || assets.avatar_icon}
                        alt={recipient.fullName || recipient.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {recipient.fullName || recipient.name || 'Unknown'}
                      </p>
                      {!isGroup && recipient.bio && (
                        <p className="text-xs text-gray-400 truncate">{recipient.bio}</p>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'bg-violet-500 border-violet-500'
                        : 'border-gray-500'
                    }`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-gray-500 text-center py-8">No contacts found</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700/50 flex gap-3">
          <button
            onClick={() => onClose(null)}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleForward}
            disabled={selectedRecipients.length === 0}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Forward {selectedRecipients.length > 0 && `(${selectedRecipients.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ForwardMessageModal

