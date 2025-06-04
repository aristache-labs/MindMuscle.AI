import { Image, ImageContentFit } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import * as Sentry from '@sentry/react-native';
import { addImageToCache, markAsImportantImage } from '../utils/imagePreloader';

// Get screen dimensions for optimization
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

// Debug flag - set to false to reduce logging
export const DEBUG_OPTIMIZED_IMAGE = false;

// Track usage statistics with Sentry integration
let imageRenderCount = 0;
let imageLoadSuccessCount = 0;
let imageLoadErrorCount = 0;
let cacheHitCount = 0;
let cacheMissCount = 0;
let totalLoadTime = 0;
let svgRenderCount = 0;
let fallbackUsageCount = 0;

// Track image sizes for memory usage analysis
const imageSizeStats: { totalPixels: number; averageSize: number; requestCount: number } = {
  totalPixels: 0,
  averageSize: 0,
  requestCount: 0,
};

// Log usage statistics periodically with Sentry
if (DEBUG_OPTIMIZED_IMAGE) {
  // Setup interval to log image usage statistics every 10 seconds
  setInterval(() => {
    if (imageRenderCount > 0) {
      console.log(`📊 [OptimizedImage] Rendering stats - Total: ${imageRenderCount}`);

      // Send comprehensive stats to Sentry
      Sentry.addBreadcrumb({
        message: 'OptimizedImage usage statistics',
        category: 'performance.stats',
        data: {
          totalRenders: imageRenderCount,
          loadSuccess: imageLoadSuccessCount,
          loadErrors: imageLoadErrorCount,
          cacheHits: cacheHitCount,
          cacheMisses: cacheMissCount,
          averageLoadTime:
            totalLoadTime > 0 ? (totalLoadTime / imageLoadSuccessCount).toFixed(2) + 'ms' : '0ms',
          svgRenders: svgRenderCount,
          fallbackUsage: fallbackUsageCount,
          memoryStats: imageSizeStats,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }, 10000); // 10 seconds
}

// Define proper type for style parameter
type StyleInput = StyleProp<ImageStyle> | ViewStyle | ImageStyle | undefined | null;

// Helper type for dimension values that can come from React Native styles
type DimensionValue = number | string | undefined;

// Helper function to extract dimensions from style array
const extractDimensionsFromArray = (
  styleArray: unknown[],
): { width: DimensionValue; height: DimensionValue } => {
  let width: DimensionValue = undefined;
  let height: DimensionValue = undefined;

  for (const styleItem of styleArray) {
    if (styleItem && typeof styleItem === 'object') {
      if ('width' in styleItem && styleItem.width !== undefined) {
        width = styleItem.width as DimensionValue;
      }
      if ('height' in styleItem && styleItem.height !== undefined) {
        height = styleItem.height as DimensionValue;
      }
    }
  }

  return { width, height };
};

// Helper function to extract dimensions from style object
const extractDimensionsFromObject = (
  styleObject: Record<string, unknown>,
): { width: DimensionValue; height: DimensionValue } => {
  let width: DimensionValue = undefined;
  let height: DimensionValue = undefined;

  if ('width' in styleObject && styleObject.width !== undefined) {
    width = styleObject.width as DimensionValue;
  }
  if ('height' in styleObject && styleObject.height !== undefined) {
    height = styleObject.height as DimensionValue;
  }

  return { width, height };
};

// Helper function to normalize dimension value
const normalizeDimension = (
  dimension: DimensionValue,
  screenSize: number,
  defaultValue: number,
): number => {
  if (typeof dimension === 'string' && dimension.endsWith('%')) {
    const percentage = parseFloat(dimension) / 100;
    return screenSize * percentage;
  } else if (typeof dimension === 'string') {
    return parseFloat(dimension) || defaultValue;
  } else if (dimension === undefined) {
    return defaultValue;
  }
  return Number(dimension);
};

// Helper to determine appropriate image dimensions
const getOptimalImageDimensions = (style: StyleInput): { width: number; height: number } => {
  try {
    let width: DimensionValue = 300; // Default width
    let height: DimensionValue = 300; // Default height

    if (style) {
      if (Array.isArray(style)) {
        const extracted = extractDimensionsFromArray(style);
        if (extracted.width !== undefined) width = extracted.width;
        if (extracted.height !== undefined) height = extracted.height;
      } else if (typeof style === 'object' && style !== null) {
        const extracted = extractDimensionsFromObject(style as Record<string, unknown>);
        if (extracted.width !== undefined) width = extracted.width;
        if (extracted.height !== undefined) height = extracted.height;
      }
    }

    const normalizedWidth = normalizeDimension(width, screenWidth, 300);
    const normalizedHeight = normalizeDimension(height, screenHeight, 300);

    // Track image size statistics for memory analysis
    const pixelCount = normalizedWidth * normalizedHeight;
    imageSizeStats.totalPixels += pixelCount;
    imageSizeStats.requestCount++;
    imageSizeStats.averageSize = imageSizeStats.totalPixels / imageSizeStats.requestCount;

    return { width: normalizedWidth, height: normalizedHeight };
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'OptimizedImage',
        action: 'calculate_dimensions',
      },
      extra: {
        style: JSON.stringify(style),
      },
    });
    return { width: 300, height: 300 }; // Fallback dimensions
  }
};

// Helper function to check if URI is invalid
const isInvalidUri = (uri: unknown): boolean => {
  const invalid =
    !uri ||
    uri === null ||
    uri === undefined ||
    uri === '' ||
    uri === 'null' ||
    uri === 'undefined' ||
    typeof uri !== 'string';

  if (invalid && DEBUG_OPTIMIZED_IMAGE) {
    Sentry.addBreadcrumb({
      message: 'Invalid URI detected',
      category: 'image.validation',
      data: {
        uri: String(uri),
        type: typeof uri,
      },
    });
  }

  return invalid;
};

// Define type for image source - simplified to match expo-image expectations
type ImageSource = string | number | { uri: string; [key: string]: unknown };

// Helper function to process object source with URI
const processObjectSource = (source: ImageSource, style: StyleInput): ImageSource | null => {
  try {
    if (typeof source !== 'object' || source === null || !('uri' in source)) {
      return null;
    }

    const uri = source.uri;

    if (isInvalidUri(uri)) {
      return null;
    }

    const dimensions = getOptimalImageDimensions(style);

    // Don't optimize SVGs, just return as is
    if (typeof uri === 'string' && uri.endsWith('.svg')) {
      svgRenderCount++;
      Sentry.addBreadcrumb({
        message: 'SVG image processed',
        category: 'image.process',
        data: {
          uri,
          dimensions,
        },
      });
      return source;
    }

    // Apply dimension optimization to remote URLs
    const optimizedUri = optimizeImageUri(uri, dimensions);

    Sentry.addBreadcrumb({
      message: 'Object source processed',
      category: 'image.process',
      data: {
        originalUri: uri,
        optimizedUri,
        dimensions,
      },
    });

    return {
      ...source,
      uri: optimizedUri,
    };
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'OptimizedImage',
        action: 'process_object_source',
      },
      extra: {
        source: JSON.stringify(source),
        style: JSON.stringify(style),
      },
    });
    return null;
  }
};

