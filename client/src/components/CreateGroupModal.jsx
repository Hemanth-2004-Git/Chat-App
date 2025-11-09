import React, { useState, useContext } from 'react'
import { authcontext } from '../../context/authcontext.jsx'
import { chatContext } from '../../context/chatcontext.jsx'
import assets from '../assets/assets'
import toast from 'react-hot-toast'

const CreateGroupModal = ({ isOpen, onClose }) => {
  const [groupName, setGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [groupPic, setGroupPic] = useState(null)
  const [groupPicPreview, setGroupPicPreview] = useState(null)
  const { users, getUsers } = useContext(chatContext)
  const { user, axios } = useContext(authcontext)

  if (!isOpen) return null

  // Filter out current user and groups from available members
  // Only show regular users, not groups
  const currentUserId = user?._id || user?.uid || ''
  const availableMembers = (users || []).filter(u => {
    const userId = u._id || u.uid || u.id
    // Exclude current user and groups
    return userId && userId !== currentUserId && !u.isGroup
  })

  const toggleMember = (userId) => {
    setSelectedMembers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId)
      } else {
        return [...prev, userId]
      }
    })
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file")
      e.target.value = ""
      return
    }

    // Check file size (limit to 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(`Image size should be less than 5MB. Current: ${(file.size / (1024 * 1024)).toFixed(2)}MB`)
      e.target.value = ""
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setGroupPic(reader.result)
      setGroupPicPreview(reader.result)
    }
    reader.onerror = () => {
      toast.error("Failed to read image file")
      e.target.value = ""
    }
    reader.readAsDataURL(file)
  }

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name')
      return
    }

    if (selectedMembers.length < 2) {
      toast.error('Please select at least 2 members')
      return
    }

    try {
      const { data } = await axios.post('/messages/groups/create', {
        name: groupName.trim(),
        members: selectedMembers,
        groupPic: groupPic || null
      })

      if (data.success) {
        toast.success('Group created successfully!')
        onClose()
        setGroupName('')
        setSelectedMembers([])
        setGroupPic(null)
        setGroupPicPreview(null)
        // Refresh users list to include the new group
        setTimeout(() => {
          getUsers()
        }, 500) // Small delay to ensure backend has processed
      } else {
        toast.error(data.message || 'Failed to create group')
      }
    } catch (error) {
      console.error('Error creating group:', error)
      toast.error(error.response?.data?.message || 'Failed to create group')
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
          <h2 className="text-xl font-semibold text-white">Create New Group</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Group Profile Picture */}
          <div className="flex flex-col items-center gap-3">
            <label className="block text-sm font-medium text-gray-300">
              Group Profile Picture (Optional)
            </label>
            <div className="relative">
              <img
                src={groupPicPreview || assets.avatar_icon}
                alt="Group"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-600"
              />
              <label className="absolute bottom-0 right-0 bg-violet-600 text-white rounded-full p-2 cursor-pointer hover:bg-violet-700 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Group Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
              maxLength={25}
            />
            <p className="text-xs text-gray-500 mt-1">{groupName.length}/25</p>
          </div>

          {/* Members Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Members ({selectedMembers.length} selected)
            </label>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {availableMembers.length > 0 ? (
                availableMembers.map((member) => {
                  const userId = member._id || member.uid || member.id
                  const isSelected = selectedMembers.includes(userId)
                  
                  return (
                    <div
                      key={userId}
                      onClick={() => toggleMember(userId)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-violet-600/30 border border-violet-500'
                          : 'bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/30'
                      }`}
                    >
                      <img
                        src={member.profilePic || assets.avatar_icon}
                        alt={member.fullName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <p className="text-white font-medium">{member.fullName || 'Unknown'}</p>
                        {member.bio && (
                          <p className="text-xs text-gray-400 truncate">{member.bio}</p>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'bg-violet-500 border-violet-500'
                          : 'border-gray-500'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-gray-500 text-center py-8">No users available</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedMembers.length < 2}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Create Group
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateGroupModal

