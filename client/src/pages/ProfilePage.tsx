import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import assets from '../assets/assets';
import { authcontext } from '../../context/authcontext.jsx';
import AvatarCreator from '../components/AvatarCreator';
import ProfilePicturePicker from '../components/ProfilePicturePicker';
import ImageWithRetry from '../components/ImageWithRetry';
import Avatar3DViewer from '../components/Avatar3DViewer';

const ProfilePage = () => {
  const { authuser, updateprofile } = useContext(authcontext);
  const navigate = useNavigate();
  
  // ✅ Initialize state with proper fallbacks and useEffect to update when authuser changes
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [showAvatarCreator, setShowAvatarCreator] = useState(false);
  const [showProfilePicker, setShowProfilePicker] = useState(false);

  // ✅ Update form when authuser changes
  useEffect(() => {
    if (authuser) {
      setName(authuser.fullName || ''); // ✅ Fixed property name (fullName vs fullname)
      setBio(authuser.bio || '');
    }
  }, [authuser]);

  // ✅ Show loading or redirect if no user
  if (!authuser) {
    navigate('/login');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await updateprofile({ fullName: name, bio });
      toast.success('Profile updated successfully!');
      navigate('/home');
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update profile';
      toast.error(errorMessage);
    }
  };

  return (
    <div className='min-h-screen bg-cover bg-no-repeat flex items-center justify-center p-4'>
      <div className='w-full max-w-2xl backdrop-blur-2xl text-gray-300 border-2 border-gray-600 flex items-center justify-between max-sm:flex-col-reverse rounded-lg'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-5 p-8 flex-1'>
          <h3 className='text-2xl font-bold text-white mb-2'>Profile Details</h3>

          {/* Profile Picture Section - Snapchat Style */}
          <div className='space-y-2'>
            <div className='flex items-center gap-4 p-3 border border-gray-600 rounded-lg bg-gray-800/30'>
              <div className="relative">
                {(() => {
                  // Check if profile picture is a 3D avatar (GLB)
                  const is3DAvatar = authuser.profilePic && 
                    !authuser.profilePic.startsWith('data:image') &&
                    (authuser.profilePic.includes('models.readyplayer.me') || 
                     authuser.profilePic.includes('.glb'));
                  
                  // For 3D avatars, show a special icon instead of trying to load images
                  if (is3DAvatar) {
                    return (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center border-2 border-violet-500 cursor-pointer hover:opacity-80 transition-opacity shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {/* 3D Badge */}
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-violet-400 rounded-full flex items-center justify-center border-2 border-gray-900 shadow-md">
                          <span className="text-[8px] text-white font-bold leading-none">3D</span>
                        </div>
                      </div>
                    );
                  }
                  
                  // For regular images, show them normally
                  return (
                    <ImageWithRetry
                      src={authuser.profilePic || assets.avatar_icon}
                      alt='Profile'
                      className={`w-16 h-16 rounded-full object-cover border-2 border-violet-500 cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() => setShowProfilePicker(true)}
                      fallbackSrc={assets.avatar_icon}
                      maxRetries={2}
                      retryDelay={2000}
                    />
                  );
                })()}
                {/* Edit Icon Overlay */}
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setShowProfilePicker(true)}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              </div>
              <div className='flex-1'>
                <p className='font-medium text-gray-300'>Profile Picture</p>
                <p className='text-sm text-gray-400'>Tap to change your profile picture</p>
              </div>
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className='block text-sm font-medium text-gray-300 mb-2'>
              Full Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type='text'
              required
              placeholder='Your Name'
              className='w-full p-3 border border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white placeholder-gray-400'
            />
          </div>

          {/* Bio Input */}
          <div>
            <label className='block text-sm font-medium text-gray-300 mb-2'>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder='Tell us about yourself...'
              required
              className='w-full p-3 border border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white/5 text-white placeholder-gray-400 resize-none'
              rows={4}
            />
          </div>

          {/* Action Buttons */}
          <div className='flex gap-3 mt-4'>
            <button
              type='submit'
              className='flex-1 bg-gradient-to-r from-purple-500 to-violet-600 text-white p-3 rounded-lg text-lg font-medium hover:from-purple-600 hover:to-violet-700 transition-all cursor-pointer'
            >
              Save Changes
            </button>
            <button
              type='button'
              onClick={() => navigate('/home')}
              className='px-6 bg-gray-600 text-white p-3 rounded-lg hover:bg-gray-700 transition-colors'
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Profile Preview */}
        <div className='flex flex-col items-center p-8 max-sm:pb-0'>
          {/* 3D Avatar Viewer - Show only for Ready Player Me GLB URLs */}
          {authuser.profilePic && 
           !authuser.profilePic.startsWith('data:image') && 
           (authuser.profilePic.includes('models.readyplayer.me') || 
            authuser.profilePic.includes('.glb')) ? (
            <div className="relative w-64 h-80 overflow-hidden mb-4">
              <Avatar3DViewer 
                glbUrl={authuser.profilePic}
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          ) : (
            <ImageWithRetry
              className='w-32 h-32 rounded-full object-cover border-4 border-violet-500'
              src={authuser.profilePic || assets.avatar_icon}
              alt='Profile Preview'
              fallbackSrc={assets.avatar_icon}
              maxRetries={5}
              retryDelay={2000}
            />
          )}
        </div>
      </div>

      {/* Profile Picture Picker Modal - Snapchat Style */}
      <ProfilePicturePicker
        isOpen={showProfilePicker}
        onClose={() => setShowProfilePicker(false)}
        currentProfilePic={authuser.profilePic}
        onSelect={async (selected) => {
          if (selected === 'avatar') {
            // Open avatar creator
            setShowProfilePicker(false);
            setShowAvatarCreator(true);
          } else {
            // Handle image file/photo
            try {
              console.log('Saving profile picture from picker:', selected.substring(0, 50) + '...');
              
              const profileData = {
                profilePic: selected,
                fullName: name || authuser.fullName || 'User',
                bio: bio || authuser.bio || ''
              };

              const result = await updateprofile(profileData);
              
              if (result?.success || result) {
                toast.success('Profile picture updated successfully!');
                if (result.user) {
                  setName(result.user.fullName || profileData.fullName);
                  setBio(result.user.bio || profileData.bio);
                }
                setShowProfilePicker(false);
              }
            } catch (error: any) {
              console.error('Error saving profile picture:', error);
              const errorMessage = error.response?.data?.message || error.message || 'Failed to save profile picture';
              toast.error(errorMessage);
            }
          }
        }}
      />

      {/* 3D Avatar Creator Modal */}
      <AvatarCreator
        isOpen={showAvatarCreator}
        onClose={() => setShowAvatarCreator(false)}
        onSave={async (avatarUrl) => {
          // Save the avatar URL directly to profile
          try {
            console.log('Saving avatar URL to profile:', avatarUrl)
            
            // Ensure we have a valid URL
            if (!avatarUrl || !avatarUrl.startsWith('http')) {
              toast.error('Invalid avatar URL. Please try creating the avatar again.')
              return
            }

            // Extract avatar ID and store both image URL and GLB URL for 3D viewing
            let optimizedUrl = avatarUrl
            let glbUrl: string | null = null
            
            // Extract avatar ID from various URL formats
            const avatarIdMatch = avatarUrl.match(/character=([^&]+)/) || 
                                 avatarUrl.match(/avatars\/([^\/]+)/) ||
                                 avatarUrl.match(/thumbnails\.readyplayer\.me\/([^\/]+)/) ||
                                 avatarUrl.match(/models\.readyplayer\.me\/([^\/]+)/)
            
            if (avatarIdMatch && avatarIdMatch[1]) {
              const avatarId = avatarIdMatch[1].split('.')[0] // Remove extensions
              
              // Keep the optimized image URL for 2D display
              if (avatarUrl.includes('render.readyplayer.me')) {
                optimizedUrl = `https://thumbnails.readyplayer.me/${avatarId}.png`
                console.log('✅ Converted Render API to thumbnail service:', optimizedUrl)
              } else if (avatarUrl.includes('api.readyplayer.me/v2/avatars')) {
                optimizedUrl = `https://thumbnails.readyplayer.me/${avatarId}.png`
                console.log('✅ Converted Avatar API v2 to thumbnail service:', optimizedUrl)
              }
              
              // Store GLB URL for 3D viewing (use original if it's already GLB, otherwise construct it)
              if (avatarUrl.includes('.glb')) {
                glbUrl = avatarUrl
              } else {
                glbUrl = `https://models.readyplayer.me/${avatarId}.glb`
              }
              console.log('📦 GLB URL for 3D viewer:', glbUrl)
            }

            // Store both image URL (for 2D) and GLB URL (for 3D) in profilePic
            // We'll store a combined format or just use the GLB URL which can be converted to image
            // For now, store the GLB URL as primary since we can extract image from it
            const finalUrl = glbUrl || optimizedUrl

            // Get current form values or use existing user data
            const profileData = {
              profilePic: finalUrl, // Store GLB URL - Avatar3DViewer can extract from it
              fullName: name || authuser.fullName || 'User',
              bio: bio || authuser.bio || ''
            }

            console.log('Updating profile with data:', {
              ...profileData,
              profilePic: profileData.profilePic.substring(0, 50) + '...'
            })

            const result = await updateprofile(profileData)
            
            if (result?.success || result) {
              toast.success('3D Avatar saved as profile picture!')
              // The updateprofile function already updates the user in context
              // Update local form state to reflect changes
              if (result.user) {
                setName(result.user.fullName || profileData.fullName)
                setBio(result.user.bio || profileData.bio)
              } else {
                setName(profileData.fullName)
                setBio(profileData.bio)
              }
              // Close the modal after successful save
              setShowAvatarCreator(false)
              // Force a small delay to ensure state updates are reflected
              setTimeout(() => {
                // Trigger a re-render by updating state slightly
                // This ensures the profile picture preview updates
              }, 100)
            } else {
              throw new Error('Profile update did not return success')
            }
          } catch (error: any) {
            console.error('Error saving avatar:', error)
            const errorMessage = error.response?.data?.message || error.message || 'Failed to save avatar'
            toast.error(errorMessage)
            // Don't close modal on error so user can try again
          }
        }}
        currentProfilePic={authuser.profilePic}
      />
    </div>
  );
};

export default ProfilePage;