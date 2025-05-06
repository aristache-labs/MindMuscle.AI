import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, StyleProp, ImageStyle, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { getFromMemoryCache, storeInMemoryCache, isImportantImage, markAsImportantImage, isRemotePrefetched } from '../utils/imagePreloader';
import { Asset } from 'expo-asset';

const DEBUG_OPTIMIZED_IMAGE = true;

// Props for the OptimizedImage component
interface OptimizedImageProps {
  source: { uri?: string } | number | string;
  style?: StyleProp<ImageStyle>;
  fallbackSource?: { uri?: string } | number;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  contentFit?: 'cover' | 'contain' | 'fill' | 'none';
  width?: number;
  height?: number;
  blurRadius?: number;
  fadeDuration?: number;
  backgroundColor?: string;
  showLoadingIndicator?: boolean;
  markImportant?: boolean;  // New prop to mark images as important
  debugLabel?: string;      // Debug label for tracing image loading
  loadingColor?: string;
  loadingSize?: 'small' | 'large';
  priority?: 'low' | 'normal' | 'high';
  cachePolicy?: 'memory-disk' | 'memory' | 'disk' | 'none';
  placeholderStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const extractUriFromSource = (source: any): string | null => {
  if (!source) return null;
  
  if (typeof source === 'string') {
    return source;
  }
  
  if (typeof source === 'number') {
    return `local-asset-${source}`;
  }
  
  if (source && source.uri) {
    return source.uri;
  }
  
  return null;
};

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  fallbackSource,
  resizeMode = 'cover',
  contentFit,
  width,
  height,
  blurRadius,
  fadeDuration = 200,
  backgroundColor = '#f0f0f0',
  showLoadingIndicator = true,
  markImportant = false,
  debugLabel = 'unlabeled',
  loadingColor = '#999',
  loadingSize = 'small',
  priority = 'normal',
  cachePolicy = 'memory-disk',
  placeholderStyle,
  children
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [finalSource, setFinalSource] = useState<any>(null);
  
  // Combined styles for the image container
  const containerStyle: StyleProp<ViewStyle> = [
    styles.container,
    backgroundColor ? { backgroundColor } : undefined,
    width ? { width } : undefined,
    height ? { height } : undefined,
    placeholderStyle,
  ];
  
  // Combined styles for the image itself
  const imageStyle: StyleProp<ImageStyle> = [
    styles.image,
    { resizeMode },
    style,
    width ? { width } : undefined,
    height ? { height } : undefined,
  ];
  
