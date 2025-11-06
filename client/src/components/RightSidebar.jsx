import React, { useContext, useState, useEffect } from 'react'
import assets from '../assets/assets'
import { authcontext } from '../../context/authcontext'
import { chatContext } from '../../context/chatcontext'
import toast from 'react-hot-toast'
import ImageViewerModal from './ImageViewerModal'

const RightSidebar = ({selectedUser, messages = [], onClose}) => {
  const { logout, onlineUsers, user, axios } = useContext(authcontext)
  const { getUsers, getRecentChats, setSelectedUser } = useContext(chatContext)
  const [isEditing, setIsEditing] = useState(false)
  const [groupName, setGroupName] = useState(selectedUser?.fullName || selectedUser?.name || '')
  const [groupPic, setGroupPic] = useState(null)
  const [groupPicPreview, setGroupPicPreview] = useState(null)
  const [members, setMembers] = useState([])
  const [availableUsers, setAvailableUsers] = useState([])
  const [showAddMember, setShowAddMember] = useState(false)
  const [viewingImage, setViewingImage] = useState(null)
  const isGroup = selectedUser?.isGroup === true
  const isAdmin = isGroup && selectedUser?.adminId === (user?._id || user?.uid)
  const currentUserId = user?._id || user?.uid

  if (!selectedUser) return null

  // Load members when group info is opened
  useEffect(() => {
    if (isGroup && selectedUser.members) {
      loadMembers(selectedUser.members)
    }
    setGroupName(selectedUser?.fullName || selectedUser?.name || '')
    setGroupPicPreview(selectedUser?.profilePic || selectedUser?.groupPic || null)
  }, [selectedUser])

  const loadMembers = async (memberIds) => {
    try {
      // Get members from users list (only users, not groups)
      const { data } = await axios.get('/messages/users')
      if (data.success) {
        const allUsers = data.users || []
        
        // Filter out groups - only show regular users
        const regularUsers = allUsers.filter(u => !u.isGroup)
        
        // Get current group members (only users)
        const groupMembers = regularUsers.filter(u => {
          const userId = u._id || u.uid || u.id
          return userId && memberIds.includes(userId)
        })
        
        setMembers(groupMembers)
        
        // Set available users (exclude current members, current user, and groups)
        setAvailableUsers(regularUsers.filter(u => {
          const userId = u._id || u.uid || u.id
          return userId && !memberIds.includes(userId) && userId !== (user?._id || user?.uid)
        }))
      }
    } catch (error) {
      console.error('Error loading members:', error)
    }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file")
      e.target.value = ""
      return
    }

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

  const handleUpdateGroup = async () => {
    try {
      const { data } = await axios.put(`/messages/groups/update/${selectedUser._id}`, {
        name: groupName.trim(),
        groupPic: groupPic || null
      })

      if (data.success) {
        toast.success('Group updated successfully!')
        setIsEditing(false)
        // Update selected user
        setSelectedUser(data.group)
        // Refresh users list
        getUsers()
      } else {
        toast.error(data.message || 'Failed to update group')
      }
    } catch (error) {
      console.error('Error updating group:', error)
      toast.error(error.response?.data?.message || 'Failed to update group')
    }
  }

  const handleAddMembers = async (memberIds) => {
    try {
      const { data } = await axios.post(`/messages/groups/add/${selectedUser._id}`, {
        memberIds
      })

      if (data.success) {
        toast.success('Members added successfully!')
        setShowAddMember(false)
        // Reload members
        if (selectedUser.members) {
          loadMembers([...selectedUser.members, ...memberIds])
        }
        getUsers()
      } else {
        toast.error(data.message || 'Failed to add members')
      }
    } catch (error) {
      console.error('Error adding members:', error)
      toast.error(error.response?.data?.message || 'Failed to add members')
    }
  }

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) {
      return
    }

    try {
      const { data } = await axios.delete(`/messages/groups/remove/${selectedUser._id}/${userId}`)

      if (data.success) {
        toast.success('Member removed successfully!')
        // Reload members
        if (selectedUser.members) {
          loadMembers(selectedUser.members.filter(id => id !== userId))
        }
        getUsers()
      } else {
        toast.error(data.message || 'Failed to remove member')
      }
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error(error.response?.data?.message || 'Failed to remove member')
    }
  }

  const handleExitGroup = async () => {
    if (!isGroup || !currentUserId) return
    if (!window.confirm('Exit this group? You will no longer receive messages from it.')) return

    try {
      const { data } = await axios.delete(`/messages/groups/remove/${selectedUser._id}/${currentUserId}`)
      if (data.success) {
        toast.success('You left the group')
        // Deselect chat and refresh lists
        setSelectedUser(null)
        getUsers()
        if (getRecentChats) getRecentChats()
        if (onClose) onClose()
      } else {
        toast.error(data.message || 'Failed to exit group')
      }
    } catch (error) {
      console.error('Error exiting group:', error)
      toast.error(error.response?.data?.message || 'Failed to exit group')
    }
  }

  // Extract media (images) from messages
  const mediaMessages = (messages || []).filter(msg => msg.image).slice(-20)

  const isOnline = !isGroup && onlineUsers && (onlineUsers.includes(selectedUser._id) || onlineUsers.includes(selectedUser.uid) || onlineUsers.includes(selectedUser.id))

  return (
    <div className={`bg-[#818582]/10 text-white w-full relative overflow-y-scroll max-md:hidden`}>
      {/* Header with close button */}
      <div className='sticky top-0 bg-[#818582]/20 backdrop-blur-sm z-10 flex items-center justify-between p-4 border-b border-gray-600/30'>
        <h2 className='text-lg font-semibold'>{isGroup ? 'Group Info' : 'Contact Info'}</h2>
        <button 
          onClick={onClose}
          className='text-gray-400 hover:text-white transition-colors text-xl leading-none'
        >
          ×
        </button>
      </div>

      {/* Profile Picture and Name */}
      <div className='pt-8 flex flex-col items-center gap-3 text-xs font-light mx-auto'>
        <div className="relative">
          <img 
            src={groupPicPreview || selectedUser?.profilePic || selectedUser?.groupPic || assets.avatar_icon} 
            alt={selectedUser?.fullName}
            className='w-20 h-20 aspect-[1/1] rounded-full object-cover border-2 border-gray-600'
          />
          {isEditing && isGroup && isAdmin && (
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
          )}
        </div>
        
        {isEditing && isGroup && isAdmin ? (
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="px-3 py-1 bg-gray-800/50 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
            maxLength={25}
            placeholder="Group name"
          />
        ) : (
          <h1 className='px-10 text-lg font-medium mx-auto flex items-center gap-2'>
            {!isGroup && isOnline && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            )}
            {selectedUser.fullName || selectedUser.name || 'Unknown User'}
      </h1>
        )}

        {!isGroup && selectedUser.bio && (
          <p className='px-10 mx-auto text-center text-gray-300'>{selectedUser.bio}</p>
        )}

        {isGroup && isAdmin && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm"
          >
            Edit Group
          </button>
        )}

        {isEditing && isGroup && isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={handleUpdateGroup}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false)
                setGroupName(selectedUser?.fullName || selectedUser?.name || '')
                setGroupPic(null)
                setGroupPicPreview(selectedUser?.profilePic || selectedUser?.groupPic || null)
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        )}
     </div>

      <hr className='border-[#ffffffff50] my-4 mx-4' />

      {/* Group Members Section */}
      {isGroup && (
        <div className='px-5 mb-4'>
          <div className="flex items-center justify-between mb-3">
            <p className='text-gray-400 font-medium'>Participants ({members.length || selectedUser.members?.length || 0})</p>
            {isAdmin && !isEditing && (
              <button
                onClick={() => {
                  if (selectedUser.members) {
                    loadMembers(selectedUser.members)
                  }
                  setShowAddMember(true)
                }}
                className="text-violet-400 hover:text-violet-300 text-sm font-medium"
              >
                + Add
              </button>
            )}
          </div>

          {/* Members List */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {members.length > 0 ? (
              members.map((member) => {
                const userId = member._id || member.uid || member.id
                const isMemberAdmin = selectedUser?.adminId === userId
                return (
                  <div key={userId} className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <img
                        src={member.profilePic || assets.avatar_icon}
                        alt={member.fullName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium">{member.fullName || 'Unknown'}</p>
                        {isMemberAdmin && (
                          <p className="text-xs text-violet-400">Admin</p>
                        )}
                      </div>
                    </div>
                    {isAdmin && !isMemberAdmin && (
                      <button
                        onClick={() => handleRemoveMember(userId)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="text-gray-500 text-center py-4">Loading members...</p>
            )}
          </div>

          {/* Add Members Modal */}
          {showAddMember && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-700/50 w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
                  <h3 className="text-lg font-semibold text-white">Add Participants</h3>
                  <button
                    onClick={() => setShowAddMember(false)}
                    className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {availableUsers.length > 0 ? (
                    availableUsers.map((userItem) => {
                      const userId = userItem._id || userItem.uid || userItem.id
                      return (
                        <button
                          key={userId}
                          onClick={() => handleAddMembers([userId])}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition-colors text-left"
                        >
                          <img
                            src={userItem.profilePic || assets.avatar_icon}
                            alt={userItem.fullName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <p className="text-white font-medium">{userItem.fullName || 'Unknown'}</p>
                            {userItem.bio && (
                              <p className="text-xs text-gray-400 truncate">{userItem.bio}</p>
                            )}
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <p className="text-gray-500 text-center py-8">No users available to add</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isGroup && <hr className='border-[#ffffffff50] my-4 mx-4' />}

      {/* Media Section */}
      <div className='px-5 text-xs mb-20'>
        <p className='text-gray-400 mb-2 font-medium'>Media</p>
        {mediaMessages.length > 0 ? (
          <div className='mt-2 max-h-[300px] overflow-y-auto grid grid-cols-2 gap-2'>
            {mediaMessages.map((msg, index) => {
              const handleImageClick = () => {
                if (msg.image) {
                  // Extract filename from URL or use default
                  const imageUrl = msg.image
                  const urlParts = imageUrl.split('/')
                  const filename = urlParts[urlParts.length - 1].split('?')[0] || `image-${Date.now()}.jpg`
                  setViewingImage({ url: imageUrl, filename })
                }
              }
              
              return (
                <div 
                  key={msg._id || msg.id || index} 
                  onClick={handleImageClick}
                  className='cursor-pointer rounded-lg overflow-hidden hover:opacity-80 transition-opacity aspect-square bg-gray-700/30'
                >
                  <img 
                    src={msg.image} 
                    alt="Media" 
                    className='w-full h-full object-cover rounded-lg'
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <p className='text-gray-500 text-center py-8'>No media shared</p>
        )}
     </div>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        isOpen={!!viewingImage}
        onClose={() => setViewingImage(null)}
        imageUrl={viewingImage?.url || viewingImage}
        imageName={viewingImage?.filename || `image-${Date.now()}.jpg`}
      />

      {/* Bottom action button */}
      {isGroup ? (
        <div className='absolute bottom-5 left-0 right-0 px-5'>
          <button 
            onClick={handleExitGroup}
            className='w-full bg-red-600/80 hover:bg-red-600 text-white border-none text-sm font-light py-2.5 px-5 rounded-full cursor-pointer transition-all shadow-lg'
          >
            Exit Group
          </button>
        </div>
      ) : (
        <div className='absolute bottom-5 left-0 right-0 px-5'>
          <button 
            onClick={() => logout()} 
            className='w-full bg-gradient-to-r from-purple-400 to-violet-600 text-white border-none text-sm font-light py-2.5 px-5 rounded-full cursor-pointer hover:from-purple-500 hover:to-violet-700 transition-all shadow-lg'
          >
       Logout
     </button>
        </div>
      )}
    </div>
  )
}

export default RightSidebar
