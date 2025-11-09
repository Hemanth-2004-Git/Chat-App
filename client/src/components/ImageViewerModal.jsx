import React, { useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

const ImageViewerModal = ({ isOpen, onClose, imageUrl, imageName = 'image' }) => {
  // Detect if running on mobile device or in WebView/APK
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  const isWebView = window.navigator.standalone || 
                    window.matchMedia('(display-mode: standalone)').matches ||
                    /wv|WebView/i.test(navigator.userAgent) ||
                    (!window.chrome && /Android/i.test(navigator.userAgent))
  
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
      // Extract filename from URL if not provided
      let filename = imageName
      if (!filename || filename === 'image') {
        // Try to extract filename from URL
        const urlParts = imageUrl.split('/')
        const lastPart = urlParts[urlParts.length - 1]
        // Remove query parameters
        const filenameFromUrl = lastPart.split('?')[0]
        
        // Check if it has an extension
        if (filenameFromUrl.includes('.')) {
          filename = filenameFromUrl
        } else {
          // Default to jpg if no extension found
          filename = `image-${Date.now()}.jpg`
        }
      }
      
      // For Android APK/WebView, use a more reliable method
      if (isWebView && /Android/i.test(navigator.userAgent)) {
        // For Android WebView, try multiple methods
        try {
          // Method 1: Try canvas approach first (most reliable for WebView)
          const img = new Image()
          img.crossOrigin = 'anonymous'
          
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 15000)
            
            img.onload = () => {
              clearTimeout(timeout)
              try {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth
                canvas.height = img.naturalHeight
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0)
                
                // Convert to data URI
                const dataUri = canvas.toDataURL('image/jpeg', 0.95)
                
                // Try method 1: Direct download with data URI
                try {
                  const link = document.createElement('a')
                  link.href = dataUri
                  link.download = filename
                  link.style.display = 'none'
                  document.body.appendChild(link)
                  
                  // Use both click and programmatic trigger
                  setTimeout(() => {
                    link.click()
                    // Also try dispatching a click event
                    const clickEvent = new MouseEvent('click', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    })
                    link.dispatchEvent(clickEvent)
                  }, 100)
                  
                  setTimeout(() => {
                    try {
                      document.body.removeChild(link)
                    } catch (e) {}
                  }, 2000)
                  
                  toast.success('Downloading image...')
                  resolve()
                } catch (linkError) {
                  // Method 2: Open in new window with data URI
                  console.log('Direct download failed, opening in new window...', linkError)
                  const newWindow = window.open('', '_blank')
                  if (newWindow) {
                    newWindow.document.write(`
                      <html>
                        <head><title>${filename}</title></head>
                        <body style="margin:0;padding:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;">
                          <img src="${dataUri}" style="max-width:100%;max-height:100%;object-fit:contain;" />
                          <script>
                            setTimeout(() => {
                              const link = document.createElement('a');
                              link.href = '${dataUri}';
                              link.download = '${filename}';
                              link.click();
                            }, 500);
                          </script>
                        </body>
                      </html>
                    `)
                    toast.success('Image opened. Long press to save.')
                    resolve()
                  } else {
                    throw new Error('Popup blocked')
                  }
                }
              } catch (error) {
                reject(error)
              }
            }
            
            img.onerror = () => {
              clearTimeout(timeout)
              reject(new Error('Failed to load image'))
            }
            
            img.src = imageUrl
          })
        } catch (error) {
          console.log('All methods failed, opening original URL...', error)
          // Final fallback: open original URL
          window.open(imageUrl, '_blank')
          toast.success('Image opened. Long press to save to gallery.')
        }
      } else {
        // For other platforms (desktop, iOS, regular mobile browsers)
        let blob
        try {
          const response = await fetch(imageUrl, {
            mode: 'cors',
            credentials: 'omit'
          })
          
          if (!response.ok) {
            throw new Error('Failed to fetch image')
          }
          
          blob = await response.blob()
        } catch (fetchError) {
          // If direct fetch fails, use canvas method
          console.log('Direct fetch failed, trying canvas method...', fetchError)
          
          const img = new Image()
          img.crossOrigin = 'anonymous'
          
          blob = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Image load timeout'))
            }, 10000)
            
            img.onload = () => {
              clearTimeout(timeout)
              try {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth
                canvas.height = img.naturalHeight
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0)
                
                canvas.toBlob((canvasBlob) => {
                  if (canvasBlob) {
                    resolve(canvasBlob)
                  } else {
                    reject(new Error('Failed to convert canvas to blob'))
                  }
                }, 'image/jpeg', 0.95)
              } catch (error) {
                reject(error)
              }
            }
            
            img.onerror = () => {
              clearTimeout(timeout)
              reject(new Error('Failed to load image'))
            }
            
            img.src = imageUrl
          })
        }
        
        // Create download link
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.style.display = 'none'
        document.body.appendChild(link)
        link.click()
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
        }, 100)
        
        toast.success('Image downloaded successfully!')
      }
    } catch (error) {
      console.error('Error downloading image:', error)
      toast.error('Failed to download. Opening in new tab...')
      // Final fallback: open in new tab
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