  // Prepare the image source
  useEffect(() => {
    const prepareSource = async () => {
      // Reset state
      setIsLoading(true);
      setLoadError(null);
      
      try {
        // Handle different source types
        if (typeof source === 'number') {
          // Local bundled asset (numeric require)
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.log(`📦 [${debugLabel}] Using local bundled asset (numeric): ${source}`);
          }
          
          setFinalSource(source);
          setIsLoading(false);
          return;
        }
        
        if (typeof source === 'string') {
          // Direct URI string
          setFinalSource({ uri: source });
          setIsLoading(false);
          return;
        }
        
        if (source && source.uri) {
          const uri = source.uri;
          
          // First check memory cache - this is fastest
          const cachedImage = getFromMemoryCache(uri);
          
          if (cachedImage) {
            if (DEBUG_OPTIMIZED_IMAGE) {
              console.log(`✅ [${debugLabel}] CACHE HIT (memory): ${uri}`);
            }
            setFinalSource({ uri });
            setIsLoading(false);
            
            // Still mark as important if needed
            if (markImportant && !isImportantImage(uri)) {
              markAsImportantImage(uri);
            }
            return;
          }
          
          // If remote image is already prefetched, use it
          if (isRemotePrefetched(uri)) {
            if (DEBUG_OPTIMIZED_IMAGE) {
              console.log(`✅ [${debugLabel}] Using prefetched remote image: ${uri}`);
            }
            setFinalSource({ uri });
            setIsLoading(false);
            
            // Mark as important if needed
            if (markImportant && !isImportantImage(uri)) {
              markAsImportantImage(uri);
            }
            return;
          }
          
          // For remote images, we'll load them normally and let expo-image handle caching
          if (uri.startsWith('http')) {
            if (DEBUG_OPTIMIZED_IMAGE) {
              console.log(`🔄 [${debugLabel}] CACHE MISS, loading from network: ${uri}`);
            }
            
            // Mark as important if needed
            if (markImportant && !isImportantImage(uri)) {
              markAsImportantImage(uri);
            }
            
            setFinalSource({ uri });
            setIsLoading(false);
            return;
          }
          
          // For local file URIs, just use directly
          if (uri.startsWith('file') || uri.startsWith('content')) {
            if (DEBUG_OPTIMIZED_IMAGE) {
              console.log(`🔄 [${debugLabel}] CACHE MISS, loading from disk: ${uri}`);
            }
            
            // Mark as important if needed
            if (markImportant && !isImportantImage(uri)) {
              markAsImportantImage(uri);
            }
            
            setFinalSource({ uri });
            setIsLoading(false);
            return;
          }
        }
        
        // If we get here, use fallback if provided
        if (fallbackSource) {
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.log(`⚠️ [${debugLabel}] Using fallback source`);
          }
          setFinalSource(fallbackSource);
          setIsLoading(false);
          return;
        }
        
        // If no valid source and no fallback, set error
        throw new Error('Invalid image source');
      } catch (error) {
        if (DEBUG_OPTIMIZED_IMAGE) {
          console.error(`❌ [${debugLabel}] Error loading image:`, error);
        }
        setLoadError(error as Error);
        setIsLoading(false);
      }
    };
    
    // Track image loading in the log
    if (DEBUG_OPTIMIZED_IMAGE) {
      const uri = extractUriFromSource(source);
      console.log(`🖼️ [${debugLabel}] START loading image: ${uri?.substring(0, 50)}${uri && uri.length > 50 ? '...' : ''}`);
    }
    
    prepareSource();
  }, [source, fallbackSource, debugLabel, markImportant]);
  
  // Handle successful image load
  const handleLoad = () => {
    setIsLoading(false);
    
    // Track image loading success in the log
    if (DEBUG_OPTIMIZED_IMAGE) {
      const uri = extractUriFromSource(source);
      console.log(`✅ [${debugLabel}] Image LOADED: ${uri?.substring(0, 50)}${uri && uri.length > 50 ? '...' : ''}`);
    }
    
    // Cache the image data if not already cached
    const uri = extractUriFromSource(source);
    if (uri && !getFromMemoryCache(uri)) {
      storeInMemoryCache(uri, true);
    }
  };
  
  // Handle image load error
  const handleError = (error: any) => {
    setLoadError(error);
    setIsLoading(false);
    
    // Track image loading error in the log
    if (DEBUG_OPTIMIZED_IMAGE) {
      const uri = extractUriFromSource(source);
      console.log(`❌ [${debugLabel}] Image FAILED: ${uri?.substring(0, 50)}${uri && uri.length > 50 ? '...' : ''}`);
    }
    
    // Try fallback if available
    if (fallbackSource && fallbackSource !== finalSource) {
      setFinalSource(fallbackSource);
    }
  };
  
  return (
    <View style={containerStyle}>
      {finalSource && (
        <Image
          source={finalSource}
          style={imageStyle}
          contentFit={contentFit || resizeMode as any}
          blurRadius={blurRadius}
          transition={fadeDuration}
          onLoad={handleLoad}
          onError={handleError}
          cachePolicy={cachePolicy}
          priority={priority}
        />
      )}
      
      {(isLoading || !finalSource) && showLoadingIndicator && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={loadingColor} size={loadingSize} />
        </View>
      )}
      
      {loadError && fallbackSource && !finalSource && (
        <Image
          source={fallbackSource}
          style={imageStyle}
          contentFit={contentFit || resizeMode as any}
          transition={fadeDuration}
        />
      )}
      
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default React.memo(OptimizedImage); 