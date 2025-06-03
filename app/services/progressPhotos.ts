// Define content types directly instead of importing from storage.ts
export const CONTENT_TYPES = {
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  JPG: 'image/jpg',
} as const;

import supabase from './supabase';
import * as FileSystem from 'expo-file-system';
import { Buffer } from 'buffer';

export interface ProgressPhoto {
  id: string;
  url: string;
  type: 'before' | 'after';
  date: Date;
  userId: string;
}

// Define the database record type
interface ProgressPhotoRecord {
  id: string;
  user_id: string;
  photo_url: string;
  type: 'before' | 'after';
  created_at: string;
  taken_at: string;
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
      console.log(`Fetching latest photos for user: ${userId}`);

      // Fetch the latest 'before' photo
      const { data: beforeData, error: beforeError } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'before')
        .order('created_at', { ascending: false })
        .limit(1);

      if (beforeError) {
        console.error('Error fetching before photo:', beforeError);
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
        console.error('Error fetching after photo:', afterError);
        throw afterError;
      }

      console.log(
        `Found photos - before: ${beforeData?.length || 0}, after: ${afterData?.length || 0}`,
      );

      // Format the results
      const result: { before?: ProgressPhoto; after?: ProgressPhoto } = {};

      if (beforeData && beforeData.length > 0) {
        result.before = {
          id: beforeData[0].id,
          url: beforeData[0].photo_url,
          type: 'before',
          date: new Date(beforeData[0].taken_at || beforeData[0].created_at),
          userId: beforeData[0].user_id,
        };
      }

      if (afterData && afterData.length > 0) {
        result.after = {
          id: afterData[0].id,
          url: afterData[0].photo_url,
          type: 'after',
          date: new Date(afterData[0].taken_at || afterData[0].created_at),
          userId: afterData[0].user_id,
        };
      }

      return result;
    } catch (error) {
      console.error('Error fetching latest photos:', error);
      throw error;
    }
  }

  /**
   * Get all progress photos for a user
   */
  async getAllPhotos(userId: string): Promise<ProgressPhoto[]> {
    try {
      const { data, error } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((photo: ProgressPhotoRecord) => ({
        id: photo.id,
        url: photo.photo_url,
        type: photo.type,
        date: new Date(photo.taken_at || photo.created_at),
        userId: photo.user_id,
      }));
    } catch (error) {
      console.error('Error fetching all photos:', error);
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
      console.log(`Uploading ${type} photo for user: ${userId}`);

      // Generate a unique file name with timestamp
      const timestamp = Date.now();
      const filename = `${timestamp}_${type}.jpg`;
      const filePath = `${userId}/${filename}`;

      // Read the file as base64
      const fileBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload directly to storage
      console.log(`Uploading file to path: ${filePath}`);
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, decode(fileBase64), {
          contentType: CONTENT_TYPES.JPEG,
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading file to storage:', uploadError);
        throw uploadError;
      }

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

      console.log(`File uploaded successfully, public URL: ${publicUrl}`);

      // Save record to database
      const { data, error } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .insert({
          user_id: userId,
          type,
          photo_url: publicUrl,
          taken_at: date.toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving photo record to database:', error);
        throw error;
      }

      console.log(`Photo record saved successfully with ID: ${data.id}`);

      return {
        id: data.id,
        url: publicUrl,
        type,
        date,
        userId,
      };
    } catch (error) {
      console.error('Error uploading progress photo:', error);
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
