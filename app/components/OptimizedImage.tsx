import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, StyleProp, ImageStyle, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { isImportantImage, markAsImportantImage, isImagePreloaded, preloadSingleImage } from '../utils/imagePreloader';
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

interface ImageTiming {
  prepareStart: number | null;
  prepareEnd: number | null;
  loadStart: number | null;
  loadEnd: number | null;
  totalDuration: number | null;
  prepareDuration: number | null;
  loadDuration: number | null;
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
  const [timing, setTiming] = useState<ImageTiming>({
    prepareStart: null,
    prepareEnd: null,
    loadStart: null,
    loadEnd: null,
    totalDuration: null,
    prepareDuration: null,
    loadDuration: null,
  });
  
  // Keep track of component mount state
  const isMounted = useRef(true);
  
  // Extract URI for logging
  const sourceUri = extractUriFromSource(source);
  const shortUri = sourceUri ? 
    `${sourceUri.substring(0, 40)}${sourceUri.length > 40 ? '...' : ''}` :
    'unknown-source';
  
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

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  useEffect(() => {
    const prepareSource = async () => {
      const prepareStart = Date.now();
      setTiming(prev => ({ ...prev, prepareStart }));
      
      if (DEBUG_OPTIMIZED_IMAGE) {
        console.log(`🔄 [${debugLabel}] Preparing image: ${shortUri}`);
      }
      
      setIsLoading(true);
      setLoadError(null);
      
      try {
        // Handle different source types
        if (typeof source === 'number') {
          // Local bundled asset
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.log(`📦 [${debugLabel}] Local asset (require): ${source}`);
          }
          setFinalSource(source);
          setIsLoading(false);
          
          const prepareEnd = Date.now();
          const prepareDuration = prepareEnd - prepareStart;
          setTiming(prev => ({ 
            ...prev, 
            prepareEnd, 
            prepareDuration,
            totalDuration: prepareDuration 
          }));
          
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.log(`⏱️ [${debugLabel}] Local asset prepared in ${prepareDuration}ms`);
          }
          return;
        }
        
        if (typeof source === 'string') {
          // Direct URI string
          const uri = source;
          const isPreloaded = isImagePreloaded(uri);
          
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.log(`🔍 [${debugLabel}] String URI${isPreloaded ? ' (preloaded)' : ''}: ${shortUri}`);
          }
          
          setFinalSource({ uri });
          setIsLoading(!isPreloaded); // Skip loading state if preloaded
          
          // If marked as important and not already preloaded, preload it
          if (markImportant) {
            markAsImportantImage(uri);
            if (DEBUG_OPTIMIZED_IMAGE) {
              console.log(`🔖 [${debugLabel}] Marked as important: ${shortUri}`);
            }
            
            if (!isPreloaded) {
              const preloadStart = Date.now();
              try {
                await preloadSingleImage(uri);
                if (DEBUG_OPTIMIZED_IMAGE) {
                  const preloadDuration = Date.now() - preloadStart;
                  console.log(`⚡ [${debugLabel}] On-demand preloaded in ${preloadDuration}ms: ${shortUri}`);
                }
              } catch (err) {
                if (DEBUG_OPTIMIZED_IMAGE) {
                  console.warn(`❌ [${debugLabel}] On-demand preload failed: ${shortUri}`, err);
                }
                // Ignore preload errors here since the image will load normally
              }
            }
          }
          
          const prepareEnd = Date.now();
          const prepareDuration = prepareEnd - prepareStart;
          setTiming(prev => ({ 
            ...prev, 
            prepareEnd, 
            prepareDuration,
            // If preloaded, we can consider the total duration to be the prepare duration
            ...(isPreloaded ? { totalDuration: prepareDuration } : {})
          }));
          
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.log(`⏱️ [${debugLabel}] URI prepared in ${prepareDuration}ms${isPreloaded ? ' (preloaded)' : ''}: ${shortUri}`);
          }
          
          return;
        }
        
        if (source && source.uri) {
          // Object with URI property
          const uri = source.uri;
          const isPreloaded = isImagePreloaded(uri);
          
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.log(`🔍 [${debugLabel}] Object URI${isPreloaded ? ' (preloaded)' : ''}: ${shortUri}`);
          }
          
          setFinalSource({ uri });
          setIsLoading(!isPreloaded); // Skip loading state if preloaded
          
