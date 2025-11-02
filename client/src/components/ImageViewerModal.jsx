import React, { useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

const ImageViewerModal = ({ isOpen, onClose, imageUrl, imageName = 'image' }) => {
  // Handle keyboard events - use useCallback to avoid recreating the function
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  // Handle keyboard events
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, handleKeyDown])

  const handleDownload = async () => {
    if (!imageUrl) return
    
    try {
      // Fetch the image
      const response = await fetch(imageUrl)
      
      if (!response.ok) {
        throw new Error('Failed to fetch image')
      }
      
      const blob = await response.blob()
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob)
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = imageName || `image-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Image downloaded successfully!')
    } catch (error) {
      console.error('Error downloading image:', error)
      toast.error('Failed to download. Opening in new tab...')
      // Fallback: open in new tab
      window.open(imageUrl, '_blank')
    }
  }

  const handleBackdropClick = (e) => {
    // Close modal when clicking on the backdrop (not the image)
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen || !imageUrl) return null

  return (
    <div 
      className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10 z-10"
        title="Close (Esc)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="absolute top-4 right-16 text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10 z-10"
        title="Download image"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>

      {/* Image container */}
      <div className="relative max-w-full max-h-full flex items-center justify-center">
        <img 
          src={imageUrl} 
          alt="Full screen view"
          className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on image
        />
      </div>
    </div>
  )
}

export default ImageViewerModal

