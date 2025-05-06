import * as FileSystem from 'expo-file-system';
import supabase from './supabase';
import { format } from 'date-fns';
import { Platform } from 'react-native';
import { preloadSingleImage } from '../utils/imagePreloader';

export interface ProgressPhoto {
  id: string;
  user_id: string;
  type: 'before' | 'after';
  photo_url: string;
  taken_at: string;
}

const PHOTOS_BUCKET = 'progress-photos';

export const progressPhotoService = {
  /**
   * Uploads a progress photo and preloads it into the image cache
   */
  async uploadPhoto(
    userId: string, 
    type: 'before' | 'after', 
    uri: string,
    takenAt: Date = new Date()
  ): Promise<ProgressPhoto> {
    try {
      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      // Convert base64 to Uint8Array for upload
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Generate filename
      const fileName = `${userId}_${type}_${Date.now()}.jpg`;
      const filePath = `${userId}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true // Replace if exists
        });

      if (error) throw error;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(PHOTOS_BUCKET)
        .getPublicUrl(filePath);

      // Preload the image immediately after upload to avoid loading placeholders
      try {
        // Give high priority to ensure this loads fast
        await preloadSingleImage(publicUrl);
        console.log('✅ Preloaded uploaded photo successfully:', fileName);
      } catch (e) {
        console.warn('Failed to preload uploaded image:', e);
        // Continue anyway as this is not critical
      }

      // Save metadata to database
      const photo: ProgressPhoto = {
        id: fileName,
        user_id: userId,
        type,
        photo_url: publicUrl,
        taken_at: format(takenAt, 'yyyy-MM-dd'),
      };

      const { error: dbError } = await supabase
        .from('progress_photos')
        .insert(photo);

      if (dbError) throw dbError;

      return photo;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Gets the latest before and after photos and preloads them
   */
  async getLatestPhotos(userId: string): Promise<{ before?: ProgressPhoto; after?: ProgressPhoto }> {
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false });

      if (error) throw error;

      const photos = data as ProgressPhoto[];
      
      // Preload photos immediately with high priority
      Promise.all(photos.map(photo => {
        if (photo.photo_url) {
          return preloadSingleImage(photo.photo_url).catch(() => {
            // Silently continue if preloading fails
          });
        }
        return Promise.resolve();
      })).catch(err => {
        console.warn('Failed to preload some progress photos:', err);
      });
      
      return {
        before: photos.find(p => p.type === 'before'),
        after: photos.find(p => p.type === 'after'),
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Deletes a photo from storage and database
   */
  async deletePhoto(userId: string, photoId: string): Promise<void> {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(PHOTOS_BUCKET)
        .remove([`${userId}/${photoId}`]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('progress_photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', userId);

      if (dbError) throw dbError;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Gets all progress photos for a user and preloads them for fast display
   */
  async getAllPhotos(userId: string): Promise<ProgressPhoto[]> {
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false });

      if (error) throw error;

      const photos = data as ProgressPhoto[];
      
      // Start preloading in the background
      // We don't await this so we can return the data immediately
      setTimeout(() => {
        // Preload sequentially to reduce bandwidth usage
        const preloadSequentially = async () => {
          for (const photo of photos) {
            if (photo.photo_url) {
              await preloadSingleImage(photo.photo_url).catch(() => {
                // Continue even if an image fails
              });
            }
          }
        };
        
        preloadSequentially().catch(err => {
          console.warn('Failed to preload some progress photos in background:', err);
        });
      }, 100);
      
      return photos;
    } catch (error) {
      throw error;
    }
  }
};

export default progressPhotoService;