// Helper function to process string source
const processStringSource = (source: string, style: StyleInput): string | null => {
  try {
    if (isInvalidUri(source)) {
      return null;
    }

    const dimensions = getOptimalImageDimensions(style);

    // Don't optimize SVGs, just return as is
    if (source.endsWith('.svg')) {
      svgRenderCount++;
      Sentry.addBreadcrumb({
        message: 'SVG string source processed',
        category: 'image.process',
        data: {
          source,
          dimensions,
        },
      });
      return source;
    }

    // Apply dimension optimization to remote URLs
    const optimizedUri = optimizeImageUri(source, dimensions);

    Sentry.addBreadcrumb({
      message: 'String source processed',
      category: 'image.process',
      data: {
        originalSource: source,
        optimizedUri,
        dimensions,
      },
    });

    return optimizedUri;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'OptimizedImage',
        action: 'process_string_source',
      },
      extra: {
        source,
        style: JSON.stringify(style),
      },
    });
    return null;
  }
};

// Function to add dimensions to image URI
const optimizeImageUri = (uri: string, dimensions: { width: number; height: number }): string => {
  try {
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
    const optimizedUri = `${uri}${separator}width=${maxWidth}&height=${maxHeight}&fit=cover`;

    Sentry.addBreadcrumb({
      message: 'Image URI optimized',
      category: 'image.optimization',
      data: {
        originalUri: uri,
        optimizedUri,
        originalDimensions: dimensions,
        finalDimensions: { width: maxWidth, height: maxHeight },
      },
    });

    return optimizedUri;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'OptimizedImage',
        action: 'optimize_uri',
      },
      extra: {
        uri,
        dimensions,
      },
    });
    return uri; // Return original URI on error
  }
};

