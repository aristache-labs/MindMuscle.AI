import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, ImageSourcePropType } from 'react-native';
import { Image, ImageStyle } from 'expo-image';
import { ActivityIndicator } from 'react-native-paper';
import { isImagePreloaded, preloadSingleImage } from '../utils/imagePreloader';

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

interface OptimizedImageProps {
  source: string | ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  transition?: number;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
  transparent?: boolean;
  priority?: boolean; // Higher priority images will be preloaded immediately
  skipPreload?: boolean; // Skip preloading attempt for this image (useful when we know it's already preloaded)
}

export default function OptimizedImage({
  source,
  style,
  imageStyle,
  contentFit = 'cover',
  transition = 1000,
  placeholder = blurhash,
  onLoad,
  onError,
  transparent = false,
  priority = false,
  skipPreload = false,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Consider an image loaded if it's not a string URL, or if it's already preloaded
  const [imageLoaded, setImageLoaded] = useState(
    typeof source !== 'string' || (typeof source === 'string' && isImagePreloaded(source))
  );

  // Attempt to preload the image if it's a URL and not already preloaded
  useEffect(() => {
    if (typeof source === 'string' && !isImagePreloaded(source) && !skipPreload) {
      setIsLoading(true);
      
      // Try to preload the image
      const loadImage = async () => {
        try {
          await preloadSingleImage(source);
          setImageLoaded(true);
          setIsLoading(false);
        } catch (error) {
          console.warn('Failed to preload image:', source);
          setIsLoading(false);
        }
      };
      
      // If priority, load immediately, otherwise load with a slight delay to not block UI
      if (priority) {
        loadImage();
      } else {
        const timer = setTimeout(loadImage, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [source, priority, skipPreload]);

  const handleLoad = () => {
    setIsLoading(false);
    setImageLoaded(true);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    if (onError) onError();
  };

  return (
    <View style={[
      styles.container,
      transparent ? styles.transparentContainer : styles.defaultContainer,
      style
    ]}>
      <Image
        style={[StyleSheet.absoluteFill, imageStyle]}
        source={source}
        placeholder={typeof source === 'string' && !imageLoaded ? placeholder : undefined}
        contentFit={contentFit}
        transition={transition}
        onLoad={handleLoad}
        onError={handleError}
        cachePolicy="memory-disk"
      />
      
      {isLoading && !imageLoaded && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#6c47ff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  defaultContainer: {
    backgroundColor: '#f0f0f0',
  },
  transparentContainer: {
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 240, 240, 0.4)',
  },
}); 