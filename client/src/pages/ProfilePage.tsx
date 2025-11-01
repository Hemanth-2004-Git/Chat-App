import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import assets from '../assets/assets';
import { authcontext } from '../../context/authcontext';

const ProfilePage = () => {
  const { authuser, updateprofile } = useContext(authcontext); // ✅ Fixed variable name
  const [selectedImg, setSelectedImg] = useState(null);
  const navigate = useNavigate();
  
  // ✅ Initialize state with proper fallbacks and useEffect to update when authuser changes
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');

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

  const handleSubmit = async (e) => { // ✅ Fixed function name
    e.preventDefault();
    
    try {
      if (!selectedImg) {
        await updateprofile({ fullName: name, bio }); // ✅ Fixed function name and property
        navigate('/home'); // ✅ Navigate to home instead of root
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(selectedImg);
      reader.onloadend = async () => {
        const base64Image = reader.result;
        await updateprofile({ profilePic: base64Image, fullName: name, bio }); // ✅ Fixed property name
        navigate('/home'); // ✅ Navigate to home instead of root
      };
    } catch (error) {
      console.error('Profile update error:', error);
    }
  };

  return (
    <div className='min-h-screen bg-cover bg-no-repeat flex items-center justify-center p-4'>
      <div className='w-full max-w-2xl backdrop-blur-2xl text-gray-300 border-2 border-gray-600 flex items-center justify-between max-sm:flex-col-reverse rounded-lg'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-5 p-8 flex-1'>
          <h3 className='text-2xl font-bold text-white mb-2'>Profile Details</h3>

          {/* Profile Image Upload */}
          <label htmlFor='avatar' className='flex items-center gap-4 cursor-pointer p-3 border border-gray-600 rounded-lg hover:bg-white/5 transition-colors'>
            <input
              onChange={(e) => setSelectedImg(e.target.files[0])}
              type='file'
              id='avatar'
              accept='.png,.jpeg,.jpg'
              hidden
            />
            <img
              src={selectedImg ? URL.createObjectURL(selectedImg) : (authuser.profilePic || assets.avatar_icon)}
              alt='Profile'
              className={`w-16 h-16 ${(selectedImg || authuser.profilePic) ? 'rounded-full object-cover' : ''}`}
            />
            <div>
              <p className='font-medium'>Upload profile image</p>
              <p className='text-sm text-gray-400'>Click to select a new photo</p>
            </div>
          </label>

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
          <img
            className='w-32 h-32 rounded-full object-cover border-4 border-violet-500'
            src={selectedImg ? URL.createObjectURL(selectedImg) : (authuser.profilePic || assets.avatar_icon)}
            alt='Profile Preview'
          />
          <h2 className='text-xl font-bold text-white mt-4'>{name || 'Your Name'}</h2>
          <p className='text-gray-400 text-center mt-2'>{bio || 'Your bio will appear here'}</p>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;