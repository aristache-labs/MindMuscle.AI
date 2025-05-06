import React, { useState, useEffect, useRef } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { StyleSheet, ActivityIndicator, View, StyleProp, ViewStyle } from 'react-native';
import { getCachedImageUri } from '../utils/cacheManager';
import { preloadSingleImage, getFromMemoryCache } from '../utils/imagePreloader';
import { Text } from 'react-native-paper';
import { ImageStyle } from 'react-native';

// Debug flag - set to true to enable detailed image loading logs
const DEBUG_IMAGE_LOADING = true;

interface OptimizedImageProps {
  source: string | any;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  placeholder?: React.ReactNode;
  fadeDuration?: number;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none';
  enableCaching?: boolean;
  priority?: 'high' | 'normal' | 'low';
  fallback?: string | any;
  onError?: () => void;
  onLoad?: () => void;
  testID?: string;
  debugLabel?: string; // Add label for debugging
}

// Add a debug utility function to better extract URL information
const getSourceForDebug = (source: any): string => {
  if (!source) return 'null';
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return `local-asset-${source}`;
  if (source.uri) return source.uri;
  return JSON.stringify(source).substring(0, 50);
};

export default function OptimizedImage({
  source,
  style,
  containerStyle,
  imageStyle,
  placeholder,
  fadeDuration = 200,
  contentFit = 'cover',
  enableCaching = true,
  priority = 'normal',
  fallback,
  onError,
  onLoad,
  testID,
  debugLabel = 'unlabeled',
}: OptimizedImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSource, setImageSource] = useState<any>(null);
  const didUnmountRef = useRef(false);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);
    const sourceDebugInfo = getSourceForDebug(source);
    if (DEBUG_IMAGE_LOADING) {
      console.log(`🖼️ [${debugLabel}] START loading image: ${sourceDebugInfo.substring(0, 50)}${sourceDebugInfo.length > 50 ? '...' : ''}`);
    }
    const loadImage = async () => {
      if (!source) {
        DEBUG_IMAGE_LOADING && console.log(`🚫 [${debugLabel}] No source provided`);
        setError(true);
        setLoading(false);
        return;
      }

      // Special case: numeric local-bundle asset (result of require)
      if (typeof source === 'number') {
        DEBUG_IMAGE_LOADING && console.log(`📦 [${debugLabel}] Using local bundled asset (numeric): ${source}`);
        // For require() results, use the numeric ID directly
        setImageSource(source);
        setLoading(false);
        return;
      }

      // 1) extract a plain URL string, if any
      let uri: string | null = null;
      if (typeof source === 'string') {
        uri = source;
      } else if (typeof source === 'object' && source.uri && typeof source.uri === 'string') {
        uri = source.uri;
      }

      // 2) numeric local-bundle (require) — just use it directly
      if (typeof source === 'number' && !uri) {
        DEBUG_IMAGE_LOADING && console.log(`📦 [${debugLabel}] Using local bundle asset`);
        setImageSource(source);
        setLoading(false);
        return;
      }

      // 3) if we got a URL, try memory cache
      if (enableCaching && uri) {
        const mem = getFromMemoryCache(uri);
        if (mem) {
          DEBUG_IMAGE_LOADING && console.log(`✅ [${debugLabel}] CACHE HIT (memory): ${uri}`);
          setImageSource(mem);
          setLoading(false);
          return;
        }

        // 4) miss → go to disk cache
        try {
          DEBUG_IMAGE_LOADING && console.log(`🔄 [${debugLabel}] CACHE MISS, loading from disk: ${uri}`);
          const filePath = await getCachedImageUri(uri);
          setImageSource({ uri: filePath });
          setLoading(false);
          // kick off a low-priority prefetch to keep REMOTE_PREFETCHED in sync
          preloadSingleImage(uri).catch(() => {});
          return;
        } catch (e) {
          console.warn(`Cache/disk error for ${uri}:`, e);
        }
      }

      // 5) fallback: remote URL or data URI with no caching
      if (uri) {
        DEBUG_IMAGE_LOADING && console.log(`🔗 [${debugLabel}] Direct load (no cache): ${uri}`);
        setImageSource({ uri });
      } else {
        // catch-all fallback for unknown shapes
        DEBUG_IMAGE_LOADING && console.log(`🧩 [${debugLabel}] Unknown source shape, rendering as-is`);
        setImageSource(source);
      }
      setLoading(false);
    };
    loadImage();
    return () => {
      isMounted = false;
    };
  }, [source, enableCaching, priority, fallback, debugLabel]);
  
  const handleLoad = () => {
    if (DEBUG_IMAGE_LOADING) {
      const sourceDebugInfo = getSourceForDebug(source);
      console.log(`✅ [${debugLabel}] Image LOADED: ${sourceDebugInfo.substring(0, 50)}${sourceDebugInfo.length > 50 ? '...' : ''}`);
    }
    
    if (isMountedRef.current) {
      setLoading(false);
      if (onLoad) onLoad();
    }
  };
  
  const handleError = () => {
    if (DEBUG_IMAGE_LOADING) {
      const sourceDebugInfo = getSourceForDebug(source);
      console.log(`❌ [${debugLabel}] Image FAILED: ${sourceDebugInfo.substring(0, 50)}${sourceDebugInfo.length > 50 ? '...' : ''}`);
    }
    
    if (isMountedRef.current) {
      setError(true);
      setLoading(false);
      if (onError) onError();
    }
  };
  
  const renderPlaceholder = () => {
    if (placeholder) return placeholder;
    
    return (
      <View style={[styles.placeholder, containerStyle]}>
        <ActivityIndicator color="#6c47ff" size="small" />
      </View>
    );
  };
  
  const renderError = () => {
    return (
      <View style={[styles.errorContainer, containerStyle]}>
        <Text style={styles.errorText}>!</Text>
      </View>
    );
  };
  
  return (
    <View style={[styles.container, containerStyle]}>
      {loading && renderPlaceholder()}
      
      {imageSource && !error && (
        <ExpoImage
          source={imageSource}
          style={[styles.image, style, imageStyle]}
          contentFit={contentFit}
          transition={fadeDuration}
          onLoad={handleLoad}
          onError={handleError}
          testID={testID}
          cachePolicy="memory-disk"
        />
      )}
      
      {error && renderError()}
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
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  errorText: {
    fontSize: 18,
    color: 'red',
  },
}); 