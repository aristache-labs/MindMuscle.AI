import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  
  // Don't optimize local assets, data URIs, or SVGs
  if (uri.startsWith('data:') || !uri.startsWith('http') || uri.endsWith('.svg')) {
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
  
  // SVGs are much smaller
  if (uri.endsWith('.svg')) {
    return 10 * 1024; // Assume 10KB for SVG
  }
  
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

// Check if source is SVG
const isSvgImage = (source: any): boolean => {
  if (typeof source === 'string') {
    return source.endsWith('.svg');
  }
  if (typeof source === 'object' && source !== null && 'uri' in source) {
    return source.uri?.endsWith('.svg') || false;
  }
  return false;
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
  showLoader = false, // Changed default to false to prevent flickering
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
  // Reference to track if component is mounted
  const isMounted = useRef(true);
  
  // State - simplified to reduce flickering
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Check if this is an SVG
  const isSvg = useMemo(() => isSvgImage(source), [source]);

  // Process the source for expo-image with stable memoization
  const processedSource = useMemo(() => {
    // Handle require() case (static image) - always stable
    if (typeof source === 'number') {
      return source;
    }

    // Special case for placeholder images with stable references
    if (typeof source === 'object' && source !== null && 
        'testUri' in source && source.testUri && 
        (!source.uri || source.uri === null)) {
      try {
        return require('../../assets/exercises/placeholder.jpg');
      } catch (e) {
        return source;
      }
    }

    // Handle Source object with better validation
    if (typeof source === 'object' && source !== null && 'uri' in source) {
      const uri = source.uri;
      
      // Check if URI is valid - if not, return null to trigger fallback
      if (!uri || 
          uri === null || 
          uri === undefined || 
          uri === '' || 
          uri === 'null' || 
          uri === 'undefined' || 
          typeof uri !== 'string') {
        // Return null to trigger immediate fallback without loading attempts
        return null;
      }
      
      // Get optimal dimensions based on style
      const dimensions = getOptimalImageDimensions(style);
      
      // Don't optimize SVGs, just return as is
      if (uri.endsWith('.svg')) {
        return source;
      }
      
      // Apply dimension optimization to remote URLs
      const optimizedUri = optimizeImageUri(uri, dimensions);
      
      return {
        ...source,
        uri: optimizedUri
      };
    }

    // Handle string URI
    if (typeof source === 'string') {
      // Check if string is valid
      if (!source || 
          source === '' || 
          source === 'null' || 
          source === 'undefined') {
        // Return null to trigger immediate fallback
        return null;
      }
      
      // Get optimal dimensions based on style
      const dimensions = getOptimalImageDimensions(style);
      
      // Don't optimize SVGs, just return as is
      if (source.endsWith('.svg')) {
        return source;
      }
      
      // Apply dimension optimization to remote URLs
      const optimizedUri = optimizeImageUri(source, dimensions);
      return optimizedUri;
    }

    // Fallback to the original source
    return source;
  }, [source, style]);

  // Extract dimensions for estimation
  const dimensions = useMemo(() => getOptimalImageDimensions(style), [style]);

  // Synchronously check cache status to prevent flickering
  const isCached = useMemo(() => {
    // For local assets, always consider cached
    if (typeof processedSource === 'number') {
      return true;
    }
    
    // For SVGs, always consider cached
    if (isSvg) {
      return true;
    }
    
    // For remote images, we'll let the Image component handle caching
    // This prevents async state updates that cause flickering
    return false;
  }, [processedSource, isSvg]);

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

  // Handle load start - simplified to reduce state changes
  const handleLoadStart = () => {
    // Skip for local assets and SVGs
    if (typeof source === 'number' || isSvg) {
      if (onLoadStart) {
        onLoadStart();
      }
      return;
    }
    
    // Only show loading for remote images if explicitly requested
    if (isMounted.current && showLoader && !isCached) {
      setIsLoading(true);
    }
    
    if (onLoadStart) {
      onLoadStart();
    }
  };

  // Handle load end - simplified
  const handleLoadEnd = () => {
    // Add to cache for future reference
    if (processedSource && isMounted.current) {
      try {
        let uri: string | null = null;
        
        if (typeof processedSource === 'string') {
          uri = processedSource;
        } else if (typeof processedSource === 'object' && processedSource !== null && 'uri' in processedSource) {
          uri = processedSource.uri;
        }
        
        if (uri) {
          const size = estimatedSize || calculateEstimatedSize(uri, dimensions);
          addImageToCache(uri, size);
        }
      } catch (e) {
        // Ignore cache errors
      }
    }
    
    // Clear loading state
    if (isMounted.current) {
      setIsLoading(false);
      setHasError(false);
    }
    
    if (onLoadEnd) {
      onLoadEnd();
    }
    
    // Update stats
    imageRenderCount++;
  };

  // Handle errors - simplified
  const handleError = (event: any) => {
    if (isMounted.current) {
      setIsLoading(false);
      setHasError(true);
      
      if (DEBUG_OPTIMIZED_IMAGE) {
        console.error(`🖼️ [OptimizedImage] ${debugLabel || 'Image'} error:`, event);
      }
    }
    
    if (onError) {
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

  // Set up cleanup when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Determine what to show
  const shouldShowFallback = (hasError || processedSource === null) && fallback;
  const shouldShowLoader = isLoading && showLoader && !isCached && !isSvg && processedSource !== null;
  const shouldShowMainImage = processedSource !== null && !shouldShowFallback;

  // Render component with stable structure to prevent flickering
  return (
    <View style={[styles.container, containerStyle]}>
      {/* Main Image - only rendered if we have a valid source */}
      {shouldShowMainImage && (
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
      )}
      
      {/* Fallback Image - shown immediately for invalid sources or on error */}
      {shouldShowFallback && (
        <Image
          source={fallback}
          style={[styles.fallbackImage, style]}
          contentFit={getContentFit(resizeMode)}
          cachePolicy="memory-disk"
        />
      )}
      
      {/* Loading Indicator - minimal usage to prevent flickering */}
      {shouldShowLoader && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator
            color={loaderColor}
            size={loaderSize}
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
  hiddenImage: {
    opacity: 0,
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
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
}); 