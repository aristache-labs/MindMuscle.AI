// Define content types directly instead of importing from storage.ts
export const CONTENT_TYPES = {
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  JPG: 'image/jpg',
} as const;

import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { logger } from '../utils/logger';
import { apiClient } from './apiClient';
import supabase from './supabase';
import { validationService } from './validationService';
import {
  captureStorageError,
  captureAPIError,
  captureValidationError,
  capturePerformanceError,
  captureNetworkError,
  setContext,
  setTag,
} from './sentry';
import { addBreadcrumb, captureMessage } from './sentry/simpleErrorHandler';

export interface ProgressPhoto {
  id: string;
  url: string;
  type: 'before' | 'after';
  date: Date;
  userId: string;
}

export interface ProgressPhotoUploadResult {
  photo: ProgressPhoto;
  uploadDuration: number;
  fileSize: number;
}

export interface ProgressPhotoStats {
  totalPhotos: number;
  beforePhotos: number;
  afterPhotos: number;
  latestPhotoDate?: Date;
  totalStorageUsed: number;
}

const PROGRESS_PHOTOS_TABLE = 'progress_photos';
const STORAGE_BUCKET = 'progress-photos';

class ProgressPhotoService {
  private static readonly CACHE_TTL = 300000; // 5 minutes

  constructor() {
    // Set service context for Sentry
    setContext('service', {
      name: 'ProgressPhotoService',
      version: '1.0.0',
      features: ['upload', 'download', 'delete', 'sync'],
    });
    setTag('service.type', 'progress_photos');

    addBreadcrumb('ProgressPhotoService initialized', 'system', {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Helper method to validate and transform photo data
   */
  private transformPhotoData(
    photoData: unknown,
    type: 'before' | 'after',
    userId: string,
  ): ProgressPhoto | null {
    const validationResult = validationService.validateProgressPhotoRecord(photoData);

    if (!validationResult.success) {
      const errorMessage = `Invalid ${type} photo data received from database`;
      logger.warn(errorMessage, {
        context: { userId, errors: validationResult.errors },
      });

      // Capture validation error with Sentry
      const validationError = new Error(errorMessage);
      captureValidationError(validationError, 'progressPhotoRecord', photoData);

      addBreadcrumb('Photo data validation failed', 'validation', {
        userId,
        type,
        errors: validationResult.errors,
      });

      return null;
    }

    addBreadcrumb('Photo data validated successfully', 'validation', {
      userId,
      type,
      photoId: validationResult.data.id,
    });

    return {
      id: validationResult.data.id!,
      url: validationResult.data.photo_url,
      type,
      date: new Date(validationResult.data.taken_at || validationResult.data.created_at!),
      userId: validationResult.data.user_id,
    };
  }

  /**
   * Helper method to fetch photos by type
   */
  private async fetchPhotosByType(userId: string, type: 'before' | 'after'): Promise<unknown[]> {
    const startTime = Date.now();

    addBreadcrumb(`Fetching ${type} photos for user`, 'api', {
      userId,
      type,
      operation: 'fetchPhotosByType',
    });

    try {
      const response = await apiClient.get(
        `/rest/v1/${PROGRESS_PHOTOS_TABLE}?user_id=eq.${userId}&type=eq.${type}&order=created_at.desc&limit=1`,
        {
          cache: {
            enabled: true,
            ttl: ProgressPhotoService.CACHE_TTL,
            tags: ['progress-photos', `user:${userId}`, type],
          },
          auth: { required: true },
        },
      );

      const duration = Date.now() - startTime;
      const resultCount = Array.isArray(response.data) ? response.data.length : 0;

      addBreadcrumb(`Photos fetched successfully`, 'api', {
        userId,
        type,
        resultCount,
        duration,
      });

      // Track performance if slow
      if (duration > 2000) {
        capturePerformanceError('Slow photo fetch operation', 'fetch_duration', duration);
      }

      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      const duration = Date.now() - startTime;
      captureAPIError(error as Error, `/rest/v1/${PROGRESS_PHOTOS_TABLE}`, 'progressPhotos');

      addBreadcrumb(`Photo fetch failed`, 'error', {
        userId,
        type,
        duration,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Helper method to process photo response data
   */
  private processPhotoResponse(
    photoData: unknown[],
    type: 'before' | 'after',
    userId: string,
  ): ProgressPhoto | undefined {
    if (photoData.length === 0) {
      return undefined;
    }

    const transformedPhoto = this.transformPhotoData(photoData[0], type, userId);
    return transformedPhoto || undefined;
  }

  /**
   * Get the latest before and after photos for a user
   */
  async getLatestPhotos(
    userId: string,
  ): Promise<{ before?: ProgressPhoto; after?: ProgressPhoto }> {
    const startTime = Date.now();

    addBreadcrumb('Starting getLatestPhotos operation', 'operation', {
      userId,
      operation: 'getLatestPhotos',
    });

    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        const validationError = new Error('Valid user ID is required');
        captureValidationError(validationError, 'userId', userId);
        throw validationError;
      }

      setContext('progress_photos_operation', {
        operation: 'getLatestPhotos',
        userId,
        startTime: new Date(startTime).toISOString(),
      });

      logger.info('Fetching latest photos for user', { context: { userId } });

      // Fetch both photo types in parallel
      const [beforeData, afterData] = await Promise.all([
        this.fetchPhotosByType(userId, 'before'),
        this.fetchPhotosByType(userId, 'after'),
      ]);

      const duration = Date.now() - startTime;

      logger.info('Photos fetched successfully', {
        context: {
          userId,
          beforeCount: beforeData.length,
          afterCount: afterData.length,
        },
      });

      addBreadcrumb('Latest photos fetched successfully', 'operation', {
        userId,
        beforeCount: beforeData.length,
        afterCount: afterData.length,
        duration,
      });

      // Track performance
      if (duration > 3000) {
        capturePerformanceError('Slow getLatestPhotos operation', 'operation_duration', duration);
      }

      // Process and return results
      const result = {
        before: this.processPhotoResponse(beforeData, 'before', userId),
        after: this.processPhotoResponse(afterData, 'after', userId),
      };

      captureMessage('Latest photos retrieved successfully', 'info', {
        category: 'storage_error',
        userId,
        hasBeforePhoto: !!result.before,
        hasAfterPhoto: !!result.after,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error fetching latest photos', error as Error, {
        context: { userId, operation: 'getLatestPhotos' },
      });

      captureStorageError(error as Error, 'progress_photos', 'getLatestPhotos');

      addBreadcrumb('getLatestPhotos operation failed', 'error', {
        userId,
        duration,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Get all progress photos for a user
   */
  async getAllPhotos(userId: string): Promise<ProgressPhoto[]> {
    const startTime = Date.now();

    addBreadcrumb('Starting getAllPhotos operation', 'operation', {
      userId,
      operation: 'getAllPhotos',
    });

    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        const validationError = new Error('Valid user ID is required');
        captureValidationError(validationError, 'userId', userId);
        throw validationError;
      }

      setContext('progress_photos_operation', {
        operation: 'getAllPhotos',
        userId,
        startTime: new Date(startTime).toISOString(),
      });

      const response = await apiClient.get(
        `/rest/v1/${PROGRESS_PHOTOS_TABLE}?user_id=eq.${userId}&order=created_at.desc`,
        {
          cache: { enabled: true, ttl: 300000, tags: ['progress-photos', `user:${userId}`] },
          auth: { required: true },
        },
      );

      const fetchDuration = Date.now() - startTime;
      const responseData = Array.isArray(response.data) ? response.data : [];

      addBreadcrumb('Raw photos fetched from API', 'api', {
        userId,
        rawCount: responseData.length,
        duration: fetchDuration,
      });

      // Validate and transform each photo
      const validatedPhotos: ProgressPhoto[] = [];
      let validationErrors = 0;

      for (const photo of responseData) {
        const validationResult = validationService.validateProgressPhotoRecord(photo);
        if (validationResult.success) {
          validatedPhotos.push({
            id: validationResult.data.id!,
            url: validationResult.data.photo_url,
            type: validationResult.data.type,
            date: new Date(validationResult.data.taken_at || validationResult.data.created_at!),
            userId: validationResult.data.user_id,
          });
        } else {
          validationErrors++;
          logger.warn('Invalid photo data received from database', {
            context: { userId, photoId: photo?.id, errors: validationResult.errors },
          });

          captureValidationError(
            new Error('Invalid photo data from database'),
            'photoRecord',
            photo,
          );
        }
      }

      const totalDuration = Date.now() - startTime;

      logger.info('All photos fetched successfully', {
        context: { userId, count: validatedPhotos.length },
      });

      addBreadcrumb('getAllPhotos completed', 'operation', {
        userId,
        validPhotos: validatedPhotos.length,
        validationErrors,
        totalDuration,
        fetchDuration,
      });

      // Track performance and data quality
      if (totalDuration > 5000) {
        capturePerformanceError('Slow getAllPhotos operation', 'operation_duration', totalDuration);
      }

      if (validationErrors > 0) {
        captureMessage('Photo validation errors detected', 'warning', {
          category: 'validation_error',
          userId,
          validationErrors,
          totalPhotos: responseData.length,
        });
      }

      captureMessage('All photos retrieved successfully', 'info', {
        category: 'storage_error',
        userId,
        photoCount: validatedPhotos.length,
        duration: totalDuration,
      });

      return validatedPhotos;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error fetching all photos', error as Error, {
        context: { userId, operation: 'getAllPhotos' },
      });

      captureAPIError(error as Error, `/rest/v1/${PROGRESS_PHOTOS_TABLE}`, 'progressPhotos');

      addBreadcrumb('getAllPhotos operation failed', 'error', {
        userId,
        duration,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Get progress photo statistics for a user
   */
  async getPhotoStats(userId: string): Promise<ProgressPhotoStats> {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }

      const photos = await this.getAllPhotos(userId);

      const stats: ProgressPhotoStats = {
        totalPhotos: photos.length,
        beforePhotos: photos.filter((p) => p.type === 'before').length,
        afterPhotos: photos.filter((p) => p.type === 'after').length,
        latestPhotoDate: photos.length > 0 ? photos[0].date : undefined,
        totalStorageUsed: 0, // Would need to calculate from actual file sizes
      };

      logger.info('Photo statistics calculated', {
        context: { userId, stats },
      });

      return stats;
    } catch (error) {
      logger.error('Error calculating photo statistics', error as Error, {
        context: { userId },
      });
      throw error;
    }
  }

  /**
   * Upload a progress photo with enhanced error handling and progress tracking
   */
  async uploadPhoto(
    userId: string,
    type: 'before' | 'after',
    uri: string,
    date: Date = new Date(),
  ): Promise<ProgressPhotoUploadResult> {
    const startTime = Date.now();

    addBreadcrumb('Starting photo upload', 'upload', {
      userId,
      type,
      operation: 'uploadPhoto',
    });

    setContext('photo_upload', {
      userId,
      type,
      startTime: new Date(startTime).toISOString(),
      operation: 'uploadPhoto',
    });

    try {
      // Validate upload data
      const uploadValidationData = { userId, type, uri, date };
      const validationResult = validationService.validateProgressPhotoUpload(uploadValidationData);

      if (!validationResult.success) {
        const errorMessage = `Progress photo upload validation failed: ${validationResult.errors?.map((e) => e.message).join(', ')}`;
        logger.error('Progress photo upload validation failed', new Error(errorMessage), {
          context: { uploadData: uploadValidationData, errors: validationResult.errors },
        });

        const validationError = new Error(errorMessage);
        captureValidationError(validationError, 'uploadData', uploadValidationData);

        addBreadcrumb('Upload validation failed', 'validation', {
          userId,
          type,
          errors: validationResult.errors,
        });

        throw validationError;
      }

      addBreadcrumb('Upload validation passed', 'validation', {
        userId,
        type,
      });

      logger.info('Starting progress photo upload', {
        context: { userId, type, uri: uri.substring(0, 50) + '...' },
      });

      // Read the file and get its info
      const fileReadStart = Date.now();
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        const fileError = new Error('File does not exist');
        captureStorageError(fileError, 'local_filesystem', 'file_access');
        throw fileError;
      }

      const fileSize = fileInfo.size || 0;

      addBreadcrumb('File info retrieved', 'file', {
        userId,
        type,
        fileSize,
        exists: fileInfo.exists,
      });

      // Performance tracking for large files
      if (fileSize > 5 * 1024 * 1024) {
        // 5MB
        capturePerformanceError('Large file upload detected', 'file_size', fileSize);
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileReadDuration = Date.now() - fileReadStart;
      addBreadcrumb('File read completed', 'file', {
        userId,
        type,
        fileSize,
        readDuration: fileReadDuration,
      });

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${userId}/${type}/${timestamp}.jpg`;

      // Upload to Supabase Storage
      const storageUploadStart = Date.now();
      addBreadcrumb('Starting storage upload', 'storage', {
        userId,
        type,
        fileName,
        fileSize,
      });

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        logger.error('Error uploading photo to storage', uploadError, {
          context: { userId, type, fileName },
        });

        captureStorageError(uploadError as Error, 'supabase_storage', 'upload');

        addBreadcrumb('Storage upload failed', 'error', {
          userId,
          type,
          fileName,
          error: uploadError.message,
        });

        throw uploadError;
      }

      const storageUploadDuration = Date.now() - storageUploadStart;
      addBreadcrumb('Storage upload completed', 'storage', {
        userId,
        type,
        fileName,
        duration: storageUploadDuration,
      });

      // Get public URL
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);

      // Save photo record to database using API client
      const dbInsertStart = Date.now();
      const photoRecord = {
        user_id: userId,
        type,
        photo_url: urlData.publicUrl,
        taken_at: date.toISOString(),
      };

      addBreadcrumb('Starting database insert', 'database', {
        userId,
        type,
        url: urlData.publicUrl,
      });

      const response = await apiClient.post(`/rest/v1/${PROGRESS_PHOTOS_TABLE}`, photoRecord, {
        auth: { required: true },
        cache: { enabled: false },
      });

      const dbInsertDuration = Date.now() - dbInsertStart;
      addBreadcrumb('Database insert completed', 'database', {
        userId,
        type,
        duration: dbInsertDuration,
      });

      // Invalidate related cache
      await apiClient.invalidateCache(['progress-photos', `user:${userId}`]);

      const uploadDuration = Date.now() - startTime;

      const responseData = response.data as { id: string };
      const photo: ProgressPhoto = {
        id: responseData.id,
        url: urlData.publicUrl,
        type,
        date,
        userId,
      };

      logger.info('Progress photo uploaded successfully', {
        context: {
          userId,
          type,
          photoId: photo.id,
          uploadDuration,
          fileSize,
        },
      });

      // Success message with performance metrics
      captureMessage('Progress photo uploaded successfully', 'info', {
        category: 'storage_error',
        userId,
        type,
        photoId: photo.id,
        uploadDuration,
        fileSize,
        storageUploadDuration,
        dbInsertDuration,
        fileReadDuration,
      });

      addBreadcrumb('Photo upload completed successfully', 'success', {
        userId,
        type,
        photoId: photo.id,
        totalDuration: uploadDuration,
        fileSize,
      });

      // Performance tracking
      if (uploadDuration > 10000) {
        // 10 seconds
        capturePerformanceError('Slow photo upload operation', 'upload_duration', uploadDuration);
      }

      return {
        photo,
        uploadDuration,
        fileSize,
      };
    } catch (error) {
      const uploadDuration = Date.now() - startTime;

      logger.error('Error uploading progress photo', error as Error, {
        context: { userId, type, uploadDuration },
      });

      captureStorageError(error as Error, 'progress_photos', 'uploadPhoto');

      addBreadcrumb('Photo upload failed', 'error', {
        userId,
        type,
        duration: uploadDuration,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Delete a progress photo with proper cleanup
   */
  async deletePhoto(userId: string, photoId: string): Promise<void> {
    const startTime = Date.now();

    addBreadcrumb('Starting photo deletion', 'delete', {
      userId,
      photoId,
      operation: 'deletePhoto',
    });

    setContext('photo_deletion', {
      userId,
      photoId,
      startTime: new Date(startTime).toISOString(),
      operation: 'deletePhoto',
    });

    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        const validationError = new Error('Valid user ID is required');
        captureValidationError(validationError, 'userId', userId);
        throw validationError;
      }
      if (!photoId || typeof photoId !== 'string') {
        const validationError = new Error('Valid photo ID is required');
        captureValidationError(validationError, 'photoId', photoId);
        throw validationError;
      }

      addBreadcrumb('Validation passed for photo deletion', 'validation', {
        userId,
        photoId,
      });

      logger.info('Starting progress photo deletion', {
        context: { userId, photoId },
      });

      // Get photo details first
      const fetchStart = Date.now();
      const { data: photoData, error: fetchError } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('id', photoId)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        logger.error('Error fetching photo for deletion', fetchError as Error, {
          context: { userId, photoId },
        });

        captureAPIError(fetchError as Error, `/rest/v1/${PROGRESS_PHOTOS_TABLE}`, 'progressPhotos');
        addBreadcrumb('Photo fetch for deletion failed', 'error', {
          userId,
          photoId,
          error: fetchError.message,
        });

        throw fetchError;
      }

      if (!photoData) {
        const notFoundError = new Error('Photo not found or access denied');
        captureStorageError(notFoundError, 'progress_photos', 'photo_not_found');
        throw notFoundError;
      }

      const fetchDuration = Date.now() - fetchStart;
      addBreadcrumb('Photo details fetched for deletion', 'database', {
        userId,
        photoId,
        type: photoData.type,
        duration: fetchDuration,
      });

      // Extract filename from URL
      const url = new URL(photoData.photo_url);
      const fileName = url.pathname.split('/').pop();

      // Delete from storage
      if (fileName) {
        const storageDeleteStart = Date.now();
        addBreadcrumb('Starting storage deletion', 'storage', {
          userId,
          photoId,
          fileName,
          type: photoData.type,
        });

        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([`${userId}/${photoData.type}/${fileName}`]);

        const storageDeleteDuration = Date.now() - storageDeleteStart;

        if (storageError) {
          logger.warn('Error deleting photo from storage', {
            context: { userId, photoId, fileName, error: storageError },
          });

          captureStorageError(storageError as Error, 'supabase_storage', 'delete');
          addBreadcrumb('Storage deletion failed (continuing)', 'warning', {
            userId,
            photoId,
            fileName,
            duration: storageDeleteDuration,
            error: storageError.message,
          });
          // Continue with database deletion even if storage deletion fails
        } else {
          addBreadcrumb('Storage deletion completed', 'storage', {
            userId,
            photoId,
            fileName,
            duration: storageDeleteDuration,
          });
        }
      }

      // Delete from database using API client
      const dbDeleteStart = Date.now();
      addBreadcrumb('Starting database deletion', 'database', {
        userId,
        photoId,
        type: photoData.type,
      });

      await apiClient.delete(
        `/rest/v1/${PROGRESS_PHOTOS_TABLE}?id=eq.${photoId}&user_id=eq.${userId}`,
        {
          auth: { required: true },
        },
      );

      const dbDeleteDuration = Date.now() - dbDeleteStart;
      addBreadcrumb('Database deletion completed', 'database', {
        userId,
        photoId,
        duration: dbDeleteDuration,
      });

      // Invalidate related cache
      await apiClient.invalidateCache(['progress-photos', `user:${userId}`]);

      const totalDuration = Date.now() - startTime;

      logger.info('Progress photo deleted successfully', {
        context: { userId, photoId, type: photoData.type },
      });

      captureMessage('Progress photo deleted successfully', 'info', {
        category: 'storage_error',
        userId,
        photoId,
        type: photoData.type,
        totalDuration,
        fetchDuration,
        dbDeleteDuration,
      });

      addBreadcrumb('Photo deletion completed successfully', 'success', {
        userId,
        photoId,
        type: photoData.type,
        totalDuration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error deleting progress photo', error as Error, {
        context: { userId, photoId },
      });

      captureStorageError(error as Error, 'progress_photos', 'deletePhoto');

      addBreadcrumb('Photo deletion failed', 'error', {
        userId,
        photoId,
        duration,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Sync progress photos with cloud storage
   */
  async syncPhotos(userId: string): Promise<{ synced: number; errors: number }> {
    const startTime = Date.now();

    addBreadcrumb('Starting photo sync operation', 'sync', {
      userId,
      operation: 'syncPhotos',
    });

    setContext('photo_sync', {
      userId,
      startTime: new Date(startTime).toISOString(),
      operation: 'syncPhotos',
    });

    try {
      logger.info('Starting progress photos sync', { context: { userId } });

      const localPhotos = await this.getAllPhotos(userId);
      let synced = 0;
      let errors = 0;

      addBreadcrumb('Starting photo accessibility verification', 'sync', {
        userId,
        totalPhotos: localPhotos.length,
      });

      for (const photo of localPhotos) {
        try {
          // Verify photo exists in storage
          const checkStart = Date.now();
          const response = await fetch(photo.url, { method: 'HEAD' });
          const checkDuration = Date.now() - checkStart;

          if (response.ok) {
            synced++;
            addBreadcrumb('Photo accessible', 'sync', {
              userId,
              photoId: photo.id,
              type: photo.type,
              duration: checkDuration,
              status: response.status,
            });
          } else {
            errors++;
            logger.warn('Photo not accessible in storage', {
              context: { userId, photoId: photo.id, url: photo.url },
            });

            captureStorageError(
              new Error(`Photo not accessible: ${response.status}`),
              'supabase_storage',
              'accessibility_check',
            );

            addBreadcrumb('Photo not accessible', 'sync', {
              userId,
              photoId: photo.id,
              type: photo.type,
              status: response.status,
              duration: checkDuration,
            });
          }
        } catch (error) {
          errors++;
          logger.warn('Error checking photo accessibility', {
            context: { userId, photoId: photo.id, error: (error as Error).message },
          });

          captureNetworkError(error as Error, photo.url, 'HEAD', undefined);

          addBreadcrumb('Photo accessibility check failed', 'error', {
            userId,
            photoId: photo.id,
            type: photo.type,
            error: (error as Error).message,
          });
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Progress photos sync completed', {
        context: { userId, synced, errors, total: localPhotos.length },
      });

      addBreadcrumb('Photo sync completed', 'sync', {
        userId,
        synced,
        errors,
        total: localPhotos.length,
        duration,
      });

      // Capture performance and quality metrics
      if (duration > 10000) {
        // 10 seconds
        capturePerformanceError('Slow photo sync operation', 'sync_duration', duration);
      }

      if (errors > 0) {
        captureMessage('Photo sync completed with errors', 'warning', {
          category: 'storage_error',
          userId,
          synced,
          errors,
          totalPhotos: localPhotos.length,
          duration,
        });
      } else {
        captureMessage('Photo sync completed successfully', 'info', {
          category: 'storage_error',
          userId,
          synced,
          totalPhotos: localPhotos.length,
          duration,
        });
      }

      return { synced, errors };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Error syncing progress photos', error as Error, {
        context: { userId },
      });

      captureStorageError(error as Error, 'progress_photos', 'syncPhotos');

      addBreadcrumb('Photo sync operation failed', 'error', {
        userId,
        duration,
        error: (error as Error).message,
      });

      throw error;
    }
  }
}

// Helper function to decode base64 string to Uint8Array
function decode(str: string): Uint8Array {
  const binaryString = Buffer.from(str, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Initialize the service with Sentry tracking
export const progressPhotoService = new ProgressPhotoService();

// Track service initialization
addBreadcrumb('ProgressPhotoService singleton created', 'system', {
  timestamp: new Date().toISOString(),
  service: 'progressPhotos',
});

captureMessage('ProgressPhotoService initialized successfully', 'info', {
  category: 'javascript_error',
  service: 'progressPhotos',
  features: ['upload', 'download', 'delete', 'sync'],
});

export default progressPhotoService;
