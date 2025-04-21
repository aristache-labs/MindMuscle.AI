import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { ImageSourcePropType } from 'react-native';

export function useImagePreloader(imageSources: (string | ImageSourcePropType)[]) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const preloadImages = async () => {
      try {
        // Preload all images concurrently
        await Promise.all(
          imageSources.map(async (source) => {
            if (typeof source === 'string' && source.startsWith('http')) {
              await Image.prefetch(source);
            }
            // Local images don't need prefetching as they're bundled with the app
          })
        );

        if (mounted) {
          setLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to preload images');
        }
      }
    };

    preloadImages();

    return () => {
      mounted = false;
    };
  }, [imageSources]);

  return { loaded, error };
} 