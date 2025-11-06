import React, { useState, useRef, useEffect } from 'react'
import { toast } from 'react-hot-toast'

const CameraModal = ({ isOpen, onClose, onCapture }) => {
  const [stream, setStream] = useState(null)
  const [facingMode, setFacingMode] = useState('user') // 'user' for front, 'environment' for back
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [useFileInput, setUseFileInput] = useState(false) // Fallback to file input for APK
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)

  // Detect if running on mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
  // Detect if running in WebView/APK (common indicators)
  const isWebView = window.navigator.standalone || 
                    window.matchMedia('(display-mode: standalone)').matches ||
                    /wv|WebView/i.test(navigator.userAgent) ||
                    !window.chrome

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

  // Start camera when modal opens and video element is ready
  useEffect(() => {
    if (isOpen) {
      // For WebView/APK, use file input fallback
      if (isWebView) {
        console.log('📱 WebView detected, using file input fallback')
        setUseFileInput(true)
        setIsLoading(false)
        return
      }
      
      // Request fullscreen on mobile for better UX
      if (isMobile && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // Ignore fullscreen errors
        })
      }
      
      // Wait a bit for the video element to be rendered
      const timer = setTimeout(() => {
        if (videoRef.current) {
          startCamera()
        } else {
          console.warn('Video element not ready, retrying...')
          // Retry after a short delay
          setTimeout(() => {
            if (videoRef.current) {
              startCamera()
            } else {
              console.error('Video element still not available')
              setError(new Error('Video element not available'))
              setIsLoading(false)
            }
          }, 100)
        }
      }, 50)

      return () => {
        clearTimeout(timer)
        stopCamera()
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {
            // Ignore fullscreen errors
          })
        }
      }
    } else {
      stopCamera()
      setUseFileInput(false)
      // Exit fullscreen when closing
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
        setStream(null)
      }

      // Check if running on HTTPS or localhost (required for camera access)
      const isSecureContext = window.isSecureContext || 
                               location.protocol === 'https:' || 
                               location.hostname === 'localhost' || 
                               location.hostname === '127.0.0.1'
      
      if (!isSecureContext) {
        throw new Error('Camera requires HTTPS connection (or localhost)')
      }

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Try legacy API for older browsers
        const getUserMedia = navigator.mediaDevices?.getUserMedia || 
                            navigator.getUserMedia || 
                            navigator.webkitGetUserMedia || 
                            navigator.mozGetUserMedia || 
                            navigator.msGetUserMedia
        
        if (!getUserMedia) {
          throw new Error('Camera API not supported in this browser')
        }
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

      console.log('Requesting camera access with constraints:', constraints)
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log('Camera stream obtained:', mediaStream)

      setStream(mediaStream)
      
      // Wait for video element to be available
      let retries = 0
      const maxRetries = 10
      while (!videoRef.current && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
      }
      
      if (videoRef.current) {
        const video = videoRef.current
        console.log('Setting video srcObject')
        video.srcObject = mediaStream
        
        // Wait for video to be ready and play
        await new Promise((resolve, reject) => {
          if (!video) {
            reject(new Error('Video element not available'))
            return
          }
          
          let resolved = false
          
          const handleLoadedMetadata = () => {
            if (resolved) return
            console.log('Video metadata loaded, attempting to play...')
            video.play()
              .then(() => {
                console.log('✅ Video playing successfully')
                resolved = true
                resolve()
              })
              .catch((playError) => {
                console.warn('⚠️ Play promise rejected, but video might still work:', playError)
                // Check if video is actually playing
                setTimeout(() => {
                  if (video.readyState >= 2 && !video.paused) {
                    console.log('✅ Video is playing despite promise rejection')
                    resolved = true
                    resolve()
                  } else {
                    console.error('❌ Video failed to play')
                    if (!resolved) {
                      resolved = true
                      reject(playError)
                    }
                  }
                }, 500)
              })
          }

          const handleCanPlay = () => {
            if (resolved) return
            console.log('Video can play, ensuring it plays...')
            if (video.paused) {
              video.play().catch(err => {
                console.warn('Play on canplay failed:', err)
              })
            }
          }

          const handleError = (e) => {
            console.error('❌ Video element error:', e)
            if (!resolved) {
              resolved = true
              reject(new Error('Video failed to load'))
            }
          }

          // Set up event listeners
          video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
          video.addEventListener('canplay', handleCanPlay, { once: true })
          video.addEventListener('error', handleError, { once: true })
          
          // Fallback timeout - if video is ready, try to play
          setTimeout(() => {
            if (!resolved && video.readyState >= 2) {
              console.log('Fallback: Video ready, attempting play...')
              video.play()
                .then(() => {
                  console.log('✅ Video playing via fallback')
                  resolved = true
                  resolve()
                })
                .catch(() => {
                  // If video has data, consider it resolved
                  if (video.readyState >= 2) {
                    console.log('Video has data, considering ready')
                    resolved = true
                    resolve()
                  } else if (!resolved) {
                    resolved = true
                    reject(new Error('Video timeout'))
                  }
                })
            } else if (!resolved) {
              console.warn('Video not ready after timeout')
              if (video.readyState >= 1) {
                // Video is loading, give it more time
                resolved = true
                resolve()
              } else {
                resolved = true
                reject(new Error('Video timeout - not loading'))
              }
            }
          }, 5000)
        })
      } else {
        console.warn('⚠️ Video ref not available when setting stream')
      }
      
      setIsLoading(false)
      setError(null)
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
            videoRef.current.play().catch(() => {})
          }
          setIsLoading(false)
          setError(null)
          return
        } catch (fallbackError) {
          console.error('Fallback camera access failed:', fallbackError)
          // If getUserMedia fails, fall back to file input for APK
          console.log('📱 Falling back to file input method')
          setUseFileInput(true)
          setIsLoading(false)
          setError(null)
          return
        }
      } else {
        // For other errors, try file input fallback
        console.log('📱 getUserMedia failed, falling back to file input method')
        setUseFileInput(true)
        setIsLoading(false)
        setError(null)
        return
      }
      
      toast.error(errorMessage)
      // Don't close immediately, let user see the error
    }
  }
  
  // Handle file input for APK/WebView fallback
  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    
    // Read file as base64
    const reader = new FileReader()
    reader.onloadend = () => {
      onCapture(reader.result)
      onClose()
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
    }
    reader.readAsDataURL(file)
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  const handleCameraButtonClick = () => {
    if (useFileInput && fileInputRef.current) {
      fileInputRef.current.click()
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

  // If using file input fallback (APK/WebView)
  if (useFileInput) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center">
        <div className="relative w-full h-full flex flex-col items-center justify-center p-6">
          <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-semibold">Take Photo</h2>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300 transition-colors text-3xl leading-none w-10 h-10 flex items-center justify-center"
                aria-label="Close camera"
              >
                ×
              </button>
            </div>
            
            <div className="flex flex-col items-center gap-6">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              
              <p className="text-gray-300 text-center">
                Tap the button below to open your camera
              </p>
              
              <button
                onClick={handleCameraButtonClick}
                className="w-full px-6 py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all font-medium shadow-lg"
              >
                Open Camera
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

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

        {/* Video Preview - Always render video element when modal is open */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          {/* Always render video element so ref is available */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isLoading || error ? 'opacity-0' : 'opacity-100'}`}
            style={{
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              WebkitTransform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.play().catch(err => {
                  console.error('Auto-play prevented:', err)
                })
              }
            }}
            onCanPlay={() => {
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current.play().catch(err => {
                  console.error('Play error:', err)
                })
              }
            }}
          />
          
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white">Starting camera...</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/90">
              <div className="text-center p-6 max-w-md">
                <div className="mb-4">
                  <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-red-400 mb-2 font-semibold">{error.message || 'Camera error occurred'}</p>
                  {error.name && (
                    <p className="text-gray-400 text-sm">Error: {error.name}</p>
                  )}
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={startCamera}
                    className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => {
                      stopCamera()
                      onClose()
                    }}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
            
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

        {/* Hidden canvas for capturing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}

export default CameraModal

