import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../store/AuthContext';
import useImagePreloader from './useImagePreloader';
import { markAsImportantImage } from '../utils/imagePreloader';
import firebaseProgressPhotoService, { ProgressPhoto } from '../services/firebaseProgressPhotos';
import { useSentryDataCollection } from './useSentryDataCollection';

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

  // Initialize Sentry monitoring
  const { setContext, addBreadcrumb, captureException, trackUserAction, setTag } =
    useSentryDataCollection({
      componentName: 'useProgressPhotos',
    });

  // Set initial context
  useEffect(() => {
    setContext('progress_photos', {
      user_id: user?.id || 'anonymous',
      has_before_photo: !!beforePhoto,
      has_after_photo: !!afterPhoto,
    });

    setTag('progress_photos_user', user?.id || 'anonymous');
  }, [user?.id, beforePhoto, afterPhoto]);

  const convertToDisplayPhoto = (photo: ProgressPhoto): DisplayProgressPhoto => ({
    id: photo.id,
    url: photo.url,
    date: photo.date.toISOString(),
  });

  const loadSavedPhotos = async () => {
    if (!user?.id) return;

    const startTime = Date.now();

    addBreadcrumb({
      message: 'Loading saved progress photos',
      category: 'progress-photos',
      level: 'info',
      data: {
        user_id: user.id,
      },
    });

    try {
      setIsLoading(true);
      const latestPhotos = await firebaseProgressPhotoService.getLatestPhotos(user.id);

      const loadDuration = Date.now() - startTime;

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

      addBreadcrumb({
        message: 'Progress photos loaded successfully',
        category: 'progress-photos',
        level: 'info',
        data: {
          load_duration_ms: loadDuration,
          has_before: !!latestPhotos.before,
          has_after: !!latestPhotos.after,
        },
      });

      setContext('photo_load_performance', {
        last_load_duration_ms: loadDuration,
        photos_loaded: (latestPhotos.before ? 1 : 0) + (latestPhotos.after ? 1 : 0),
      });
    } catch (error) {
      const loadDuration = Date.now() - startTime;

      captureException(error as Error, {
        operation: 'load_saved_photos',
        user_id: user.id,
        duration_ms: loadDuration,
      });

      console.error('Error loading saved photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to check permissions
  const checkMediaPermissions = async (type: 'before' | 'after') => {
    const permissionStartTime = Date.now();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const permissionDuration = Date.now() - permissionStartTime;

    addBreadcrumb({
      message: 'Media library permission requested',
      category: 'permissions',
      level: 'info',
      data: {
        permission_status: status,
        duration_ms: permissionDuration,
      },
    });

    if (status !== 'granted') {
      addBreadcrumb({
        message: 'Media library permission denied',
        category: 'permissions',
        level: 'warning',
        data: { photo_type: type },
      });

      Alert.alert(
        'Permission Required',
        'Sorry, we need camera roll permissions to make this work!',
      );
      return false;
    }

    return true;
  };

  // Helper function to delete existing photo
  const deleteExistingPhoto = async (type: 'before' | 'after', userId: string) => {
    const existingPhoto = type === 'before' ? beforePhoto : afterPhoto;
    if (!existingPhoto?.id) return;

    const deleteStartTime = Date.now();
    setIsLoading(true);

    addBreadcrumb({
      message: 'Deleting existing progress photo',
      category: 'progress-photos',
      level: 'info',
      data: {
        photo_type: type,
        photo_id: existingPhoto.id,
      },
    });

    try {
      await firebaseProgressPhotoService.deletePhoto(userId, existingPhoto.id);

      const deleteDuration = Date.now() - deleteStartTime;

      addBreadcrumb({
        message: 'Existing progress photo deleted',
        category: 'progress-photos',
        level: 'info',
        data: {
          photo_type: type,
          delete_duration_ms: deleteDuration,
        },
      });

      if (type === 'before') {
        setBeforePhoto(undefined);
      } else {
        setAfterPhoto(undefined);
      }
    } catch (error) {
      captureException(error as Error, {
        operation: 'delete_existing_photo',
        photo_type: type,
        user_id: userId,
      });

      console.error('Error deleting existing photo:', error);
    }
  };

  // Helper function to handle photo upload
  const handlePhotoUpload = async (options: {
    type: 'before' | 'after';
    imageUri: string;
    userId: string;
    uploadStartTime: number;
    operationStartTime: number;
    fileSize?: number;
    width?: number;
    height?: number;
  }) => {
    const { type, imageUri, userId, uploadStartTime, operationStartTime, fileSize, width, height } =
      options;
    setIsLoading(true);

    addBreadcrumb({
      message: 'Starting progress photo upload',
      category: 'progress-photos',
      level: 'info',
      data: {
        photo_type: type,
        file_size: fileSize || 0,
        image_width: width,
        image_height: height,
      },
    });

    const photo = await firebaseProgressPhotoService.uploadPhoto(
      userId,
      type,
      imageUri,
      new Date(),
    );

    const uploadDuration = Date.now() - uploadStartTime;
    const totalOperationDuration = Date.now() - operationStartTime;

    const displayPhoto = convertToDisplayPhoto(photo);
    if (type === 'before') {
      setBeforePhoto(displayPhoto);
    } else {
      setAfterPhoto(displayPhoto);
    }

    addBreadcrumb({
      message: 'Progress photo uploaded successfully',
      category: 'progress-photos',
      level: 'info',
      data: {
        photo_type: type,
        upload_duration_ms: uploadDuration,
        total_duration_ms: totalOperationDuration,
        photo_id: photo.id,
      },
    });

    setContext('photo_upload_performance', {
      last_upload_duration_ms: uploadDuration,
      last_total_operation_duration_ms: totalOperationDuration,
      successful_uploads: 1,
    });

    trackUserAction('progress_photo_uploaded', {
      photo_type: type,
      upload_duration_ms: uploadDuration,
    });
  };

  const cleanupAndPickImage = async (type: 'before' | 'after') => {
    const operationStartTime = Date.now();

    trackUserAction('progress_photo_selection_started', {
      photo_type: type,
      has_existing_photo: type === 'before' ? !!beforePhoto : !!afterPhoto,
    });

    if (!user?.id) {
      addBreadcrumb({
        message: 'Photo upload attempted without authentication',
        category: 'progress-photos',
        level: 'warning',
        data: { photo_type: type },
      });

      Alert.alert('Authentication Required', 'Please sign in to add progress photos');
      return;
    }

    // Check permissions
    const hasPermission = await checkMediaPermissions(type);
    if (!hasPermission) return;

    // Delete existing photo if it exists
    await deleteExistingPhoto(type, user.id);

    try {
      const imagePickerStartTime = Date.now();

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      const imagePickerDuration = Date.now() - imagePickerStartTime;

      addBreadcrumb({
        message: 'Image picker completed',
        category: 'progress-photos',
        level: 'info',
        data: {
          was_cancelled: result.canceled,
          duration_ms: imagePickerDuration,
          photo_type: type,
        },
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uploadStartTime = Date.now();

        try {
          await handlePhotoUpload({
            type,
            imageUri: result.assets[0].uri,
            userId: user.id,
            uploadStartTime,
            operationStartTime,
            fileSize: result.assets[0].fileSize,
            width: result.assets[0].width,
            height: result.assets[0].height,
          });
        } catch (error) {
          const uploadDuration = Date.now() - uploadStartTime;

          captureException(error as Error, {
            operation: 'upload_progress_photo',
            photo_type: type,
            user_id: user.id,
            upload_duration_ms: uploadDuration,
            file_size: result.assets[0].fileSize || 0,
          });

          console.error('Error uploading photo:', error);
          Alert.alert('Upload Error', 'Failed to upload photo. Please try again.');
        }
      }
    } catch (pickError) {
      const totalDuration = Date.now() - operationStartTime;

      captureException(pickError as Error, {
        operation: 'pick_progress_photo',
        photo_type: type,
        total_duration_ms: totalDuration,
      });

      console.error('Error picking image:', pickError);
      Alert.alert('Selection Error', 'Failed to select photo. Please try again.');
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

    // Track preloading metrics
    if (urls.length > 0) {
      addBreadcrumb({
        message: 'Progress photos queued for preloading',
        category: 'image-preloader',
        level: 'debug',
        data: {
          photo_count: urls.length,
          has_before: !!beforePhoto?.url,
          has_after: !!afterPhoto?.url,
        },
      });
    }

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
      addBreadcrumb({
        message: 'Before photo marked as important',
        category: 'image-cache',
        level: 'debug',
        data: { photo_url: beforePhoto.url },
      });
    }
    if (afterPhoto?.url) {
      markAsImportantImage(afterPhoto.url);
      addBreadcrumb({
        message: 'After photo marked as important',
        category: 'image-cache',
        level: 'debug',
        data: { photo_url: afterPhoto.url },
      });
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
