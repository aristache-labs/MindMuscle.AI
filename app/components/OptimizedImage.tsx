import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  ActivityIndicator, 
  StyleSheet, 
  StyleProp, 
  ViewStyle,
  ImageStyle,
  Platform,
  Image as RNImage,
  Dimensions
} from 'react-native';
import { Image, ImageContentFit } from 'expo-image';
import { 
  ImagePriority, 
  CachePolicy, 
  markAsImportantImage,
  addImageToCache,
  isImageCached 
} from '../utils/imagePreloader';

// Get screen dimensions for optimization
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

// Debug flag - set to false to reduce logging
export const DEBUG_OPTIMIZED_IMAGE = false;

// Dynamic import for FastImage to prevent crashes on platforms where it's not available
let FastImage: any = null;
let isFastImageAvailable = false;

// Try to load FastImage (will be undefined if not installed or linked)
try {
  FastImage = require('react-native-fast-image').default;
  // Additional check to make sure the module is properly linked
  isFastImageAvailable = !!FastImage && typeof FastImage.preload === 'function' && !('bubblingEventTypes' in FastImage);
  
  if (DEBUG_OPTIMIZED_IMAGE) {
    console.log(`FastImage ${isFastImageAvailable ? 'is' : 'is not'} available for use`);
  }
} catch (e) {
  if (DEBUG_OPTIMIZED_IMAGE) {
    console.log('FastImage import failed:', e);
  }
  isFastImageAvailable = false;
}

// Helper to determine appropriate image dimensions
const getOptimalImageDimensions = (style: any): { width: number, height: number } => {
  let width: number | string = 300; // Default width 
  let height: number | string = 300; // Default height
  
  if (style) {
    // Extract width/height from style array
    if (Array.isArray(style)) {
      for (const styleItem of style) {
        if (styleItem && typeof styleItem === 'object') {
          if (styleItem.width) width = styleItem.width;
          if (styleItem.height) height = styleItem.height;
        }
      }
    } 
    // Extract from object style
    else if (typeof style === 'object') {
      if (style.width) width = style.width;
      if (style.height) height = style.height;
    }
  }
  
  // Handle percentage values
  if (typeof width === 'string' && width.endsWith('%')) {
    const percentage = parseFloat(width) / 100;
    width = screenWidth * percentage;
  } else if (typeof width === 'string') {
    width = parseFloat(width) || 300;
  }
  
  if (typeof height === 'string' && height.endsWith('%')) {
    const percentage = parseFloat(height) / 100;
    height = screenHeight * percentage;
  } else if (typeof height === 'string') {
    height = parseFloat(height) || 300;
  }
  
  return { width: Number(width), height: Number(height) };
};

// Function to add dimensions to image URI
const optimizeImageUri = (uri: string, dimensions: { width: number, height: number }): string => {
  if (!uri) return uri;
  
  // Don't optimize local assets or data URIs
  if (uri.startsWith('data:') || !uri.startsWith('http')) {
    return uri;
  }
  
  // Round dimensions to the nearest 50px for better CDN caching
  const width = Math.ceil(dimensions.width / 50) * 50;
  const height = Math.ceil(dimensions.height / 50) * 50;
  
  // Apply reasonable limits to prevent excessive dimensions
  const maxWidth = Math.min(width, 1200);
  const maxHeight = Math.min(height, 1200);
  
  // Add dimensions to URL
  const separator = uri.includes('?') ? '&' : '?';
  return `${uri}${separator}width=${maxWidth}&height=${maxHeight}&fit=cover`;
};

// Calculate estimated image size based on dimensions and format
const calculateEstimatedSize = (uri: string, dimensions: { width: number, height: number }): number => {
  const pixelCount = dimensions.width * dimensions.height;
  
  // Estimate bytes based on pixel count and image format (rough estimation)
  const bytesPerPixel = 4; // Assume RGBA
  let estimatedBytes = pixelCount * bytesPerPixel;
  
  // Adjust based on image format (if we can detect it)
  if (uri.endsWith('.jpg') || uri.endsWith('.jpeg')) {
    estimatedBytes = Math.ceil(estimatedBytes * 0.25); // JPG compression
  } else if (uri.endsWith('.png')) {
    estimatedBytes = Math.ceil(estimatedBytes * 0.5); // PNG compression
  } else if (uri.endsWith('.webp')) {
    estimatedBytes = Math.ceil(estimatedBytes * 0.2); // WebP is efficient
  } else if (uri.endsWith('.gif')) {
    estimatedBytes = Math.ceil(estimatedBytes * 0.7); // GIFs can be large
  }
  
  return Math.max(1024, estimatedBytes); // Minimum 1KB
};

