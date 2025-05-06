import * as FileSystem from 'expo-file-system';
import supabase from './supabase';
import { format } from 'date-fns';
import { Platform } from 'react-native';
import { preloadSingleImage } from '../utils/imagePreloader';
import storageService, { STORAGE_BUCKETS } from './storage';

// Enable/disable detailed logging
const DEBUG_PROGRESS_PHOTOS = true;

export interface ProgressPhoto {
  id: string;
  user_id: string;
  type: 'before' | 'after';
  photo_url: string;
  taken_at: string;
}

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
    const startTime = Date.now();
    if (DEBUG_PROGRESS_PHOTOS) {
      console.log(`🔄 [ProgressPhotoService] Starting upload of ${type} photo for user: ${userId.substring(0, 8)}...`);
    }
    
    try {
      // Get file info for logging
      let fileSize = 0;
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists) {
          // Cast to any to avoid TypeScript errors with size property
          fileSize = (fileInfo as any).size || 0;
          if (DEBUG_PROGRESS_PHOTOS) {
            console.log(`📊 [ProgressPhotoService] Image file size: ${(fileSize / 1024).toFixed(2)} KB`);
          }
        }
      } catch (e) {
        if (DEBUG_PROGRESS_PHOTOS) {
          console.warn(`⚠️ [ProgressPhotoService] Unable to get file size: ${e}`);
        }
      }

      // Generate filename
      const fileName = `${userId}_${type}_${Date.now()}.jpg`;
      const filePath = `${userId}/${fileName}`;

      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`📋 [ProgressPhotoService] Upload path: ${filePath}`);
      }

      // Upload to Supabase Storage using the storage service
      const uploadStart = Date.now();
      const { publicUrl } = await storageService.uploadFromUri(
        STORAGE_BUCKETS.PROGRESS_PHOTOS,
        filePath,
        uri,
        {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        }
      );

      const uploadDuration = Date.now() - uploadStart;
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`⏱️ [ProgressPhotoService] Upload completed in ${uploadDuration}ms`);
        console.log(`🔗 [ProgressPhotoService] Public URL: ${publicUrl.substring(0, 40)}...`);
      }

      // Preload the image immediately after upload to avoid loading placeholders
      const preloadStart = Date.now();
      try {
        // Give high priority to ensure this loads fast
        await preloadSingleImage(publicUrl);
        const preloadDuration = Date.now() - preloadStart;
        
        if (DEBUG_PROGRESS_PHOTOS) {
          console.log(`✅ [ProgressPhotoService] Preloaded uploaded photo in ${preloadDuration}ms`);
        }
      } catch (e) {
        if (DEBUG_PROGRESS_PHOTOS) {
          console.warn(`⚠️ [ProgressPhotoService] Failed to preload uploaded image: ${e}`);
        }
        // Continue anyway as this is not critical
      }

      // Save metadata to database
      const dbStart = Date.now();
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

      if (dbError) {
        if (DEBUG_PROGRESS_PHOTOS) {
          console.error(`❌ [ProgressPhotoService] Database error: ${dbError.message}`);
        }
        throw dbError;
      }

      const dbDuration = Date.now() - dbStart;
      const totalDuration = Date.now() - startTime;
      
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`⏱️ [ProgressPhotoService] Database save completed in ${dbDuration}ms`);
        console.log(`🏁 [ProgressPhotoService] Total operation completed in ${totalDuration}ms`);
        console.log({
          operation: 'uploadPhoto',
          fileSize: `${(fileSize / 1024).toFixed(2)} KB`,
          uploadTime: `${uploadDuration}ms`,
          preloadTime: `${Date.now() - preloadStart}ms`,
          dbTime: `${dbDuration}ms`,
          totalTime: `${totalDuration}ms`,
        });
      }

      return photo;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      if (DEBUG_PROGRESS_PHOTOS) {
        console.error(`❌ [ProgressPhotoService] Upload failed after ${errorTime}ms:`, error);
      }
      throw error;
    }
  },

  /**
   * Gets the latest before and after photos and preloads them
   */
  async getLatestPhotos(userId: string): Promise<{ before?: ProgressPhoto; after?: ProgressPhoto }> {
    const startTime = Date.now();
    if (DEBUG_PROGRESS_PHOTOS) {
      console.log(`🔍 [ProgressPhotoService] Getting latest photos for user: ${userId.substring(0, 8)}...`);
    }
    
    try {
      const queryStart = Date.now();
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false });

      const queryDuration = Date.now() - queryStart;

      if (error) {
        if (DEBUG_PROGRESS_PHOTOS) {
          console.error(`❌ [ProgressPhotoService] Database error: ${error.message}`);
        }
        throw error;
      }

      const photos = data as ProgressPhoto[];
      
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`📊 [ProgressPhotoService] Retrieved ${photos.length} photos in ${queryDuration}ms`);
      }
      
      // Preload photos immediately with high priority
      const preloadStart = Date.now();
      let preloadedCount = 0;
      
      Promise.all(photos.map(async photo => {
        if (photo.photo_url) {
          try {
            await preloadSingleImage(photo.photo_url);
            preloadedCount++;
            if (DEBUG_PROGRESS_PHOTOS) {
              console.log(`✅ [ProgressPhotoService] Preloaded: ${photo.type} photo`);
            }
          } catch (err) {
            if (DEBUG_PROGRESS_PHOTOS) {
              console.warn(`⚠️ [ProgressPhotoService] Failed to preload ${photo.type} photo:`, err);
            }
          }
        }
        return Promise.resolve();
      })).then(() => {
        const preloadDuration = Date.now() - preloadStart;
        if (DEBUG_PROGRESS_PHOTOS && photos.length > 0) {
          console.log(`⏱️ [ProgressPhotoService] Preloaded ${preloadedCount}/${photos.length} photos in ${preloadDuration}ms`);
        }
      }).catch(err => {
        if (DEBUG_PROGRESS_PHOTOS) {
          console.warn(`⚠️ [ProgressPhotoService] Some preloading failed:`, err);
        }
      });
      
      // Find before and after photos
      const before = photos.find(p => p.type === 'before');
      const after = photos.find(p => p.type === 'after');
      
      const totalDuration = Date.now() - startTime;
      
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`🏁 [ProgressPhotoService] Retrieved latest photos in ${totalDuration}ms`);
        console.log({
          operation: 'getLatestPhotos',
          photosCount: photos.length,
          beforePhoto: before ? '✓' : '✗',
          afterPhoto: after ? '✓' : '✗',
          queryTime: `${queryDuration}ms`,
          totalTime: `${totalDuration}ms`,
        });
      }
      
      return {
        before,
        after,
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      if (DEBUG_PROGRESS_PHOTOS) {
        console.error(`❌ [ProgressPhotoService] Failed to get latest photos after ${errorTime}ms:`, error);
      }
      throw error;
    }
  },

  /**
   * Deletes a photo from storage and database
   */
  async deletePhoto(userId: string, photoId: string): Promise<void> {
    const startTime = Date.now();
    if (DEBUG_PROGRESS_PHOTOS) {
      console.log(`🗑️ [ProgressPhotoService] Deleting photo ${photoId} for user: ${userId.substring(0, 8)}...`);
    }
    
    try {
      // Delete from storage using the storage service
      const storageStart = Date.now();
      await storageService.deleteFile(
        STORAGE_BUCKETS.PROGRESS_PHOTOS,
        `${userId}/${photoId}`
      );
      const storageDuration = Date.now() - storageStart;
      
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`⏱️ [ProgressPhotoService] Storage deletion completed in ${storageDuration}ms`);
      }

      // Delete from database
      const dbStart = Date.now();
      const { error: dbError } = await supabase
        .from('progress_photos')
        .delete()
        .eq('id', photoId)
        .eq('user_id', userId);

      const dbDuration = Date.now() - dbStart;

      if (dbError) {
        if (DEBUG_PROGRESS_PHOTOS) {
          console.error(`❌ [ProgressPhotoService] Database deletion error: ${dbError.message}`);
        }
        throw dbError;
      }
      
      const totalDuration = Date.now() - startTime;
      
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`⏱️ [ProgressPhotoService] Database deletion completed in ${dbDuration}ms`);
        console.log(`🏁 [ProgressPhotoService] Deletion completed in ${totalDuration}ms`);
        console.log({
          operation: 'deletePhoto',
          photoId,
          storageTime: `${storageDuration}ms`,
          dbTime: `${dbDuration}ms`,
          totalTime: `${totalDuration}ms`,
        });
      }
    } catch (error) {
      const errorTime = Date.now() - startTime;
      if (DEBUG_PROGRESS_PHOTOS) {
        console.error(`❌ [ProgressPhotoService] Deletion failed after ${errorTime}ms:`, error);
      }
      throw error;
    }
  },

  /**
   * Gets all progress photos for a user and preloads them for fast display
   */
  async getAllPhotos(userId: string): Promise<ProgressPhoto[]> {
    const startTime = Date.now();
    if (DEBUG_PROGRESS_PHOTOS) {
      console.log(`🔍 [ProgressPhotoService] Getting all photos for user: ${userId.substring(0, 8)}...`);
    }
    
    try {
      const queryStart = Date.now();
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false });

      const queryDuration = Date.now() - queryStart;

      if (error) {
        if (DEBUG_PROGRESS_PHOTOS) {
          console.error(`❌ [ProgressPhotoService] Database error: ${error.message}`);
        }
        throw error;
      }

      const photos = data as ProgressPhoto[];
      
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`📊 [ProgressPhotoService] Retrieved ${photos.length} photos in ${queryDuration}ms`);
      }
      
      // Start preloading in the background
      // We don't await this so we can return the data immediately
      setTimeout(() => {
        const preloadStart = Date.now();
        if (DEBUG_PROGRESS_PHOTOS) {
          console.log(`🔄 [ProgressPhotoService] Starting background preload for ${photos.length} photos...`);
        }
        
        // Preload sequentially to reduce bandwidth usage
        const preloadSequentially = async () => {
          let loadedCount = 0;
          let failedCount = 0;
          
          for (const photo of photos) {
            if (photo.photo_url) {
              try {
                const singlePreloadStart = Date.now();
                await preloadSingleImage(photo.photo_url);
                loadedCount++;
                
                const singleLoadTime = Date.now() - singlePreloadStart;
                if (DEBUG_PROGRESS_PHOTOS) {
                  console.log(`✅ [ProgressPhotoService] Preloaded (${loadedCount}/${photos.length}) in ${singleLoadTime}ms: ${photo.type}`);
                }
              } catch (err) {
                failedCount++;
                if (DEBUG_PROGRESS_PHOTOS) {
                  console.warn(`⚠️ [ProgressPhotoService] Failed to preload image:`, err);
                }
                // Continue even if an image fails
              }
            }
          }
          
          const preloadDuration = Date.now() - preloadStart;
          if (DEBUG_PROGRESS_PHOTOS) {
            console.log(`🏁 [ProgressPhotoService] Background preload finished in ${preloadDuration}ms`);
            console.log({
              operation: 'preloadAllPhotos',
              total: photos.length,
              loaded: loadedCount,
              failed: failedCount,
              preloadTime: `${preloadDuration}ms`,
            });
          }
        };
        
        preloadSequentially().catch(err => {
          if (DEBUG_PROGRESS_PHOTOS) {
            console.warn(`❌ [ProgressPhotoService] Background preload failed:`, err);
          }
        });
      }, 100);
      
      const totalDuration = Date.now() - startTime;
      
      if (DEBUG_PROGRESS_PHOTOS) {
        console.log(`🏁 [ProgressPhotoService] Retrieved all photos in ${totalDuration}ms`);
        console.log({
          operation: 'getAllPhotos',
          photosCount: photos.length,
          queryTime: `${queryDuration}ms`,
          totalTime: `${totalDuration}ms`,
        });
      }
      
      return photos;
    } catch (error) {
      const errorTime = Date.now() - startTime;
      if (DEBUG_PROGRESS_PHOTOS) {
        console.error(`❌ [ProgressPhotoService] Failed to get all photos after ${errorTime}ms:`, error);
      }
      throw error;
    }
  }
};

export default progressPhotoService;