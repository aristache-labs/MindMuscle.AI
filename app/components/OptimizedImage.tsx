import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  ActivityIndicator, 
  StyleSheet, 
  StyleProp, 
  ViewStyle,
  ImageStyle,
  Platform,
  Image as RNImage
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { Image, ImageContentFit } from 'expo-image';
import { ImagePriority, CachePolicy, markAsImportantImage } from '../utils/imagePreloader';

// Debug flag
export const DEBUG_OPTIMIZED_IMAGE = true;

// Check if FastImage is available
const isFastImageAvailable = !!FastImage && typeof FastImage.preload === 'function';

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

    // Handle string URI
    if (typeof source === 'string') {
      return {
        uri: source,
        priority: getPriority(priority),
        cache: getCachePolicy(cachePolicy),
      };
    }

    // Handle Source object
    if (typeof source === 'object' && source !== null && 'uri' in source) {
      const uri = source.uri;
      return {
        uri,
        priority: getPriority(priority),
        cache: getCachePolicy(cachePolicy),
        ...source
      };
    }

    // Handle other cases
    return source;
  }, [source, priority, cachePolicy]);

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
    if (isImportant && typeof processedSource === 'object' && processedSource !== null && 'uri' in processedSource && processedSource.uri) {
      markAsImportantImage(processedSource.uri);
    }
  }, [isImportant, processedSource]);
  
  // Handle load start
  const handleLoadStart = () => {
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
    switch (prio) {
      case 'low': return ImagePriority.LOW;
      case 'high': return ImagePriority.HIGH;
      case 'normal':
      default: return ImagePriority.NORMAL;
    }
  }
  
  // Convert cache policy string to FastImage cache policy
  function getCachePolicy(policy: string): any {
    switch (policy) {
      case 'web': return CachePolicy.WEB;
      case 'cacheOnly': return CachePolicy.CACHE_ONLY;
      case 'immutable':
      default: return CachePolicy.IMMUTABLE;
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
        // Use FastImage for native platforms if available
        <FastImage
          source={processedSource}
          style={[styles.image, style as any]}
          resizeMode={getResizeMode(resizeMode)}
          onLoadStart={handleLoadStart}
          onLoad={handleLoadEnd}
          onError={() => handleError(new Error('Image load failed'))}
          fallback={error && fallbackSource !== null}
        >
          {error && fallbackSource && (
            <FastImage
              source={fallbackSource}
              style={StyleSheet.absoluteFill}
              resizeMode={getResizeMode(resizeMode)}
            />
          )}
        </FastImage>
      ) : (
        // Fallback to React Native Image if FastImage is not available
        <RNImage
          source={processedSource}
          style={[styles.image, style]}
          resizeMode={getResizeMode(resizeMode) as any}
          onLoadStart={handleLoadStart}
          onLoad={handleLoadEnd}
          onError={() => handleError(new Error('Image load failed'))}
        />
      )}
      
      {loading && showLoader && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size={loaderSize} color={loaderColor} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
}); 