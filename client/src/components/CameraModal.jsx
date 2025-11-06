import React, { useState, useRef, useEffect } from 'react'
import { toast } from 'react-hot-toast'

const CameraModal = ({ isOpen, onClose, onCapture }) => {
  const [stream, setStream] = useState(null)
  const [facingMode, setFacingMode] = useState('user') // 'user' for front, 'environment' for back
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  // Detect if running on mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  // Set mobile-specific video attributes
  useEffect(() => {
    if (videoRef.current && isMobile) {
      const video = videoRef.current
      // Set attributes for mobile browsers (especially Android WebView)
      video.setAttribute('webkit-playsinline', 'true')
      video.setAttribute('playsinline', 'true')
      video.setAttribute('x5-playsinline', 'true')
      video.setAttribute('x5-video-player-type', 'h5')
      video.setAttribute('x5-video-player-fullscreen', 'true')
    }
  }, [isMobile, isOpen])

  useEffect(() => {
    if (isOpen) {
      // Request fullscreen on mobile for better UX
      if (isMobile && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Ignore fullscreen errors
        })
      }
      startCamera()
    } else {
      stopCamera()
      // Exit fullscreen when closing
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          // Ignore fullscreen errors
        })
      }
    }

    return () => {
      stopCamera()
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          // Ignore fullscreen errors
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facingMode])

  const startCamera = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Stop existing stream if any
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser')
      }

      // Mobile-optimized constraints
      const constraints = {
        video: {
          facingMode: facingMode,
          // Use ideal constraints for better mobile compatibility
          width: { ideal: isMobile ? 1280 : 1920 },
          height: { ideal: isMobile ? 720 : 1080 },
          // Add aspect ratio for better mobile handling
          aspectRatio: { ideal: 16 / 9 }
        },
        audio: false
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play().then(resolve).catch(resolve)
            }
          } else {
            resolve()
          }
        })
      }
      setIsLoading(false)
    } catch (error) {
      console.error('Error accessing camera:', error)
      setIsLoading(false)
      setError(error)
      
      let errorMessage = 'Unable to access camera.'
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Camera permission denied. Please enable camera access in your device settings.'
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera found on this device.'
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = 'Camera is already in use by another application.'
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints not supported. Trying with default settings...'
        // Try with simpler constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: false
          })
          setStream(fallbackStream)
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream
          }
          setIsLoading(false)
          return
        } catch (fallbackError) {
          errorMessage = 'Unable to access camera with any settings.'
        }
      }
      
      toast.error(errorMessage)
      // Don't close immediately, let user see the error
      setTimeout(() => {
        onClose()
      }, 2000)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Camera not ready. Please wait...')
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Check if video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      toast.error('Video not ready. Please wait...')
      return
    }

    const context = canvas.getContext('2d')

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || video.clientWidth
    canvas.height = video.videoHeight || video.clientHeight

    // Handle mirroring for front camera on mobile
    if (facingMode === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Reset transform
    if (facingMode === 'user') {
      context.setTransform(1, 0, 0, 1, 0, 0)
    }

    // Convert canvas to base64 image with mobile-optimized quality
    const quality = isMobile ? 0.85 : 0.9
    const imageData = canvas.toDataURL('image/jpeg', quality)

    // Call onCapture with the image data
    onCapture(imageData)
    stopCamera()
    onClose()
  }

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center">
      <div className="relative w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm z-10">
          <h2 className="text-white text-lg font-semibold">Take Photo</h2>
          <button
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="text-white hover:text-gray-300 transition-colors text-3xl leading-none w-10 h-10 flex items-center justify-center"
            aria-label="Close camera"
          >
            ×
          </button>
        </div>

        {/* Loading/Error State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white">Starting camera...</p>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-6">
              <p className="text-red-400 mb-4">{error.message || 'Camera error occurred'}</p>
              <button
                onClick={startCamera}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Video Preview */}
        {!isLoading && !error && (
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                WebkitTransform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
              }}
            />
            
            {/* Camera controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent">
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                {/* Switch Camera Button */}
                <button
                  onClick={switchCamera}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-800/90 hover:bg-gray-700/90 active:bg-gray-600/90 flex items-center justify-center transition-colors touch-manipulation"
                  title="Switch camera"
                  aria-label="Switch camera"
                >
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                {/* Capture Button */}
                <button
                  onClick={capturePhoto}
                  disabled={isLoading || error}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white border-4 sm:border-6 border-gray-300 hover:border-gray-400 active:scale-95 transition-all flex items-center justify-center shadow-2xl touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Capture photo"
                  aria-label="Capture photo"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white"></div>
                </button>

                {/* Cancel Button */}
                <button
                  onClick={() => {
                    stopCamera()
                    onClose()
                  }}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gray-800/90 hover:bg-gray-700/90 active:bg-gray-600/90 flex items-center justify-center transition-colors touch-manipulation"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden canvas for capturing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}

export default CameraModal

