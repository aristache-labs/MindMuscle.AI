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
      logger.warn(`Invalid ${type} photo data received from database`, {
        context: { userId, errors: validationResult.errors },
      });
      return null;
    }

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

    return Array.isArray(response.data) ? response.data : [];
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
    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }

      logger.info('Fetching latest photos for user', { context: { userId } });

      // Fetch both photo types in parallel
      const [beforeData, afterData] = await Promise.all([
        this.fetchPhotosByType(userId, 'before'),
        this.fetchPhotosByType(userId, 'after'),
      ]);

      logger.info('Photos fetched successfully', {
        context: {
          userId,
          beforeCount: beforeData.length,
          afterCount: afterData.length,
        },
      });

      // Process and return results
      return {
        before: this.processPhotoResponse(beforeData, 'before', userId),
        after: this.processPhotoResponse(afterData, 'after', userId),
      };
    } catch (error) {
      logger.error('Error fetching latest photos', error as Error, {
        context: { userId, operation: 'getLatestPhotos' },
      });
      throw error;
    }
  }

  /**
   * Get all progress photos for a user
   */
  async getAllPhotos(userId: string): Promise<ProgressPhoto[]> {
    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }

      const response = await apiClient.get(
        `/rest/v1/${PROGRESS_PHOTOS_TABLE}?user_id=eq.${userId}&order=created_at.desc`,
        {
          cache: { enabled: true, ttl: 300000, tags: ['progress-photos', `user:${userId}`] },
          auth: { required: true },
        },
      );

      // Validate and transform each photo
      const validatedPhotos: ProgressPhoto[] = [];
      const responseData = Array.isArray(response.data) ? response.data : [];
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
          logger.warn('Invalid photo data received from database', {
            context: { userId, photoId: photo?.id, errors: validationResult.errors },
          });
        }
      }

      logger.info('All photos fetched successfully', {
        context: { userId, count: validatedPhotos.length },
      });

      return validatedPhotos;
    } catch (error) {
      logger.error('Error fetching all photos', error as Error, {
        context: { userId, operation: 'getAllPhotos' },
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

    try {
      // Validate upload data
      const uploadValidationData = { userId, type, uri, date };
      const validationResult = validationService.validateProgressPhotoUpload(uploadValidationData);

      if (!validationResult.success) {
        const errorMessage = `Progress photo upload validation failed: ${validationResult.errors?.map((e) => e.message).join(', ')}`;
        logger.error('Progress photo upload validation failed', new Error(errorMessage), {
          context: { uploadData: uploadValidationData, errors: validationResult.errors },
        });
        throw new Error(errorMessage);
      }

      logger.info('Starting progress photo upload', {
        context: { userId, type, uri: uri.substring(0, 50) + '...' },
      });

      // Read the file and get its info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      const fileSize = fileInfo.size || 0;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${userId}/${type}/${timestamp}.jpg`;

      // Upload to Supabase Storage
      const { data: _uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        logger.error('Error uploading photo to storage', uploadError, {
          context: { userId, type, fileName },
        });
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);

      // Save photo record to database using API client
      const photoRecord = {
        user_id: userId,
        type,
        photo_url: urlData.publicUrl,
        taken_at: date.toISOString(),
      };

      const response = await apiClient.post(`/rest/v1/${PROGRESS_PHOTOS_TABLE}`, photoRecord, {
        auth: { required: true },
        cache: { enabled: false },
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
      throw error;
    }
  }

  /**
   * Delete a progress photo with proper cleanup
   */
  async deletePhoto(userId: string, photoId: string): Promise<void> {
    try {
      // Validate input
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }
      if (!photoId || typeof photoId !== 'string') {
        throw new Error('Valid photo ID is required');
      }

      logger.info('Starting progress photo deletion', {
        context: { userId, photoId },
      });

      // Get photo details first
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
        throw fetchError;
      }

      if (!photoData) {
        throw new Error('Photo not found or access denied');
      }

      // Extract filename from URL
      const url = new URL(photoData.photo_url);
      const fileName = url.pathname.split('/').pop();

      // Delete from storage
      if (fileName) {
        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([`${userId}/${photoData.type}/${fileName}`]);

        if (storageError) {
          logger.warn('Error deleting photo from storage', {
            context: { userId, photoId, fileName, error: storageError },
          });
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database using API client
      await apiClient.delete(
        `/rest/v1/${PROGRESS_PHOTOS_TABLE}?id=eq.${photoId}&user_id=eq.${userId}`,
        {
          auth: { required: true },
        },
      );

      // Invalidate related cache
      await apiClient.invalidateCache(['progress-photos', `user:${userId}`]);

      logger.info('Progress photo deleted successfully', {
        context: { userId, photoId, type: photoData.type },
      });
    } catch (error) {
      logger.error('Error deleting progress photo', error as Error, {
        context: { userId, photoId },
      });
      throw error;
    }
  }

  /**
   * Sync progress photos with cloud storage
   */
  async syncPhotos(userId: string): Promise<{ synced: number; errors: number }> {
    try {
      logger.info('Starting progress photos sync', { context: { userId } });

      const localPhotos = await this.getAllPhotos(userId);
      let synced = 0;
      let errors = 0;

      for (const photo of localPhotos) {
        try {
          // Verify photo exists in storage
          const response = await fetch(photo.url, { method: 'HEAD' });
          if (response.ok) {
            synced++;
          } else {
            errors++;
            logger.warn('Photo not accessible in storage', {
              context: { userId, photoId: photo.id, url: photo.url },
            });
          }
        } catch (error) {
          errors++;
          logger.warn('Error checking photo accessibility', {
            context: { userId, photoId: photo.id, error: (error as Error).message },
          });
        }
      }

      logger.info('Progress photos sync completed', {
        context: { userId, synced, errors, total: localPhotos.length },
      });

      return { synced, errors };
    } catch (error) {
      logger.error('Error syncing progress photos', error as Error, {
        context: { userId },
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

export const progressPhotoService = new ProgressPhotoService();
export default progressPhotoService;
