import React, { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

// Ready Player Me Configuration
// For production: Set VITE_READY_PLAYER_ME_SUBDOMAIN in your .env file
// For demo/testing: Uses 'demo' subdomain (no API key needed)
const READY_PLAYER_ME_SUBDOMAIN = import.meta.env.VITE_READY_PLAYER_ME_SUBDOMAIN || 'demo'

const AvatarCreator = ({ isOpen, onClose, onSave, currentProfilePic }) => {
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarUrlGLB, setAvatarUrlGLB] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const iframeRef = useRef(null)
  const [iframeKey, setIframeKey] = useState(0)
  // Use ref to persist URL even during re-renders
  const avatarUrlRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      // Only reset when closing, not when opening
      setAvatarUrl(null)
      setAvatarUrlGLB(null)
      avatarUrlRef.current = null
      setIsLoading(true)
      return
    }

    // Reset iframe when opening (but preserve avatarUrl if it exists)
    setIframeKey(prev => prev + 1)
    setIsLoading(true)
    console.log('🔄 AvatarCreator opened, current avatarUrl:', avatarUrl)
    console.log('🔄 AvatarCreator opened, avatarUrlRef.current:', avatarUrlRef.current)
  }, [isOpen])

  // Function to try extracting avatar URL (can be called manually)
  const tryExtractAvatarFromIframe = React.useCallback(() => {
    if (iframeRef.current && !avatarUrl) {
      try {
        const iframe = iframeRef.current
        const iframeWindow = iframe.contentWindow
        
        // Try to access iframe's location or data
        if (iframeWindow) {
          // Try postMessage to request avatar URL
          try {
            iframeWindow.postMessage({ 
              type: 'get-avatar-url',
              source: 'parent' 
            }, '*')
          } catch (e) {
            // Might fail due to CORS
          }

          // Try to find URL in iframe's window object
          try {
            if (iframeWindow.avatarUrl || iframeWindow.currentAvatarUrl) {
              const url = iframeWindow.avatarUrl || iframeWindow.currentAvatarUrl
              if (url && url.startsWith('http')) {
                console.log('✅ Found avatar URL in iframe window:', url)
                setAvatarUrl(url)
                setIsLoading(false)
                return
              }
            }
          } catch (e) {
            // CORS might block this
          }

          // Try to access iframe document (might be blocked by CORS)
          try {
            const iframeDoc = iframe.contentDocument || iframeWindow.document
            if (iframeDoc) {
              // Look for images with avatar URLs
              const images = iframeDoc.querySelectorAll('img')
              images.forEach(img => {
                const src = img.src || img.getAttribute('src')
                if (src && src.includes('readyplayer.me') && !src.includes('.glb') && src.match(/\.(png|jpg|jpeg)$/i)) {
                  console.log('✅ Found avatar image in iframe DOM:', src)
                  if (!avatarUrl) {
                    setAvatarUrl(src)
                    setIsLoading(false)
                    toast.success('Avatar detected!')
                  }
                }
              })

              // Look for canvas elements that might contain the avatar
              const canvases = iframeDoc.querySelectorAll('canvas')
              canvases.forEach(canvas => {
                try {
                  const dataUrl = canvas.toDataURL('image/png')
                  if (dataUrl && dataUrl !== 'data:,') {
                    console.log('✅ Found canvas with avatar data')
                    // We could use dataUrl but Ready Player Me URL is better
                  }
                } catch (e) {
                  // Canvas might be tainted
                }
              })
            }
          } catch (e) {
            // CORS will block this, that's expected
          }
        }
      } catch (e) {
        // Expected to fail due to CORS in many cases
      }
    }
  }, [avatarUrl])

  useEffect(() => {
    if (!isOpen) return

    // Suppress harmless Ready Player Me API errors (403, etc.) that come from the iframe
    const originalError = console.error
    const originalWarn = console.warn
    
    const filterRPMErrors = (...args) => {
      const message = args.join(' ')
      // Filter out Ready Player Me API errors that are harmless
      if (
        message.includes('api.readyplayer.me/v2/avatars') ||
        message.includes('[403]') ||
        message.includes('[ForbiddenError]') ||
        message.includes('Forbidden') ||
        message.includes('sentry.io/api') ||
        message.includes('429') ||
        message.includes('Too Many Requests') ||
        message.includes('error id:') ||
        message.includes('isUnhandledError') ||
        message.includes('__sentry_captured__')
      ) {
        return false // Suppress these errors
      }
      return true // Allow other errors
    }
    
    console.error = (...args) => {
      if (filterRPMErrors(...args)) {
        originalError.apply(console, args)
      }
    }
    
    console.warn = (...args) => {
      if (filterRPMErrors(...args)) {
        originalWarn.apply(console, args)
      }
    }

    // Listen for messages from Ready Player Me iframe
    const handleMessage = (event) => {
      try {
        // Accept messages from Ready Player Me domains
        const validOrigins = [
          'readyplayer.me',
          'models.readyplayer.me',
          'demo.readyplayer.me',
          'chatapp-t8bhfc.readyplayer.me',
          'app.readyplayer.me',
          'https://demo.readyplayer.me',
          'https://chatapp-t8bhfc.readyplayer.me'
        ]
        
        const isValidOrigin = validOrigins.some(origin => 
          event.origin.includes(origin.replace('https://', '')) || 
          event.origin === origin
        )
        
        // Log ALL messages for debugging
        if (event.data && typeof event.data === 'object') {
          console.log('📨 Message received from:', event.origin, 'Data:', JSON.stringify(event.data, null, 2))
        }

        if (!isValidOrigin) {
          return
        }

        // Handle different message formats
        const data = event.data
        if (!data) return

        // Check for Ready Player Me message format
        // Official format: data.source === 'readyplayerme' OR just check eventName directly
        // RPM can send messages with or without source field
        const isReadyPlayerMeMessage = data.source === 'readyplayerme' || 
                                       data.source === 'readyplayer-me' ||
                                       data.eventName?.startsWith('v1.') ||
                                       data.eventName?.includes('avatar') ||
                                       data.eventName?.includes('frame') ||
                                       data.eventName?.includes('user')
        
        if (isReadyPlayerMeMessage) {
          console.log('✅ Ready Player Me message received:', data)

          // Handle avatar exported event
          if (data.eventName === 'v1.avatar.exported' || data.eventName === 'avatar.exported') {
            const avatarData = data.data || data
            
            // First, try to get PNG/image URLs directly (preferred)
            let url = avatarData?.urlPNG || avatarData?.pngUrl || avatarData?.thumbnailUrl || 
                     avatarData?.imageUrl || avatarData?.urlImage ||
                     avatarData?.urlHalfBody || avatarData?.halfBodyUrl ||
                     avatarData?.urlFullBody || avatarData?.fullBodyUrl ||
                     avatarData?.url
            
            // Try different URL formats and properties
            if (!url && avatarData) {
              // Check all possible properties
              const possibleKeys = Object.keys(avatarData).filter(key => 
                key.toLowerCase().includes('png') || 
                key.toLowerCase().includes('image') || 
                key.toLowerCase().includes('thumbnail') ||
                key.toLowerCase().includes('halfbody') ||
                key.toLowerCase().includes('fullbody')
              )
              if (possibleKeys.length > 0) {
                url = avatarData[possibleKeys[0]]
                console.log('✅ Found image URL in avatar data:', possibleKeys[0], url)
              }
            }
            
            // If we got a GLB URL, store it and try to get image URL from Ready Player Me
            if (url && typeof url === 'string' && url.includes('.glb')) {
              const avatarIdMatch = url.match(/models\.readyplayer\.me\/([^\/]+)\.glb/i)
              if (avatarIdMatch && avatarIdMatch[1]) {
                const avatarId = avatarIdMatch[1]
                // Store GLB URL for 3D viewing
                const glbUrl = url
                setAvatarUrlGLB(glbUrl)
                // Try Ready Player Me thumbnail service for 2D preview
                url = `https://thumbnails.readyplayer.me/${avatarId}.png`
                console.log('✅ Converted GLB to thumbnail service:', url)
                console.log('📦 GLB URL stored for 3D viewer:', glbUrl)
              } else {
                // Try to extract ID from any format
                const idMatch = url.match(/\/([a-f0-9]{24,})\.glb/i)
                if (idMatch && idMatch[1]) {
                  url = `https://thumbnails.readyplayer.me/${idMatch[1]}.png`
                } else {
                  // Keep GLB URL as fallback
                  console.log('⚠️ Keeping GLB URL for exported event:', url)
                }
              }
            }
            
            if (url && typeof url === 'string' && url.startsWith('http') && !url.includes('.glb')) {
              console.log('✅ Avatar URL received from exported event:', url)
              
              // Use functional update
              avatarUrlRef.current = url // Store in ref
              setAvatarUrl(prev => {
                if (prev !== url) {
                  console.log('🔄 Setting avatarUrl from exported event:', url.substring(0, 50) + '...')
                  return url
                }
                return prev
              })
              
              if (avatarData.urlGLB) {
                setAvatarUrlGLB(avatarData.urlGLB)
              }
              setIsLoading(false)
              toast.success('Avatar created successfully!')
              return
            }
          }

          // Handle frame ready
          if (data.eventName === 'v1.frame.ready' || data.eventName === 'frame.ready') {
            console.log('✅ Ready Player Me iframe is ready')
            setIsLoading(false)
          }

          // Handle user set
          if (data.eventName === 'v1.user.set' || data.eventName === 'user.set') {
            console.log('✅ Ready Player Me user set')
            setIsLoading(false)
          }

          // Handle avatar created/generated events
          if (data.eventName === 'v1.avatar.created' || 
              data.eventName === 'v1.avatar.generated' ||
              data.eventName === 'avatar.created' ||
              data.eventName === 'avatar.generated') {
            const avatarData = data.data || data
            let url = avatarData?.url || avatarData?.urlFullBody || avatarData?.urlHalfBody || avatarData?.urlPNG || avatarData?.pngUrl
            
            if (!url && avatarData) {
              url = avatarData.url || avatarData.fullBodyUrl || avatarData.halfBodyUrl || avatarData.pngUrl
            }
            
            // If we got a GLB URL, store it and convert to thumbnail for preview
            if (url && typeof url === 'string' && url.includes('.glb')) {
              const avatarIdMatch = url.match(/models\.readyplayer\.me\/([^\/]+)\.glb/i)
              if (avatarIdMatch && avatarIdMatch[1]) {
                  const avatarId = avatarIdMatch[1]
                  // Store GLB URL for 3D viewing
                  const glbUrl = url
                  setAvatarUrlGLB(glbUrl)
                  // Try Ready Player Me thumbnail service for 2D preview
                  url = `https://thumbnails.readyplayer.me/${avatarId}.png`
                console.log('✅ Converted GLB to thumbnail service for created event:', url)
                console.log('📦 GLB URL stored:', glbUrl)
              } else {
                // Try to extract ID from any format
                const idMatch = url.match(/\/([a-f0-9]{24,})\.glb/i)
                if (idMatch && idMatch[1]) {
                  const glbUrl = url
                  setAvatarUrlGLB(glbUrl)
                  url = `https://thumbnails.readyplayer.me/${idMatch[1]}.png`
                  console.log('📦 GLB URL stored for created event:', glbUrl)
                } else {
                  // Keep GLB URL as fallback
                  if (url.includes('.glb')) {
                    setAvatarUrlGLB(url)
                  }
                  console.log('⚠️ Keeping GLB URL for created event:', url)
                }
              }
            }
            
            if (url && typeof url === 'string' && url.startsWith('http') && !url.includes('.glb')) {
              console.log('✅ Avatar created/generated:', url)
              
              // Use functional update
              avatarUrlRef.current = url // Store in ref
              setAvatarUrl(prev => {
                if (prev !== url) {
                  console.log('🔄 Setting avatarUrl from created event:', url.substring(0, 50) + '...')
                  return url
                }
                return prev
              })
              
              setIsLoading(false)
              toast.success('Avatar created successfully!')
              return
            }
          }
        }

        // Alternative message formats
        if (data.type === 'rpm-avatar-export' || data.type === 'avatar-export') {
          const url = data.url || data.avatarUrl
          if (url && typeof url === 'string' && url.startsWith('http')) {
            console.log('✅ Avatar exported (alternative format):', url)
            
            // Use functional update
            avatarUrlRef.current = url // Store in ref
            setAvatarUrl(prev => {
              if (prev !== url) {
                console.log('🔄 Setting avatarUrl from alternative format:', url.substring(0, 50) + '...')
                return url
              }
              return prev
            })
            
            setIsLoading(false)
            toast.success('Avatar created successfully!')
            return
          }
        }

        // Handle direct URL in message (any format)
        if (data.avatarUrl || (data.url && typeof data.url === 'string' && data.url.includes('readyplayer.me'))) {
          const url = data.avatarUrl || data.url
          if (url && url.startsWith('http')) {
            console.log('✅ Direct avatar URL in message:', url)
            
            // Use functional update
            avatarUrlRef.current = url // Store in ref
            setAvatarUrl(prev => {
              if (prev !== url) {
                console.log('🔄 Setting avatarUrl from direct URL:', url.substring(0, 50) + '...')
                return url
              }
              return prev
            })
            
            setIsLoading(false)
            toast.success('Avatar created successfully!')
            return
          }
        }

        // Check if data contains URL anywhere (including GLB - we'll convert to PNG)
        const dataString = JSON.stringify(data)
        const urlMatch = dataString.match(/https?:\/\/[^\s"']+\.readyplayer\.me[^\s"']*\.(png|jpg|jpeg|glb)/gi)
        if (urlMatch && urlMatch.length > 0) {
          // Prefer PNG/JPG URLs first
          let foundUrl = urlMatch.find(url => !url.includes('.glb') && (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg')))
          
          // If only GLB found, convert it to PNG URL
          if (!foundUrl) {
            const glbUrl = urlMatch.find(url => url.includes('.glb'))
            if (glbUrl) {
              // Extract avatar ID from GLB URL and use Render API for image
              // Ready Player Me uses Render API to generate images on-demand
              const avatarIdMatch = glbUrl.match(/models\.readyplayer\.me\/([^\/]+)\.glb/i)
              if (avatarIdMatch && avatarIdMatch[1]) {
                const avatarId = avatarIdMatch[1]
                // Try Ready Player Me thumbnail service
                foundUrl = `https://thumbnails.readyplayer.me/${avatarId}.png`
                console.log('✅ Converted GLB URL to thumbnail service:', glbUrl, '->', foundUrl)
              } else {
                // Fallback: try to extract ID from any format
                const idMatch = glbUrl.match(/\/([a-f0-9]{24,})\.glb/i)
                if (idMatch && idMatch[1]) {
                  foundUrl = `https://thumbnails.readyplayer.me/${idMatch[1]}.png`
                  console.log('✅ Converted GLB URL to thumbnail service (fallback):', foundUrl)
                } else {
                  // Last resort: try to extract from URL directly
                  const urlMatch = glbUrl.match(/\/([a-f0-9]{24,})\.glb/i)
                  if (urlMatch && urlMatch[1]) {
                    foundUrl = `https://thumbnails.readyplayer.me/${urlMatch[1]}.png`
                  } else {
                    // Keep original GLB URL - might work with some browsers/services
                    foundUrl = glbUrl
                    console.log('⚠️ Keeping original GLB URL:', foundUrl)
                  }
                }
              }
            }
          }
          
          if (foundUrl) {
            console.log('✅ Found avatar URL in message data:', foundUrl)
            console.log('📝 Setting avatarUrl state with URL:', foundUrl.substring(0, 50) + '...')
            
            // Use functional update to ensure state updates correctly
            avatarUrlRef.current = foundUrl // Store in ref first
            setAvatarUrl(prev => {
              if (prev !== foundUrl) {
                console.log('🔄 Updating avatarUrl from:', prev, 'to:', foundUrl.substring(0, 50) + '...')
                console.log('📦 Stored in ref:', avatarUrlRef.current?.substring(0, 50) + '...')
                return foundUrl
              }
              console.log('⚠️ avatarUrl already set, skipping update')
              return prev
            })
            
            setIsLoading(false)
            toast.success('Avatar created successfully!')
            
            // Verify state was set after a moment and force re-render
            setTimeout(() => {
              console.log('🔍 State verification after update:')
              console.log('  - avatarUrlRef.current:', avatarUrlRef.current?.substring(0, 50) + '...')
              // Force a state check by reading from ref and ensure re-render
              if (avatarUrlRef.current && !avatarUrl) {
                console.log('🔄 Force syncing ref to state to trigger re-render')
                setAvatarUrl(avatarUrlRef.current) // Ensure it's set
              }
              // Force a small state update to trigger re-render if needed
              if (avatarUrlRef.current) {
                setAvatarUrl(prev => prev || avatarUrlRef.current)
              }
            }, 200)
          }
        }
      } catch (error) {
        console.error('❌ Error handling avatar message:', error)
      }
    }

    window.addEventListener('message', handleMessage)
    
    // Set up periodic check as fallback (every 1.5 seconds while open and no avatar yet)
    const intervalId = setInterval(() => {
      if (isOpen && !avatarUrl) {
        tryExtractAvatarFromIframe()
      } else if (avatarUrl) {
        clearInterval(intervalId)
      }
    }, 1500)

    return () => {
      window.removeEventListener('message', handleMessage)
      clearInterval(intervalId)
      // Restore original console methods
      console.error = originalError
      console.warn = originalWarn
    }
  }, [isOpen, avatarUrl, tryExtractAvatarFromIframe])

  const handleSave = async () => {
    // Use ref as fallback if state hasn't updated yet
    const urlToSave = avatarUrl || avatarUrlRef.current
    
    console.log('💾 Save button clicked')
    console.log('  - avatarUrl state:', avatarUrl)
    console.log('  - avatarUrlRef.current:', avatarUrlRef.current)
    console.log('  - avatarUrlGLB:', avatarUrlGLB)
    console.log('  - urlToSave:', urlToSave)
    
    if (!urlToSave) {
      toast.error('Please create an avatar first. Make sure to click "NEXT" or "Create Avatar" after customizing.')
      return
    }

    // Validate URL
    if (!urlToSave.startsWith('http://') && !urlToSave.startsWith('https://')) {
      toast.error('Invalid avatar URL. Please create the avatar again.')
      return
    }

    try {
      console.log('💾 Saving avatar:', urlToSave.substring(0, 50) + '...')
      // Ensure state is synced before saving
      if (avatarUrlRef.current && !avatarUrl) {
        console.log('🔄 Syncing ref to state before save')
        setAvatarUrl(avatarUrlRef.current)
      }
      
      // Extract GLB URL - prefer stored GLB URL, otherwise try to construct from image URL
      let finalUrlToSave = urlToSave
      if (avatarUrlGLB) {
        // Use GLB URL directly for 3D viewing
        finalUrlToSave = avatarUrlGLB
        console.log('📦 Using stored GLB URL for 3D viewing:', finalUrlToSave)
      } else if (urlToSave.includes('thumbnails.readyplayer.me') || urlToSave.includes('api.readyplayer.me')) {
        // Extract avatar ID and construct GLB URL
        const avatarIdMatch = urlToSave.match(/thumbnails\.readyplayer\.me\/([^\/]+)/) ||
                            urlToSave.match(/avatars\/([^\/]+)/) ||
                            urlToSave.match(/character=([^&]+)/)
        if (avatarIdMatch && avatarIdMatch[1]) {
          const avatarId = avatarIdMatch[1].split('.')[0]
          finalUrlToSave = `https://models.readyplayer.me/${avatarId}.glb`
          console.log('📦 Constructed GLB URL from image URL:', finalUrlToSave)
        }
      }
      
      // Call the onSave callback with the GLB URL (for 3D viewing)
      await onSave(finalUrlToSave)
      // Don't show success here - let the parent component handle it
      // The toast.success in onSave will be called from ProfilePage
    } catch (error) {
      console.error('Error saving avatar:', error)
      // Don't show error here - parent component will handle it
      // Just rethrow so parent knows it failed
      throw error
    }
  }

  // Debug: Log current state and force re-render if needed
  React.useEffect(() => {
    if (isOpen) {
      const hasStateUrl = !!avatarUrl
      const hasRefUrl = !!avatarUrlRef.current
      const finalUrl = avatarUrl || avatarUrlRef.current
      
      console.log('🔍 AvatarCreator state:', { 
        avatarUrl: avatarUrl ? `${avatarUrl.substring(0, 50)}...` : 'NULL', 
        avatarUrlRef: avatarUrlRef.current ? `${avatarUrlRef.current.substring(0, 50)}...` : 'NULL',
        finalUrl: finalUrl ? `${finalUrl.substring(0, 50)}...` : 'NULL',
        isLoading, 
        isOpen,
        hasAvatarUrl: hasStateUrl,
        hasRefUrl: hasRefUrl,
        avatarUrlLength: avatarUrl?.length || 0
      })
      
      // If ref has URL but state doesn't, sync them
      if (hasRefUrl && !hasStateUrl) {
        console.log('🔄 Syncing ref to state - ref has URL but state is empty')
        setAvatarUrl(avatarUrlRef.current)
      }
      
      // Force UI update check
      if (finalUrl) {
        console.log('✅ Avatar URL confirmed, checking if button is visible...')
        const saveButton = document.getElementById('save-profile-button')
        const saveContainer = document.getElementById('save-button-container')
        if (saveButton) {
          console.log('  - Save button element found')
          console.log('  - Button disabled:', saveButton.disabled)
          console.log('  - Button display:', window.getComputedStyle(saveButton).display)
          console.log('  - Button visibility:', window.getComputedStyle(saveButton).visibility)
          console.log('  - Container display:', saveContainer ? window.getComputedStyle(saveContainer).display : 'not found')
        } else {
          console.warn('⚠️ Save button element not found in DOM!')
        }
      }
    }
  }, [avatarUrl, isLoading, isOpen])

  // Auto-show fallback message if avatarUrl exists but image hasn't loaded after 2 seconds
  React.useEffect(() => {
    if ((avatarUrl || avatarUrlRef.current) && isOpen) {
      const timer = setTimeout(() => {
        const img = document.querySelector('#avatar-preview-image')
        const fallback = document.getElementById('avatar-preview-fallback')
        if (img && img.complete === false && fallback && fallback.style.display === 'none') {
          console.log('⏰ Avatar image taking too long, showing fallback')
          fallback.style.display = 'flex'
          fallback.style.flexDirection = 'column'
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [avatarUrl, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-700/50 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Create 3D Avatar</h2>
              <p className="text-xs text-gray-400">Customize your avatar and save it as your profile picture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Avatar Creator Iframe */}
          <div className="flex-1 relative bg-gray-800/50 min-h-[600px]">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-gray-300">Loading avatar creator...</p>
                  <p className="text-xs text-gray-400 mt-2">This may take a few moments</p>
                </div>
              </div>
            )}
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={`https://${READY_PLAYER_ME_SUBDOMAIN}.readyplayer.me/avatar?frameApi&clearCache=true&utm_source=chat-app`}
              className="w-full h-full border-0"
              title="Avatar Creator"
              allow="camera; microphone; fullscreen; autoplay; encrypted-media; geolocation"
              onLoad={() => {
                // Give it a moment to initialize and set up communication
                setTimeout(() => {
                  setIsLoading(false)
                  console.log('✅ Avatar Creator iframe loaded')
                  
                  // Try to establish communication with iframe
                  if (iframeRef.current?.contentWindow) {
                    try {
                      // Send initialization message
                      iframeRef.current.contentWindow.postMessage(
                        { 
                          type: 'rpm-frame-init', 
                          source: 'parent',
                          eventType: 'avatar-created'
                        },
                        '*'
                      )
                      console.log('✅ Sent init message to Ready Player Me iframe')
                      
                      // Also try requesting avatar URL if available
                      setTimeout(() => {
                        if (iframeRef.current?.contentWindow) {
                          iframeRef.current.contentWindow.postMessage(
                            { 
                              type: 'get-avatar-url',
                              source: 'parent'
                            },
                            '*'
                          )
                        }
                      }, 3000)
                    } catch (e) {
                      console.log('Could not send init message to iframe:', e)
                    }
                  }
                }, 2000)
              }}
              onError={() => {
                setIsLoading(false)
                toast.error('Failed to load avatar creator. Please check your Ready Player Me configuration.')
              }}
              style={{ minHeight: '600px' }}
            />
          </div>

          {/* Preview and Actions Sidebar */}
          <div className="w-full md:w-80 bg-gray-800/30 p-4 border-t md:border-t-0 md:border-l border-gray-700/50 flex flex-col gap-4 overflow-y-auto">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Avatar Preview</h3>
              <div className="bg-gray-900/50 rounded-lg p-4 flex items-center justify-center aspect-square relative min-h-[200px]">
                {(avatarUrl || avatarUrlRef.current) ? (
                  <>
                    {/* Try to load image in background (may fail in demo mode) */}
                    <img
                      id="avatar-preview-image"
                      src={avatarUrl || avatarUrlRef.current}
                      alt="Avatar Preview"
                      className="w-full h-full object-contain rounded-lg"
                      style={{ position: 'absolute', zIndex: 1 }}
                      onLoad={() => {
                        console.log('✅ Avatar preview image loaded successfully')
                        const fallback = document.getElementById('avatar-preview-fallback')
                        if (fallback) {
                          fallback.style.display = 'none'
                        }
                      }}
                      onError={(e) => {
                        // Hide image on error - fallback will show instead
                        e.target.style.display = 'none'
                        console.log('⚠️ Avatar preview image failed to load (expected in demo mode)')
                        
                        // Ensure fallback is visible
                        const fallback = document.getElementById('avatar-preview-fallback')
                        if (fallback) {
                          fallback.style.display = 'flex'
                          fallback.style.flexDirection = 'column'
                          console.log('✅ Showing fallback message')
                        }
                      }}
                    />
                    {/* Fallback message - Always show immediately for Render API URLs in demo mode */}
                    {(avatarUrl || avatarUrlRef.current) && (avatarUrl || avatarUrlRef.current).includes('render.readyplayer.me') && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                        id="avatar-preview-fallback-container"
                      >
                        <div 
                          className="text-center text-white px-4 bg-gradient-to-br from-gray-900/95 to-gray-800/95 rounded-lg py-6 border border-purple-500/30 shadow-lg" 
                          id="avatar-preview-fallback"
                          style={{ display: 'flex', flexDirection: 'column' }}
                        >
                          <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center animate-pulse">
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-base font-semibold text-white mb-1">Avatar Ready to Save!</p>
                          <p className="text-xs mt-1 text-gray-300">Preview unavailable in demo mode</p>
                          <p className="text-xs mt-2 text-green-400 font-medium">✓ Click "Save as Profile Picture" below</p>
                        </div>
                      </div>
                    )}
                    {/* Fallback for other URL types */}
                    {(avatarUrl || avatarUrlRef.current) && !(avatarUrl || avatarUrlRef.current).includes('render.readyplayer.me') && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div 
                          className="text-center text-gray-400 px-4" 
                          id="avatar-preview-fallback-other"
                          style={{ display: 'none' }}
                        >
                          <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <p className="text-sm font-medium text-gray-300">Avatar ready to save</p>
                          <p className="text-xs mt-1 text-gray-500">Preview unavailable in demo mode</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-sm">Create your avatar to see preview</p>
                  </div>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-900/50 rounded-lg p-3 text-xs text-gray-400 space-y-2">
              <p className="font-medium text-gray-300 mb-2">Instructions:</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Customize your avatar (hair, outfit, skin tone, etc.) in the left panel</li>
                <li>Click <strong className="text-white">"NEXT"</strong> or <strong className="text-white">"Create Avatar"</strong> button at the top when finished</li>
                <li>Wait for your avatar preview to appear here</li>
                <li>Click <strong className="text-purple-400">"Save as Profile Picture"</strong> button below to apply</li>
              </ol>
              {!(avatarUrl || avatarUrlRef.current) && (
                <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-700/50 rounded">
                  <p className="text-yellow-400 text-xs flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Complete avatar creation first to enable save button
                  </p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-gray-500 text-xs">
                  Powered by <span className="text-purple-400">Ready Player Me</span>
                </p>
                {READY_PLAYER_ME_SUBDOMAIN === 'demo' && (
                  <p className="text-yellow-400/80 text-xs mt-1">
                    ⚠️ Demo mode - Set up production subdomain for full features
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-auto" style={{ position: 'relative', zIndex: 100 }}>
              {/* Debug info - remove in production */}
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-gray-300 bg-gray-800/80 border border-gray-700 p-2 rounded mb-2" id="avatar-ready-indicator">
                  <div className="font-mono space-y-1">
                    <div>Debug State:</div>
                    <div>avatarUrl state = {avatarUrl ? <span className="text-green-400">✅ EXISTS ({avatarUrl.substring(0, 30)}...)</span> : <span className="text-red-400">❌ NULL</span>}</div>
                    <div>avatarUrlRef = {avatarUrlRef.current ? <span className="text-green-400">✅ EXISTS ({avatarUrlRef.current.substring(0, 30)}...)</span> : <span className="text-red-400">❌ NULL</span>}</div>
                    <div>Final URL = {(avatarUrl || avatarUrlRef.current) ? <span className="text-green-400">✅ EXISTS</span> : <span className="text-red-400">❌ NULL</span>}</div>
                    <div>Button disabled = {!(avatarUrl || avatarUrlRef.current) ? <span className="text-red-400">YES</span> : <span className="text-green-400">NO (CLICKABLE!)</span>}</div>
                    <div>Preview visible = {(avatarUrl || avatarUrlRef.current) ? <span className="text-green-400">YES</span> : <span className="text-red-400">NO</span>}</div>
                  </div>
                </div>
              )}
              
              {/* Manual Capture Button - appears when avatar visible but URL not captured */}
              {!(avatarUrl || avatarUrlRef.current) && (
                <button
                  onClick={() => {
                    // Try to manually capture avatar URL
                    console.log('🔄 Manual avatar capture triggered')
                    tryExtractAvatarFromIframe()
                    
                    // Also try requesting from iframe
                    if (iframeRef.current?.contentWindow) {
                      iframeRef.current.contentWindow.postMessage(
                        { 
                          type: 'get-avatar-url',
                          source: 'parent',
                          action: 'capture'
                        },
                        '*'
                      )
                    }
                    
                    toast.info('Attempting to capture avatar... Check console for details.')
                  }}
                  className="w-full px-4 py-2.5 bg-blue-600/80 text-white rounded-lg hover:bg-blue-600 transition-all font-medium text-sm border border-blue-500/50"
                  title="If you've created your avatar but it's not showing, click this"
                >
                  <svg className="w-4 h-4 inline-block mr-2 align-middle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Capture Avatar (If Created)
                </button>
              )}
              
              {/* Save Button - Always visible, disabled when no avatarUrl */}
              <div className="w-full" id="save-button-container">
              <button
                id="save-profile-button"
                onClick={() => {
                  const urlToCheck = avatarUrl || avatarUrlRef.current
                  console.log('🖱️ Save button clicked')
                  console.log('  - avatarUrl state:', avatarUrl)
                  console.log('  - avatarUrlRef.current:', avatarUrlRef.current)
                  console.log('  - urlToCheck:', urlToCheck)
                  
                  if (!urlToCheck) {
                    console.error('❌ No avatarUrl found in state or ref!')
                    toast.error('Avatar URL not found. Please complete the avatar creation by clicking "NEXT" or "Create Avatar" button.')
                    return
                  }
                  handleSave()
                }}
                disabled={!(avatarUrl || avatarUrlRef.current)}
                className={`w-full px-4 py-3.5 rounded-lg transition-all font-semibold shadow-lg text-base ${
                  (avatarUrl || avatarUrlRef.current)
                    ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700 cursor-pointer active:scale-95 transform'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-60'
                }`}
                style={{ 
                  minHeight: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: (avatarUrl || avatarUrlRef.current) ? 'auto' : 'none',
                  visibility: 'visible',
                  opacity: (avatarUrl || avatarUrlRef.current) ? 1 : 0.6,
                  zIndex: 10
                }}
                title={(avatarUrl || avatarUrlRef.current) ? 'Click to save avatar as your profile picture' : 'Waiting for avatar to be created'}
              >
                {(avatarUrl || avatarUrlRef.current) ? (
                  <>
                    <svg className="w-6 h-6 inline-block mr-2.5 align-middle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-semibold">Save as Profile Picture</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 inline-block mr-2 align-middle animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Waiting for Avatar...</span>
                  </>
                )}
              </button>
                {(avatarUrl || avatarUrlRef.current) && (
                  <div className="mt-2 p-2 bg-green-900/20 border border-green-500/30 rounded text-center">
                    <p className="text-xs text-green-400 font-medium">
                      ✓ Avatar URL captured - Ready to save!
                    </p>
                  </div>
                )}
              </div>
              {(avatarUrl || avatarUrlRef.current) ? (
                <div className="space-y-1">
                  <p className="text-xs text-green-400 text-center font-medium">
                    ✓ Avatar ready! Click above to save as your profile picture.
                  </p>
                  {(avatarUrl || avatarUrlRef.current)?.includes('render.readyplayer.me') && (
                    <p className="text-xs text-yellow-400/80 text-center">
                      ⚠️ Preview may not load in demo mode, but avatar can still be saved
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center">
                  Create and finalize your avatar to enable save button
                </p>
              )}
              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AvatarCreator