// Calculate estimated image size based on dimensions and format
const calculateEstimatedSize = (
  uri: string,
  dimensions: { width: number; height: number },
): number => {
  try {
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

    const finalSize = Math.max(1024, estimatedBytes); // Minimum 1KB

    Sentry.addBreadcrumb({
      message: 'Image size estimated',
      category: 'image.analysis',
      data: {
        uri,
        dimensions,
        pixelCount,
        estimatedBytes: finalSize,
        format: uri.split('.').pop() || 'unknown',
      },
    });

    return finalSize;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'OptimizedImage',
        action: 'calculate_size',
      },
      extra: {
        uri,
        dimensions,
      },
    });
    return 1024; // Fallback to 1KB
  }
};

// Check if source is SVG
const isSvgImage = (source: ImageSource): boolean => {
  try {
    if (typeof source === 'string') {
      return source.endsWith('.svg');
    }
    if (typeof source === 'object' && source !== null && 'uri' in source) {
      return source.uri?.endsWith('.svg') || false;
    }
    return false;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        component: 'OptimizedImage',
        action: 'check_svg',
      },
      extra: {
        source: JSON.stringify(source),
      },
    });
    return false;
  }
};

export interface OptimizedImageProps {
  source: ImageSource;
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
  // Track component mount with Sentry
  useEffect(() => {
    imageRenderCount++;

    Sentry.addBreadcrumb({
      message: 'OptimizedImage component mounted',
      category: 'ui.lifecycle',
      data: {
        debugLabel: debugLabel || 'unnamed',
        priority,
        isImportant,
        showLoader,
        totalRenders: imageRenderCount,
      },
    });

    return () => {
      Sentry.addBreadcrumb({
        message: 'OptimizedImage component unmounted',
        category: 'ui.lifecycle',
        data: {
          debugLabel: debugLabel || 'unnamed',
        },
      });
    };
  }, []);

  // Suppress unused parameter warnings - these are kept for API compatibility
  void cachePolicy;
  void retentionPriority;

  // Reference to track if component is mounted
  const isMounted = useRef(true);
  const loadStartTime = useRef<number>(0);

  // State - simplified to reduce flickering
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if this is an SVG
  const isSvg = useMemo(() => isSvgImage(source), [source]);

  // Helper function to handle number source type
  const handleNumberSource = useCallback(() => {
    Sentry.addBreadcrumb({
      message: 'Local asset image processed',
      category: 'image.process',
      data: {
        debugLabel: debugLabel || 'unnamed',
        sourceType: 'number',
      },
    });
    return source;
  }, [source, debugLabel]);

  // Helper function to handle placeholder source
  const handlePlaceholderSource = useCallback(() => {
    try {
      fallbackUsageCount++;
      Sentry.addBreadcrumb({
        message: 'Placeholder image used',
        category: 'image.fallback',
        data: {
          debugLabel: debugLabel || 'unnamed',
        },
      });
      return require('../../assets/exercises/placeholder.jpg');
    } catch {
      return source;
    }
  }, [source, debugLabel]);

