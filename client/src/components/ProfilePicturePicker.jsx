import React, { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

const ProfilePicturePicker = ({ onSelect, currentProfilePic, onClose, isOpen }) => {
  if (!isOpen) return null;
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);

  const handleFileSelect = (e, source) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      setSelectedOption(source);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handlePhotoLibraryClick = () => {
    fileInputRef.current?.click();
  };

  const handleConfirm = () => {
    if (preview) {
      onSelect(preview);
      onClose();
    } else {
      toast.error('Please select or capture an image first');
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setSelectedOption(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <h2 className="text-xl font-semibold text-white">Set Profile Picture</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Current Profile Preview */}
        <div className="p-6 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-violet-500 bg-gray-800 flex items-center justify-center">
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : currentProfilePic ? (
                <img
                  src={currentProfilePic}
                  alt="Current"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target;
                    target.style.display = 'none';
                    target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-violet-600"
                style={{ display: preview || currentProfilePic ? 'none' : 'flex' }}
              >
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            {preview && (
              <button
                onClick={handleRemove}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                title="Remove preview"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-sm text-gray-400 text-center">
            {preview ? 'Preview your new profile picture' : 'Choose how you want to set your profile picture'}
          </p>
        </div>

        {/* Options Grid - Snapchat Style */}
        <div className="p-6 pt-0">
          <div className="grid grid-cols-3 gap-4">
            {/* Camera Option */}
            <button
              onClick={handleCameraClick}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl transition-all ${
                selectedOption === 'camera'
                  ? 'bg-violet-500/20 border-2 border-violet-500'
                  : 'bg-gray-800/50 border-2 border-gray-700 hover:bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-white">Camera</span>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFileSelect(e, 'camera')}
                className="hidden"
              />
            </button>

            {/* Photo Library Option */}
            <button
              onClick={handlePhotoLibraryClick}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl transition-all ${
                selectedOption === 'library'
                  ? 'bg-violet-500/20 border-2 border-violet-500'
                  : 'bg-gray-800/50 border-2 border-gray-700 hover:bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-white">Library</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'library')}
                className="hidden"
              />
            </button>

            {/* 3D Avatar Option */}
            <button
              onClick={() => {
                setSelectedOption('avatar');
                onSelect('avatar'); // Signal to open avatar creator
              }}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl transition-all ${
                selectedOption === 'avatar'
                  ? 'bg-violet-500/20 border-2 border-violet-500'
                  : 'bg-gray-800/50 border-2 border-gray-700 hover:bg-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-white">3D Avatar</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            Cancel
          </button>
          {preview && (
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all font-medium shadow-lg"
            >
              Set Picture
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePicturePicker;

