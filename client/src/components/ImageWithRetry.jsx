import React, { useState, useEffect, useRef } from 'react';

/**
 * Image component with automatic retry for Render API URLs
 * Handles Ready Player Me Render API which generates images on-demand
 */
const ImageWithRetry = ({ src, alt, className, fallbackSrc, maxRetries = 3, retryDelay = 2000, ...props }) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);

  const isRenderAPI = src && (src.includes('render.readyplayer.me') || src.includes('api.readyplayer.me/v2/avatars') || src.includes('thumbnails.readyplayer.me'));

  useEffect(() => {
    // Reset state when src changes
    setImageSrc(src);
    setIsLoading(true);
    setHasError(false);
    retryCountRef.current = 0;

    // Clear any pending retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    retryCountRef.current = 0;
    // Clear any pending retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const handleError = (e) => {
    const img = e.target;

    // If it's a Render API URL and we haven't exceeded retries, try alternatives
    if (isRenderAPI && retryCountRef.current < maxRetries) {
      retryCountRef.current += 1;
      console.log(`⚠️ Render API image failed, retrying (${retryCountRef.current}/${maxRetries}):`, src);
      
      // Try alternative URL after 2 failed attempts
      if (retryCountRef.current >= 2) {
        let alternativeUrl = null;
        
        // If thumbnail service failed, try Render API
        if (src.includes('thumbnails.readyplayer.me')) {
          const avatarIdMatch = src.match(/thumbnails\.readyplayer\.me\/([^\/]+)\.png/i);
          if (avatarIdMatch && avatarIdMatch[1]) {
            const avatarId = avatarIdMatch[1].split('.')[0];
            alternativeUrl = `https://render.readyplayer.me/render?scene=halfbody-portrait-v1&character=${avatarId}`;
            console.log(`🔄 Switching to Render API: ${alternativeUrl}`);
          }
        }
        // If Render API failed, try thumbnail service
        else if (src.includes('render.readyplayer.me')) {
          const avatarIdMatch = src.match(/character=([^&]+)/i);
          if (avatarIdMatch && avatarIdMatch[1]) {
            const avatarId = avatarIdMatch[1];
            alternativeUrl = `https://thumbnails.readyplayer.me/${avatarId}.png`;
            console.log(`🔄 Switching to thumbnail service: ${alternativeUrl}`);
          }
        }
        
        if (alternativeUrl) {
          retryTimeoutRef.current = setTimeout(() => {
            setImageSrc(alternativeUrl);
            setIsLoading(true);
          }, retryDelay);
          return;
        }
      }
      
      // Standard retry with cache-busting
      const separator = src.includes('?') ? '&' : '?';
      const retryUrl = `${src}${separator}_retry=${retryCountRef.current}&_t=${Date.now()}`;
      
      retryTimeoutRef.current = setTimeout(() => {
        setImageSrc(retryUrl);
        setIsLoading(true);
      }, retryDelay);
    } else {
      // Max retries exceeded or not Render API, use fallback immediately
      setIsLoading(false);
      setHasError(true);
      if (fallbackSrc && img.src !== fallbackSrc) {
        img.onerror = null; // Prevent infinite loop
        img.src = fallbackSrc;
        console.log('✅ Using fallback image:', fallbackSrc);
      } else {
        console.error('❌ Image failed to load after retries:', src);
      }
    }
  };

  // Show loading placeholder while loading Render API images
  if (isLoading && isRenderAPI && !hasError) {
    return (
      <div className={`${className} relative flex items-center justify-center bg-gray-800/50`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <img
          src={imageSrc}
          alt={alt}
          className="opacity-0"
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
};

export default ImageWithRetry;

