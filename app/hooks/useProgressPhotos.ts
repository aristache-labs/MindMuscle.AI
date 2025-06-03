import React, { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../store/AuthContext';
import useImagePreloader from './useImagePreloader';
import { markAsImportantImage } from '../utils/imagePreloader';
import firebaseProgressPhotoService, { ProgressPhoto } from '../services/firebaseProgressPhotos';

interface DisplayProgressPhoto {
  id: string;
  url: string;
  date: string;
}

export const useProgressPhotos = () => {
  const { user } = useAuth();
  const [beforePhoto, setBeforePhoto] = useState<DisplayProgressPhoto | undefined>();
  const [afterPhoto, setAfterPhoto] = useState<DisplayProgressPhoto | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState({ before: false, after: false });

  const convertToDisplayPhoto = (photo: ProgressPhoto): DisplayProgressPhoto => ({
    id: photo.id,
    url: photo.url,
    date: photo.date.toISOString(),
  });

  const loadSavedPhotos = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const latestPhotos = await firebaseProgressPhotoService.getLatestPhotos(user.id);

      if (latestPhotos.before?.url !== beforePhoto?.url) {
        setBeforePhoto(
          latestPhotos.before ? convertToDisplayPhoto(latestPhotos.before) : undefined,
        );
      }

      if (latestPhotos.after?.url !== afterPhoto?.url) {
        setAfterPhoto(latestPhotos.after ? convertToDisplayPhoto(latestPhotos.after) : undefined);
      }

      if (latestPhotos.before?.url) {
        markAsImportantImage(latestPhotos.before.url);
      }
      if (latestPhotos.after?.url) {
        markAsImportantImage(latestPhotos.after.url);
      }
    } catch (error) {
      console.error('Error loading saved photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupAndPickImage = async (type: 'before' | 'after') => {
    if (!user?.id) {
      alert('Please sign in to add progress photos');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    try {
      // Delete existing photo if it exists
      const existingPhoto = type === 'before' ? beforePhoto : afterPhoto;
      if (existingPhoto?.id) {
        setIsLoading(true);
        await firebaseProgressPhotoService.deletePhoto(user.id, existingPhoto.id);

        if (type === 'before') {
          setBeforePhoto(undefined);
        } else {
          setAfterPhoto(undefined);
        }
      }
    } catch (error) {
      console.error('Error deleting existing photo:', error);
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        try {
          setIsLoading(true);
          const photo = await firebaseProgressPhotoService.uploadPhoto(
            user.id,
            type,
            result.assets[0].uri,
            new Date(),
          );

          const displayPhoto = convertToDisplayPhoto(photo);
          if (type === 'before') {
            setBeforePhoto(displayPhoto);
          } else {
            setAfterPhoto(displayPhoto);
          }
        } catch (error) {
          console.error('Error uploading photo:', error);
          alert('Failed to upload photo. Please try again.');
        }
      }
    } catch (pickError) {
      console.error('Error picking image:', pickError);
      alert('Failed to select photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadSavedPhotos();
    }
  }, [user?.id]);

  // Preload progress photos when they're available
  const progressPhotosToPreload = React.useMemo(() => {
    const urls: string[] = [];
    if (beforePhoto?.url) urls.push(beforePhoto.url);
    if (afterPhoto?.url) urls.push(afterPhoto.url);
    return urls;
  }, [beforePhoto?.url, afterPhoto?.url]);

  useImagePreloader(progressPhotosToPreload, {
    priority: 'high',
    debugLabel: 'InsightsProgressPhotos',
    skipIfCached: true,
  });

  // Mark progress photos as important to keep them in memory
  useEffect(() => {
    if (beforePhoto?.url) {
      markAsImportantImage(beforePhoto.url);
    }
    if (afterPhoto?.url) {
      markAsImportantImage(afterPhoto.url);
    }
  }, [beforePhoto?.url, afterPhoto?.url]);

  return {
    beforePhoto,
    afterPhoto,
    isLoading,
    imageLoadError,
    setImageLoadError,
    cleanupAndPickImage,
  };
};
export default function disablewarn() {
  return null;
}
