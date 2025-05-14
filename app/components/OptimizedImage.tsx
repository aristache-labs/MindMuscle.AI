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

// Track usage statistics
let imageRenderCount = 0;

// Log usage statistics periodically
if (DEBUG_OPTIMIZED_IMAGE) {
  // Setup interval to log image usage statistics every 10 seconds
  setInterval(() => {
    if (imageRenderCount > 0) {
      console.log(`📊 [OptimizedImage] Rendering stats - Total: ${imageRenderCount}`);
    }
  }, 10000); // 10 seconds
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
  const [isCached, setIsCached] = useState(false);
  const [timing, setTiming] = useState<ImageTiming>({
    loadStart: 0,
    loadEnd: null,
    loadDuration: null,
  });

  // Process the source for expo-image
  const processedSource = useMemo(() => {
    // Handle require() case (static image)
    if (typeof source === 'number') {
      return source;
    }

    // Special case for placeholder images with stable references
    if (typeof source === 'object' && source !== null && 
        'testUri' in source && source.testUri && 
        (!source.uri || source.uri === null)) {
      // This is a placeholder image with a stable reference
      // Use require() if possible, otherwise fallback to a standard placeholder
      try {
        return require('../../assets/exercises/placeholder.jpg');
      } catch (e) {
        // If require fails, use a standard placeholder
        return source;
      }
    }

    // Get optimal dimensions based on style
    const dimensions = getOptimalImageDimensions(style);

    // Handle string URI
    if (typeof source === 'string') {
      // Apply dimension optimization to remote URLs
      const optimizedUri = optimizeImageUri(source, dimensions);
      
      return optimizedUri;
    }

    // Handle Source object
    if (typeof source === 'object' && source !== null && 'uri' in source && source.uri) {
      const uri = source.uri;
      
      // Apply dimension optimization to remote URLs
      const optimizedUri = uri ? optimizeImageUri(uri, dimensions) : null;
      
      if (!optimizedUri) return source;
      
      return {
        ...source,
        uri: optimizedUri
      };
    }

    // Fallback to the original source
    return source;
  }, [source, style]);

  // Extract dimensions for estimation
  const dimensions = useMemo(() => getOptimalImageDimensions(style), [style]);

  // Check if the image is in the cache
  useEffect(() => {
    const checkCache = async () => {
      if (typeof processedSource === 'object' && processedSource !== null && 'uri' in processedSource) {
        const uri = processedSource.uri;
        if (uri) {
          try {
            const cached = await isImageCached(uri);
            setIsCached(cached);
          } catch (err) {
            setIsCached(false);
          }
        }
      } else if (typeof processedSource === 'string') {
        try {
          const cached = await isImageCached(processedSource);
          setIsCached(cached);
        } catch (err) {
          setIsCached(false);
        }
      }
    };
    
    checkCache();
  }, [processedSource]);

  // Mark as important if needed
  useEffect(() => {
    if (isImportant && processedSource) {
      if (typeof processedSource === 'object' && processedSource !== null && 'uri' in processedSource) {
        markAsImportantImage(processedSource.uri);
      } else if (typeof processedSource === 'string') {
        markAsImportantImage(processedSource);
      }
    }
  }, [isImportant, processedSource]);

  // Handle load start
  const handleLoadStart = () => {
    // Check if image is already in cache
    if (isCached) {
      if (DEBUG_OPTIMIZED_IMAGE) {
        console.log(`🖼️ [OptimizedImage] ${debugLabel || 'Image'} already in cache, skipping load indicators`);
      }
      setLoading(false);
      
      if (onLoadStart) {
        onLoadStart();
      }
      
      return;
    }
    
    setTiming(prev => ({
      ...prev,
      loadStart: Date.now(),
    }));
    
    setLoading(true);
    
    if (onLoadStart) {
      onLoadStart();
    }
  };

  // Handle load end
  const handleLoadEnd = () => {
    // Add to the cache for future reference
    if (processedSource) {
      try {
        // Handle string source
        if (typeof processedSource === 'string') {
          const uri = processedSource;
          const size = estimatedSize || calculateEstimatedSize(uri, dimensions);
          addImageToCache(uri, size);
        }
        // Handle object source with uri
        else if (typeof processedSource === 'object' && processedSource !== null && 'uri' in processedSource) {
          const uri = processedSource.uri;
          if (uri) {
            const size = estimatedSize || calculateEstimatedSize(uri, dimensions);
            addImageToCache(uri, size);
          }
        }
      } catch (e) {
        // Ignore cache errors
        if (DEBUG_OPTIMIZED_IMAGE) {
          console.warn(`🖼️ [OptimizedImage] Cache error for ${debugLabel || 'image'}:`, e);
        }
      }
    }
    
    setLoading(false);
    setError(false);
    
    const endTime = Date.now();
    const startTime = timing.loadStart;
    const duration = startTime ? endTime - startTime : null;
    
    setTiming(prev => ({
      ...prev,
      loadEnd: endTime,
      loadDuration: duration,
    }));
    
    if (DEBUG_OPTIMIZED_IMAGE && duration) {
      console.log(`🖼️ [OptimizedImage] ${debugLabel || 'Image'} loaded in ${duration}ms`);
    }
    
    if (onLoadEnd) {
      onLoadEnd();
    }
    
    // Update stats
    imageRenderCount++;
  };

  // Handle errors
  const handleError = (event: any) => {
    setLoading(false);
    setError(true);
    
    if (DEBUG_OPTIMIZED_IMAGE) {
      console.error(`🖼️ [OptimizedImage] ${debugLabel || 'Image'} error:`, event);
    }
    
    if (onError) {
      // Convert to Error object for backwards compatibility with consumer code
      const errorObj = new Error('Image loading failed');
      onError(errorObj);
    }
  };

  // Convert to expo-image contentFit
  function getContentFit(mode: string): ImageContentFit {
    switch (mode) {
      case 'contain':
        return 'contain';
      case 'cover':
        return 'cover';
      case 'stretch':
        return 'fill';
      case 'center':
        return 'none';
      default:
        return 'cover';
    }
  }

  // Render component
  return (
    <View style={[styles.container, containerStyle]}>
      {/* Main Image */}
      <Image
        source={processedSource}
        style={[styles.image, style]}
        contentFit={getContentFit(resizeMode)}
        cachePolicy="memory-disk"
        priority={priority}
        onLoadStart={handleLoadStart}
        onLoad={handleLoadEnd}
        onError={handleError}
        testID={testID}
      />
      
      {/* Fallback Image (if error) */}
      {error && fallback && (
        <Image
          source={fallback}
          style={[styles.fallbackImage, style]}
          contentFit={getContentFit(resizeMode)}
        />
      )}
      
      {/* Loading Indicator */}
      {loading && showLoader && (
        <ActivityIndicator
          style={styles.loader}
          color={loaderColor}
          size={loaderSize}
        />
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
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  }
}); 