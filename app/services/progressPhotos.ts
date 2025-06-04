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
import supabase from './supabase';
import { validationService } from './validationService';

export interface ProgressPhoto {
  id: string;
  url: string;
  type: 'before' | 'after';
  date: Date;
  userId: string;
}

const PROGRESS_PHOTOS_TABLE = 'progress_photos';
const STORAGE_BUCKET = 'progress-photos';

class ProgressPhotoService {
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

      // Fetch the latest 'before' photo
      const { data: beforeData, error: beforeError } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'before')
        .order('created_at', { ascending: false })
        .limit(1);

      if (beforeError) {
        logger.error('Error fetching before photo', beforeError, {
          context: { userId, operation: 'getLatestPhotos' },
        });
        throw beforeError;
      }

      // Fetch the latest 'after' photo
      const { data: afterData, error: afterError } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'after')
        .order('created_at', { ascending: false })
        .limit(1);

      if (afterError) {
        logger.error('Error fetching after photo', afterError, {
          context: { userId, operation: 'getLatestPhotos' },
        });
        throw afterError;
      }

      logger.info('Photos fetched successfully', {
        context: {
          userId,
          beforeCount: beforeData?.length || 0,
          afterCount: afterData?.length || 0,
        },
      });

      // Format the results
      const result: { before?: ProgressPhoto; after?: ProgressPhoto } = {};

      if (beforeData && beforeData.length > 0) {
        // Validate before photo data
        const validationResult = validationService.validateProgressPhotoRecord(beforeData[0]);
        if (validationResult.success) {
          result.before = {
            id: validationResult.data.id!,
            url: validationResult.data.photo_url,
            type: 'before',
            date: new Date(validationResult.data.taken_at || validationResult.data.created_at!),
            userId: validationResult.data.user_id,
          };
        } else {
          logger.warn('Invalid before photo data received from database', {
            context: { userId, errors: validationResult.errors },
          });
        }
      }

      if (afterData && afterData.length > 0) {
        // Validate after photo data
        const validationResult = validationService.validateProgressPhotoRecord(afterData[0]);
        if (validationResult.success) {
          result.after = {
            id: validationResult.data.id!,
            url: validationResult.data.photo_url,
            type: 'after',
            date: new Date(validationResult.data.taken_at || validationResult.data.created_at!),
            userId: validationResult.data.user_id,
          };
        } else {
          logger.warn('Invalid after photo data received from database', {
            context: { userId, errors: validationResult.errors },
          });
        }
      }

      return result;
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

      const { data, error } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching all photos', error, {
          context: { userId, operation: 'getAllPhotos' },
        });
        throw error;
      }

      // Validate and transform each photo
      const validatedPhotos: ProgressPhoto[] = [];
      for (const photo of data || []) {
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
   * Upload a progress photo
   */
  async uploadPhoto(
    userId: string,
    type: 'before' | 'after',
    uri: string,
    date: Date = new Date(),
  ): Promise<ProgressPhoto> {
    try {
      // Validate upload data
      const uploadData = { userId, type, uri, date };
      const validationResult = validationService.validateProgressPhotoUpload(uploadData);

      if (!validationResult.success) {
        const errorMessage = `Progress photo upload validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        logger.error('Progress photo upload validation failed', new Error(errorMessage), {
          context: { uploadData, errors: validationResult.errors },
        });
        throw new Error(errorMessage);
      }

      logger.info('Uploading progress photo', {
        context: { userId, type, operation: 'uploadPhoto' },
      });

      // Generate a unique file name with timestamp
      const timestamp = Date.now();
      const filename = `${timestamp}_${type}.jpg`;
      const filePath = `${userId}/${filename}`;

      // Read the file as base64
      const fileBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload directly to storage
      logger.info('Uploading file to storage', { context: { filePath } });
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, decode(fileBase64), {
          contentType: CONTENT_TYPES.JPEG,
          upsert: true,
        });

      if (uploadError) {
        logger.error('Error uploading file to storage', uploadError, {
          context: { userId, type, filePath },
        });
        throw uploadError;
      }

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

      logger.info('File uploaded successfully', { context: { publicUrl } });

      // Prepare database record data
      const recordData = {
        user_id: userId,
        type,
        photo_url: publicUrl,
        taken_at: date.toISOString(),
      };

      // Validate record data before insertion
      const recordValidationResult = validationService.validateProgressPhotoRecord(recordData);
      if (!recordValidationResult.success) {
        const errorMessage = `Progress photo record validation failed: ${recordValidationResult.errors.map((e) => e.message).join(', ')}`;
        logger.error('Progress photo record validation failed', new Error(errorMessage), {
          context: { recordData, errors: recordValidationResult.errors },
        });
        throw new Error(errorMessage);
      }

      // Save record to database
      const { data, error } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .insert(recordData)
        .select()
        .single();

      if (error) {
        logger.error('Error saving photo record to database', error, {
          context: { userId, type, publicUrl },
        });
        throw error;
      }

      logger.info('Photo record saved successfully', {
        context: { photoId: data.id, userId, type },
      });

      return {
        id: data.id,
        url: publicUrl,
        type,
        date,
        userId,
      };
    } catch (error) {
      logger.error('Failed to upload progress photo', error as Error, {
        context: { userId, type, operation: 'uploadPhoto' },
      });
      throw error;
    }
  }

  /**
   * Delete a progress photo
   */
  async deletePhoto(userId: string, photoId: string): Promise<void> {
    try {
      console.log(`Deleting photo with ID: ${photoId} for user: ${userId}`);

      // Get the photo record to find the file path
      const { data, error } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('id', photoId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error finding photo record:', error);
        throw error;
      }

      if (!data) {
        console.warn(`No photo found with ID ${photoId} for user ${userId}`);
        return;
      }

      // Extract file path from URL
      // Format: https://[projectref].supabase.co/storage/v1/object/public/progress-photos/[userId]/[filename]
      const url = new URL(data.photo_url);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.findIndex((part) => part === STORAGE_BUCKET);

      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        const filePath = pathParts.slice(bucketIndex + 1).join('/');

        console.log(`Deleting file from storage: ${filePath}`);
        const { error: deleteStorageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([filePath]);

        if (deleteStorageError) {
          console.error('Error deleting file from storage:', deleteStorageError);
          // Continue with DB deletion even if storage delete fails
        }
      }

      // Delete from database
      const { error: deleteDbError } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .delete()
        .eq('id', photoId)
        .eq('user_id', userId);

      if (deleteDbError) {
        console.error('Error deleting photo record from database:', deleteDbError);
        throw deleteDbError;
      }

      console.log(`Successfully deleted photo with ID: ${photoId}`);
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }
}

// Helper function to decode base64
function decode(str: string): Uint8Array {
  // Browser
  if (typeof atob === 'function') {
    return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  }
  // Node
  else {
    try {
      return new Uint8Array(Buffer.from(str, 'base64'));
    } catch {
      throw new Error('Failed to decode base64 string');
    }
  }
}

// Create and export a singleton instance
const progressPhotoService = new ProgressPhotoService();
export default progressPhotoService;