  // Process the source for expo-image with stable memoization
  const processedSource = useMemo(() => {
    try {
      // Handle require() case (static image) - always stable
      if (typeof source === 'number') {
        return handleNumberSource();
      }

      // Handle placeholder images - simplified check
      if (
        typeof source === 'object' &&
        source !== null &&
        'testUri' in source &&
        (!('uri' in source) || !source.uri)
      ) {
        return handlePlaceholderSource();
      }

      // Handle Source object with better validation
      if (typeof source === 'object' && source !== null && 'uri' in source) {
        return processObjectSource(source, style);
      }

      // Handle string URI
      if (typeof source === 'string') {
        return processStringSource(source, style);
      }

      // Fallback to the original source
      return source;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'OptimizedImage',
          action: 'process_source',
        },
        extra: {
          source: JSON.stringify(source),
          debugLabel: debugLabel || 'unnamed',
        },
      });
      return source; // Return original source on error
    }
  }, [source, style, debugLabel, handleNumberSource, handlePlaceholderSource]);

  // Extract dimensions for estimation
  const dimensions = useMemo(() => getOptimalImageDimensions(style), [style]);

  // Synchronously check cache status to prevent flickering
  const isCached = useMemo(() => {
    try {
      // For local assets, always consider cached
      if (typeof processedSource === 'number') {
        cacheHitCount++;
        return true;
      }

      // For SVGs, always consider cached
      if (isSvg) {
        cacheHitCount++;
        return true;
      }

      // For remote images, we'll let the Image component handle caching
      // This prevents async state updates that cause flickering
      cacheMissCount++;
      return false;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'OptimizedImage',
          action: 'check_cache',
        },
        extra: {
          processedSource: JSON.stringify(processedSource),
          isSvg,
        },
      });
      return false;
    }
  }, [processedSource, isSvg]);

  // Mark as important if needed
  useEffect(() => {
    if (isImportant && processedSource) {
      try {
        if (
          typeof processedSource === 'object' &&
          processedSource !== null &&
          'uri' in processedSource &&
          typeof processedSource.uri === 'string'
        ) {
          markAsImportantImage(processedSource.uri);
          Sentry.addBreadcrumb({
            message: 'Image marked as important',
            category: 'image.priority',
            data: {
              uri: processedSource.uri,
              debugLabel: debugLabel || 'unnamed',
            },
          });
        } else if (typeof processedSource === 'string') {
          markAsImportantImage(processedSource);
          Sentry.addBreadcrumb({
            message: 'Image marked as important',
            category: 'image.priority',
            data: {
              uri: processedSource,
              debugLabel: debugLabel || 'unnamed',
            },
          });
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'OptimizedImage',
            action: 'mark_important',
          },
          extra: {
            processedSource: JSON.stringify(processedSource),
            debugLabel: debugLabel || 'unnamed',
          },
        });
      }
    }
  }, [isImportant, processedSource, debugLabel]);

  // Handle load start - simplified to reduce state changes
  const handleLoadStart = () => {
    try {
      loadStartTime.current = performance.now();

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

      Sentry.addBreadcrumb({
        message: 'Image load started',
        category: 'image.loading',
        data: {
          debugLabel: debugLabel || 'unnamed',
          isCached,
          showLoader,
          timestamp: loadStartTime.current,
        },
      });

      if (onLoadStart) {
        onLoadStart();
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'OptimizedImage',
          action: 'handle_load_start',
        },
        extra: {
          debugLabel: debugLabel || 'unnamed',
        },
      });
    }
  };

  // Helper function to add image to cache
  const addToCacheIfPossible = useCallback(() => {
    if (!processedSource || !isMounted.current) return;

    try {
      let uri: string | null = null;

      if (typeof processedSource === 'string') {
        uri = processedSource;
      } else if (
        typeof processedSource === 'object' &&
        processedSource !== null &&
        'uri' in processedSource &&
        typeof processedSource.uri === 'string'
      ) {
        uri = processedSource.uri;
      }

      if (uri) {
        const size = estimatedSize || calculateEstimatedSize(uri, dimensions);
        addImageToCache(uri, size);
      }
    } catch {
      // Ignore cache errors
    }
  }, [processedSource, estimatedSize, dimensions]);

  // Helper function to update load statistics
  const updateLoadStatistics = useCallback(
    (loadDuration: number) => {
      totalLoadTime += loadDuration;
      imageLoadSuccessCount++;

      Sentry.addBreadcrumb({
        message: 'Image load completed',
        category: 'image.loading',
        data: {
          debugLabel: debugLabel || 'unnamed',
          loadDuration: `${loadDuration.toFixed(2)}ms`,
          totalSuccessCount: imageLoadSuccessCount,
          averageLoadTime: `${(totalLoadTime / imageLoadSuccessCount).toFixed(2)}ms`,
        },
      });
    },
    [debugLabel],
  );

  // Handle load end - simplified
  const handleLoadEnd = useCallback(() => {
    try {
      const loadEndTime = performance.now();
      const loadDuration = loadEndTime - loadStartTime.current;

      updateLoadStatistics(loadDuration);
      addToCacheIfPossible();

      // Clear loading state
      if (isMounted.current) {
        setIsLoading(false);
        setHasError(false);
      }

      if (onLoadEnd) {
        onLoadEnd();
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'OptimizedImage',
          action: 'handle_load_end',
        },
        extra: {
          debugLabel: debugLabel || 'unnamed',
        },
      });
    }
  }, [updateLoadStatistics, addToCacheIfPossible, onLoadEnd, debugLabel]);

  // Handle errors - simplified with proper expo-image event type
  const handleError = (event: { error: string }) => {
    try {
      imageLoadErrorCount++;
      const loadDuration = performance.now() - loadStartTime.current;

      if (isMounted.current) {
        setIsLoading(false);
        setHasError(true);

        if (DEBUG_OPTIMIZED_IMAGE) {
          console.error(`🖼️ [OptimizedImage] ${debugLabel || 'Image'} error:`, event);
        }
      }

      Sentry.captureException(new Error(event.error || 'Image loading failed'), {
        tags: {
          component: 'OptimizedImage',
          action: 'image_load_error',
        },
        extra: {
          debugLabel: debugLabel || 'unnamed',
          errorMessage: event.error,
          loadDuration: `${loadDuration.toFixed(2)}ms`,
          totalErrorCount: imageLoadErrorCount,
          processedSource: JSON.stringify(processedSource),
        },
      });

      if (onError) {
        const errorObj = new Error(event.error || 'Image loading failed');
        onError(errorObj);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'OptimizedImage',
          action: 'handle_error_wrapper',
        },
        extra: {
          debugLabel: debugLabel || 'unnamed',
          originalError: event.error,
        },
      });
    }
  };

  // Convert to expo-image contentFit
  function getContentFit(mode: string): ImageContentFit {
    try {
      switch (mode) {
        case 'contain':
          return 'contain';
        case 'cover':
          return 'cover';
        case 'stretch':
          return 'fill';
        case 'center':
          return 'none';
        case 'repeat':
          // React Native's 'repeat' mode doesn't have a direct equivalent in expo-image
          // Use 'fill' to stretch the image which is the closest behavior
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.info(
              `🖼️ [OptimizedImage] Converting 'repeat' mode to 'fill' for expo-image compatibility`,
            );
          }
          return 'fill';
        default:
          // Log unexpected resize modes for debugging
          if (DEBUG_OPTIMIZED_IMAGE) {
            console.warn(
              `🖼️ [OptimizedImage] Unknown resize mode: ${mode}, falling back to 'cover'`,
            );
          }
          Sentry.addBreadcrumb({
            message: 'Unknown resize mode detected',
            category: 'image.config',
            data: {
              mode,
              debugLabel: debugLabel || 'unnamed',
            },
          });
          return 'cover';
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'OptimizedImage',
          action: 'get_content_fit',
        },
        extra: {
          mode,
          debugLabel: debugLabel || 'unnamed',
        },
      });
      return 'cover'; // Safe fallback
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
  const shouldShowLoader =
    isLoading && showLoader && !isCached && !isSvg && processedSource !== null;
  const shouldShowMainImage = processedSource !== null && !shouldShowFallback;

  // Track render decisions
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'OptimizedImage render decisions',
      category: 'image.render',
      data: {
        debugLabel: debugLabel || 'unnamed',
        shouldShowFallback,
        shouldShowLoader,
        shouldShowMainImage,
        hasError,
        processedSourceType: typeof processedSource,
        hasFallback: !!fallback,
      },
    });
  }, [shouldShowFallback, shouldShowLoader, shouldShowMainImage, debugLabel]);

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
          <ActivityIndicator color={loaderColor} size={loaderSize} />
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