// Performance tracking interface
interface ImageTiming {
  loadStart: number;
  loadEnd: number | null;
  loadDuration: number | null;
}

export interface OptimizedImageProps {
  source: string | number | { uri: string } | any;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  fallback?: string | number;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  priority?: 'low' | 'normal' | 'high';
  cachePolicy?: 'immutable' | 'web' | 'cacheOnly';
  showLoader?: boolean;
  loaderColor?: string;
  loaderSize?: 'small' | 'large';
  isImportant?: boolean;
  debugLabel?: string;
  retentionPriority?: 'low' | 'normal' | 'high';
  estimatedSize?: number;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: Error) => void;
  testID?: string;
}

export default function OptimizedImage({
  source,
  style,
  containerStyle,
  fallback,
  resizeMode = 'cover',
  priority = 'normal',
  cachePolicy = 'immutable',
  showLoader = true,
  loaderColor = '#007AFF',
  loaderSize = 'small',
  isImportant = false,
  debugLabel,
  retentionPriority = 'normal',
  estimatedSize,
  onLoadStart,
  onLoadEnd,
  onError,
  testID,
}: OptimizedImageProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timing, setTiming] = useState<ImageTiming>({
    loadStart: 0,
    loadEnd: null,
    loadDuration: null,
  });

  // Process the source into the format required by FastImage
  const processedSource = useMemo(() => {
    // Handle require() case (static image)
    if (typeof source === 'number') {
      return source;
    }

    // Get optimal dimensions based on style
    const dimensions = getOptimalImageDimensions(style);

    // Handle string URI
    if (typeof source === 'string') {
      // Apply dimension optimization to remote URLs
      const optimizedUri = optimizeImageUri(source, dimensions);
      
      return {
        uri: optimizedUri,
        priority: getPriority(priority),
        cache: getCachePolicy(cachePolicy),
      };
    }

    // Handle Source object
    if (typeof source === 'object' && source !== null && 'uri' in source) {
      const uri = source.uri;
      
      // Apply dimension optimization to remote URLs
      const optimizedUri = optimizeImageUri(uri, dimensions);
      
      return {
        ...source,
        uri: optimizedUri,
        priority: getPriority(priority),
        cache: getCachePolicy(cachePolicy)
      };
    }

    // Handle other cases
    return source;
  }, [source, priority, cachePolicy, style]);

  // Check if image is in cache
  useEffect(() => {
    if (typeof processedSource === 'object' && processedSource?.uri) {
      const uri = processedSource.uri;
      // If image is already in cache, skip loading state
      if (isImageCached(uri)) {
        setLoading(false);
        
        // If the image is already in cache, we can consider it loaded immediately
        if (DEBUG_OPTIMIZED_IMAGE) {
          const label = debugLabel || 'OptimizedImage';
          console.log(`⚡ [${label}] Image already in cache, skipping loading state`);
        }
        
        // Call onLoadEnd callback if provided
        if (onLoadEnd) {
          onLoadEnd();
        }
      }
    }
  }, [processedSource, debugLabel, onLoadEnd]);

  // Process fallback source
  const fallbackSource = useMemo(() => {
    if (!fallback) return null;
    
    if (typeof fallback === 'number') {
      return fallback;
    }
    
    if (typeof fallback === 'string') {
      return { uri: fallback };
    }
    
    return fallback;
  }, [fallback]);
  
  // Mark as important if needed
  useEffect(() => {
    if (isImportant && 
        typeof processedSource === 'object' && 
        processedSource !== null && 
        'uri' in processedSource && 
        processedSource.uri) {
      // Use a setTimeout to prevent synchronous state updates from causing render loops
      const timer = setTimeout(() => {
        markAsImportantImage(processedSource.uri);
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [isImportant, processedSource?.uri]);
  
  // Handle load start
  const handleLoadStart = () => {
    // Check if image is already in cache
    if (typeof processedSource === 'object' && processedSource?.uri && isImageCached(processedSource.uri)) {
      // Skip loading state for cached images
      if (DEBUG_OPTIMIZED_IMAGE) {
        const label = debugLabel || 'OptimizedImage';
        console.log(`⚡ [${label}] Image load skipped (already in cache)`);
      }
      return;
    }
    
    setLoading(true);
    setError(false);
    setTiming(prev => ({ ...prev, loadStart: Date.now() }));
    
    if (onLoadStart) {
      onLoadStart();
    }
    
    if (DEBUG_OPTIMIZED_IMAGE) {
      const label = debugLabel || 'OptimizedImage';
      console.log(`⏳ [${label}] Loading image started`);
    }
  };
  
  // Handle load success
  const handleLoadEnd = () => {
    setLoading(false);
    
    const now = Date.now();
    const loadDuration = now - timing.loadStart;
    setTiming(prev => ({ 
      ...prev, 
      loadEnd: now,
      loadDuration 
    }));
    
    // Add to cache using improved caching mechanism
    if (typeof processedSource === 'object' && processedSource?.uri) {
      const uri = processedSource.uri;
      
      // Calculate image size if not provided
      const dimensions = getOptimalImageDimensions(style);
      const size = estimatedSize || calculateEstimatedSize(uri, dimensions);
      
      // Special handling for high retention priority
      if (retentionPriority === 'high') {
        // Mark as important to keep in cache longer (size 0 means "don't purge")
        addImageToCache(uri, 0);
      } else {
        // Normal caching with estimated size
        addImageToCache(uri, size);
      }
    }
    
    if (onLoadEnd) {
      onLoadEnd();
    }
    
    if (DEBUG_OPTIMIZED_IMAGE) {
      const label = debugLabel || 'OptimizedImage';
      console.log(`✅ [${label}] Image loaded in ${loadDuration}ms`);
    }
  };
  
  // Handle load error
  const handleError = (error: Error) => {
    setLoading(false);
    setError(true);
    
    if (onError) {
      onError(error);
    }
    
    if (DEBUG_OPTIMIZED_IMAGE) {
      const label = debugLabel || 'OptimizedImage';
      console.log(`❌ [${label}] Image load error:`, error);
    }
  };
  
  // Convert priority string to FastImage priority
  function getPriority(prio: string): any {
    if (!isFastImageAvailable) return prio;
    
    switch (prio) {
      case 'low': return FastImage.priority.low;
      case 'high': return FastImage.priority.high;
      case 'normal':
      default: return FastImage.priority.normal;
    }
  }
  
  // Convert cache policy string to FastImage cache policy
  function getCachePolicy(policy: string): any {
    if (!isFastImageAvailable) return policy;
    
    switch (policy) {
      case 'web': return FastImage.cacheControl.web;
      case 'cacheOnly': return FastImage.cacheControl.cacheOnly;
      case 'immutable':
      default: return FastImage.cacheControl.immutable;
    }
  }
  
  // Get FastImage resize mode
  function getResizeMode(mode: string): any {
    if (!isFastImageAvailable) {
      // Return RN resize mode if FastImage is not available
      switch (mode) {
        case 'contain': return 'contain';
        case 'stretch': return 'stretch';
        case 'center': return 'center';
        case 'cover':
        default: return 'cover';
      }
    }
    
    // Return FastImage resize mode
    switch (mode) {
      case 'contain': return FastImage.resizeMode.contain;
      case 'stretch': return FastImage.resizeMode.stretch;
      case 'center': return FastImage.resizeMode.center;
      case 'cover':
      default: return FastImage.resizeMode.cover;
    }
  }
  
  // Convert resize mode to expo-image ContentFit
  function getContentFit(mode: string): ImageContentFit {
    switch (mode) {
      case 'contain': return 'contain';
      case 'stretch': return 'fill';
      case 'center': return 'none';
      case 'cover':
      default: return 'cover';
    }
  }
  
  // Render component
  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      {Platform.OS === 'web' ? (
        // Use Image component from expo-image for web
        <Image
          source={processedSource}
          style={[styles.image, style]}
          contentFit={getContentFit(resizeMode)}
          transition={300}
          onLoadStart={handleLoadStart}
          onLoad={handleLoadEnd}
          onError={() => handleError(new Error('Image load failed'))}
        />
      ) : isFastImageAvailable ? (
        // Use FastImage for native platforms if available and properly linked
        <FastImage
          source={processedSource}
          style={[styles.image, style]}
          resizeMode={getResizeMode(resizeMode)}
          onLoadStart={handleLoadStart}
          onLoad={handleLoadEnd}
          onError={() => handleError(new Error('Image load failed'))}
        />
      ) : (
        // Fallback to React Native's Image component when FastImage is not available
        <RNImage
          source={typeof processedSource === 'object' && processedSource !== null && 'uri' in processedSource 
            ? { uri: processedSource.uri }
            : processedSource}
          style={[styles.image, style]}
          resizeMode={getResizeMode(resizeMode) as any}
          onLoadStart={handleLoadStart}
          onLoad={handleLoadEnd}
          onError={() => handleError(new Error('Image load failed'))}
        />
      )}

      {error && fallbackSource && (
        <RNImage
          source={fallbackSource}
          style={[styles.image, style, styles.fallbackImage]}
          resizeMode={getResizeMode(resizeMode) as any}
        />
      )}

      {showLoader && loading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator 
            size={loaderSize}
            color={loaderColor}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallbackImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  }
}); 