          // If marked as important and not already preloaded, preload it
          if (markImportant) {
            markAsImportantImage(uri);
            if (DEBUG_OPTIMIZED_IMAGE) {
              console.log(`🔖 [${debugLabel}] Marked as important: ${shortUri}`);
            }
            
            if (!isPreloaded) {
              const preloadStart = Date.now();
              try {
                await preloadSingleImage(uri);
                if (DEBUG_OPTIMIZED_IMAGE) {
                  const preloadDuration = Date.now() - preloadStart;
                  console.log(`⚡ [${debugLabel}] On-demand preloaded in ${preloadDuration}ms: ${shortUri}`);
                }
              } catch (err) {
                if (DEBUG_OPTIMIZED_IMAGE) {
                  console.warn(`❌ [${debugLabel}] On-demand preload failed: ${shortUri}`, err);
                }
                // Ignore preload errors here since the image will load normally
              }
            }
          }
          
          const prepareEnd = Date.now();
          const prepareDuration = prepareEnd - prepareStart;
          setTiming(prev => ({ 
            ...prev, 
            prepareEnd, 
            prepareDuration,
            // If preloaded, we can consider the total duration to be the prepare duration
            ...(isPreloaded ? { totalDuration: prepareDuration } : {})
          }));
          
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.log(`⏱️ [${debugLabel}] Object URI prepared in ${prepareDuration}ms${isPreloaded ? ' (preloaded)' : ''}: ${shortUri}`);
          }
          
          return;
        }
        
        // If we get here, use fallback if provided
        if (fallbackSource) {
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.log(`⚠️ [${debugLabel}] Using fallback source: ${extractUriFromSource(fallbackSource)}`);
          }
          
          setFinalSource(fallbackSource);
          setIsLoading(false);
          
          const prepareEnd = Date.now();
          const prepareDuration = prepareEnd - prepareStart;
          setTiming(prev => ({ 
            ...prev, 
            prepareEnd, 
            prepareDuration,
            totalDuration: prepareDuration
          }));
          
          return;
        }
        
        throw new Error('Invalid image source');
      } catch (error) {
        const prepareEnd = Date.now();
        const prepareDuration = prepareEnd - prepareStart;
        
        if (DEBUG_OPTIMIZED_IMAGE) {
          console.error(`❌ [${debugLabel}] Error preparing image (${prepareDuration}ms): ${shortUri}`, error);
        }
        
        setLoadError(error as Error);
        setIsLoading(false);
        
        setTiming(prev => ({ 
          ...prev, 
          prepareEnd, 
          prepareDuration,
          totalDuration: prepareDuration
        }));
      }
    };
    
    prepareSource();
  }, [source, fallbackSource, debugLabel, markImportant, shortUri]);
  
  const handleLoad = () => {
    if (!isMounted.current) return;
    
    const loadEnd = Date.now();
    const loadDuration = timing.loadStart ? loadEnd - timing.loadStart : null;
    const totalDuration = timing.prepareStart ? loadEnd - timing.prepareStart : null;
    
    setIsLoading(false);
    setTiming(prev => ({ 
      ...prev, 
      loadEnd, 
      loadDuration, 
      totalDuration 
    }));
    
    if (DEBUG_OPTIMIZED_IMAGE) {
      console.log(`✅ [${debugLabel}] Image loaded: ${shortUri}`);
      
      if (loadDuration) {
        console.log(`⏱️ [${debugLabel}] Load time: ${loadDuration}ms, Total: ${totalDuration}ms`);
      }
    }
  };
  
  const handleLoadStart = () => {
    if (!isMounted.current) return;
    
    const loadStart = Date.now();
    setTiming(prev => ({ ...prev, loadStart }));
    
    if (DEBUG_OPTIMIZED_IMAGE) {
      console.log(`⏳ [${debugLabel}] Image load started: ${shortUri}`);
    }
  };
  
  const handleError = (error: any) => {
    if (!isMounted.current) return;
    
    const loadEnd = Date.now();
    const loadDuration = timing.loadStart ? loadEnd - timing.loadStart : null;
    const totalDuration = timing.prepareStart ? loadEnd - timing.prepareStart : null;
    
    setLoadError(error);
    setIsLoading(false);
    
    setTiming(prev => ({ 
      ...prev, 
      loadEnd, 
      loadDuration, 
      totalDuration 
    }));
    
    if (DEBUG_OPTIMIZED_IMAGE) {
      console.error(`❌ [${debugLabel}] Image failed (${loadDuration}ms): ${shortUri}`, error);
    }
    
    // Try fallback if available
    if (fallbackSource && fallbackSource !== finalSource) {
      if (DEBUG_OPTIMIZED_IMAGE) {
        console.log(`🔄 [${debugLabel}] Switching to fallback: ${extractUriFromSource(fallbackSource)}`);
      }
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
          onLoadStart={handleLoadStart}
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