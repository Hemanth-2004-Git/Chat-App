import React, { Suspense, useState, useRef, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Error boundary component for 3D models
function ErrorBoundary3D({ children, onError }) {
  return <>{children}</>;
}

// GLB loader component
function AvatarModel({ url }) {
  const { scene } = useGLTF(url);
  const meshRef = useRef();

  // Clone the scene to avoid sharing between instances
  const clonedScene = useMemo(() => {
    try {
      return scene.clone();
    } catch (error) {
      console.error('Error cloning scene:', error);
      return scene;
    }
  }, [scene]);

  // Calculate bounding box and position the model correctly
  useEffect(() => {
    if (!clonedScene) return;

    // Calculate bounding box for the entire scene
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Get the maximum dimension for scaling
    const maxDim = Math.max(size.x, size.y, size.z);
    // Scale to fit comfortably with padding
    const scale = 1.5 / maxDim;
    
    // Apply uniform scale first
    clonedScene.scale.set(scale, scale, scale);
    
    // Recalculate bounding box after scaling
    const scaledBox = new THREE.Box3().setFromObject(clonedScene);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    
    // Position model: Ready Player Me recommended positioning for full body display
    // Center avatar at (0, -1.4, 0) for proper head-to-toe framing
    clonedScene.position.x = -scaledCenter.x;
    clonedScene.position.y = -scaledCenter.y - 1.4; // Recommended: -1.4 for full body
    clonedScene.position.z = -scaledCenter.z;

    // Set up materials and geometry
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Ensure proper material rendering
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.needsUpdate = true;
              // Fix potential precision issues in materials
              if (mat.emissive) mat.emissive.convertSRGBToLinear();
              if (mat.color) mat.color.convertSRGBToLinear();
            });
          } else {
            child.material.needsUpdate = true;
            // Fix potential precision issues in materials
            if (child.material.emissive) child.material.emissive.convertSRGBToLinear();
            if (child.material.color) child.material.color.convertSRGBToLinear();
          }
        }
        
        // Ensure geometry is properly normalized
        if (child.geometry) {
          child.geometry.computeBoundingBox();
          child.geometry.computeBoundingSphere();
        }
      }
    });
  }, [clonedScene]);

  return (
    <primitive 
      object={clonedScene} 
      ref={meshRef}
    />
  );
}

// Loading fallback
function LoadingSpinner() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}

const Avatar3DViewer = ({ glbUrl, className = '', style = {}, onError = () => {} }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Handle onError callback
  const handleErrorCallback = (error) => {
    if (onError && typeof onError === 'function') {
      try {
        onError(error);
      } catch (e) {
        // Ignore callback errors
      }
    }
  };

  // Extract avatar ID from GLB URL if needed
  const getGLBUrl = () => {
    if (!glbUrl) return null;
    
    // If it's already a GLB URL, use it
    if (glbUrl.includes('.glb')) {
      return glbUrl;
    }
    
    // If it's a Render API or Avatar API URL, try to extract avatar ID and convert to GLB
    const avatarIdMatch = glbUrl.match(/character=([^&]+)/) || 
                         glbUrl.match(/avatars\/([^\/]+)/) ||
                         glbUrl.match(/thumbnails\.readyplayer\.me\/([^\/]+)/);
    
    if (avatarIdMatch && avatarIdMatch[1]) {
      const avatarId = avatarIdMatch[1].split('.')[0]; // Remove .png if present
      return `https://models.readyplayer.me/${avatarId}.glb`;
    }
    
    return null;
  };

  const modelUrl = getGLBUrl();

  const handleError = (error) => {
    console.error('3D Model loading error:', error);
    setHasError(true);
    setIsLoading(false);
    handleErrorCallback(error);
  };
  
  // Monitor model loading
  useEffect(() => {
    if (modelUrl && !hasError) {
      // Set loading timeout
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.log('⏰ Model loading timeout');
        }
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [modelUrl, hasError, isLoading]);

  if (!modelUrl || hasError) {
    return (
      <div className={`${className} flex items-center justify-center`} style={style}>
        <div className="text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <p className="text-xs">3D Model unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden`} style={style}>
      <Canvas
        camera={{ position: [0, 1.5, 3], fov: 50 }}
        onCreated={({ gl, camera, scene }) => {
          setIsLoading(false);
          
          // Suppress Three.js WebGL shader precision warnings (harmless but noisy)
          const originalError = console.error;
          const originalWarn = console.warn;
          
          const filterWebGLWarnings = (...args) => {
            const message = args.join(' ');
            // Filter out Three.js WebGL shader precision warnings
            if (
              message.includes('THREE.WebGLProgram') ||
              message.includes('Program Info Log') ||
              message.includes('warning X4122') ||
              message.includes('warning X4008') ||
              message.includes('cannot be represented accurately') ||
              message.includes('floating point division by zero') ||
              message.includes('sum of') ||
              message.includes('double precision')
            ) {
              return false; // Suppress these warnings
            }
            return true; // Allow other warnings
          };
          
          // Override console methods to filter warnings
          const warnInterceptor = (...args) => {
            if (filterWebGLWarnings(...args)) {
              originalWarn.apply(console, args);
            }
          };
          
          const errorInterceptor = (...args) => {
            if (filterWebGLWarnings(...args)) {
              originalError.apply(console, args);
            }
          };
          
          console.warn = warnInterceptor;
          console.error = errorInterceptor;
        }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance",
          precision: "highp"
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={<LoadingSpinner />}>
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
          <pointLight position={[-5, -5, -5]} intensity={0.5} />
          
          {/* Environment for reflections */}
          <Environment preset="city" />
          
          {/* Avatar Model */}
          <AvatarModel url={modelUrl} />
          
          {/* Controls for rotation */}
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 8}
            maxPolarAngle={Math.PI / 1.8}
            minAzimuthAngle={-Math.PI}
            maxAzimuthAngle={Math.PI}
            target={[0, 1.3, 0]}
            autoRotate
            autoRotateSpeed={0.8}
          />
        </Suspense>
      </Canvas>
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-300 text-sm">Loading 3D model...</p>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default Avatar3DViewer;

