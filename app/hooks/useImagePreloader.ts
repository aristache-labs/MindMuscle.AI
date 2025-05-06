import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { ImageSourcePropType } from 'react-native';
import { isImagePreloaded, preloadSingleImage } from '../utils/imagePreloader';

export interface PreloadingStatus {
  loaded: boolean;
  error: string | null;
  progress: number;
}

/**
 * Hook to preload multiple images at once
 * Returns the loading status, error, and progress of the preloading
 */
export function useImagePreloader(imageSources: (string | ImageSourcePropType)[]): PreloadingStatus {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let mounted = true;
    let completedImages = 0;

    const preloadImages = async () => {
      if (!imageSources || imageSources.length === 0) {
        if (mounted) {
          setLoaded(true);
          setProgress(1);
        }
        return;
      }

      try {
        // Filter out already preloaded images
        const imagesToLoad = imageSources.filter(
          source => typeof source === 'string' && !isImagePreloaded(source)
        );
        
        if (imagesToLoad.length === 0) {
          if (mounted) {
            setLoaded(true);
            setProgress(1);
          }
          return;
        }

        await Promise.all(
          imagesToLoad.map(async (source) => {
            try {
              if (typeof source === 'string') {
                await preloadSingleImage(source);
              }
              
              // Update progress
              if (mounted) {
                completedImages++;
                const newProgress = completedImages / imagesToLoad.length;
                setProgress(newProgress);
              }
            } catch (err) {
              // Log error but continue with other images
              console.warn('Error preloading image:', source, err);
            }
          })
        );

        if (mounted) {
          setLoaded(true);
          setProgress(1);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to preload images');
          setProgress(0);
        }
      }
    };

    preloadImages();

    return () => {
      mounted = false;
    };
  }, [imageSources]);

  return { loaded, error, progress };
}

export default useImagePreloader; 