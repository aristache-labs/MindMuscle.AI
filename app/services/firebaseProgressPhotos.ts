import * as FileSystem from 'expo-file-system';
import { ref, deleteObject } from 'firebase/storage';
import * as Sentry from '@sentry/react-native';
import { storage } from './firebase';
import supabase from './supabase';

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

// Simple function to generate a unique ID without using crypto
function generateUniqueId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

class FirebaseProgressPhotoService {
  /**
   * Get the latest before and after photos for a user
   */
  async getLatestPhotos(
    userId: string,
  ): Promise<{ before?: ProgressPhoto; after?: ProgressPhoto }> {
    const startTime = performance.now();

    try {
      console.log(`Fetching latest photos for user: ${userId}`);

      // Add breadcrumb for latest photos fetch attempt
      Sentry.addBreadcrumb({
        message: 'Latest progress photos fetch started',
        category: 'firebase.progress_photos.fetch_latest',
        level: 'info',
        data: {
          userId,
          timestamp: new Date().toISOString(),
        },
      });

      // Fetch the latest 'before' photo
      const beforeStartTime = performance.now();
      const { data: beforeData, error: beforeError } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'before')
        .order('created_at', { ascending: false })
        .limit(1);

      const beforeDuration = performance.now() - beforeStartTime;

      if (beforeError) {
        console.error('Error fetching before photo:', beforeError);

        // Capture before photo fetch error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'before_photo_fetch');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('before_photo_fetch_error', {
            userId,
            duration_ms: beforeDuration.toFixed(2),
            error_message: beforeError.message,
            error_code: beforeError.code,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(beforeError);
        });

        throw beforeError;
      }

      // Fetch the latest 'after' photo
      const afterStartTime = performance.now();
      const { data: afterData, error: afterError } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'after')
        .order('created_at', { ascending: false })
        .limit(1);

      const afterDuration = performance.now() - afterStartTime;

      if (afterError) {
        console.error('Error fetching after photo:', afterError);

        // Capture after photo fetch error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'after_photo_fetch');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('after_photo_fetch_error', {
            userId,
            duration_ms: afterDuration.toFixed(2),
            error_message: afterError.message,
            error_code: afterError.code,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(afterError);
        });

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

      const totalDuration = performance.now() - startTime;

      // Add success breadcrumb
      Sentry.addBreadcrumb({
        message: 'Latest progress photos fetched successfully',
        category: 'firebase.progress_photos.fetch_latest_success',
        level: 'info',
        data: {
          userId,
          totalDuration_ms: totalDuration.toFixed(2),
          beforeDuration_ms: beforeDuration.toFixed(2),
          afterDuration_ms: afterDuration.toFixed(2),
          beforeCount: beforeData?.length || 0,
          afterCount: afterData?.length || 0,
          hasBeforePhoto: !!result.before,
          hasAfterPhoto: !!result.after,
          timestamp: new Date().toISOString(),
        },
      });

      return result;
    } catch (error) {
      const totalDuration = performance.now() - startTime;

      console.error('Error fetching latest photos:', error);

      // Capture general fetch error
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'latest_photos_fetch_general');
        scope.setTag('service', 'firebase_progress_photos');

        scope.setContext('latest_photos_fetch_error', {
          userId,
          totalDuration_ms: totalDuration.toFixed(2),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });

        Sentry.captureException(error);
      });

      throw error;
    }
  }

  /**
   * Get all progress photos for a user
   */
  async getAllPhotos(userId: string): Promise<ProgressPhoto[]> {
    const startTime = performance.now();

    try {
      // Add breadcrumb for all photos fetch attempt
      Sentry.addBreadcrumb({
        message: 'All progress photos fetch started',
        category: 'firebase.progress_photos.fetch_all',
        level: 'info',
        data: {
          userId,
          timestamp: new Date().toISOString(),
        },
      });

      const { data, error } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        // Capture all photos fetch error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'all_photos_fetch');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('all_photos_fetch_error', {
            userId,
            error_message: error.message,
            error_code: error.code,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(error);
        });

        throw error;
      }

      const photos = (data || []).map((photo: ProgressPhotoRecord) => ({
        id: photo.id,
        url: photo.photo_url,
        type: photo.type,
        date: new Date(photo.taken_at || photo.created_at),
        userId: photo.user_id,
      }));

      const duration = performance.now() - startTime;

      // Add success breadcrumb
      Sentry.addBreadcrumb({
        message: 'All progress photos fetched successfully',
        category: 'firebase.progress_photos.fetch_all_success',
        level: 'info',
        data: {
          userId,
          duration_ms: duration.toFixed(2),
          photoCount: photos.length,
          beforeCount: photos.filter((p) => p.type === 'before').length,
          afterCount: photos.filter((p) => p.type === 'after').length,
          timestamp: new Date().toISOString(),
        },
      });

      return photos;
    } catch (error) {
      const duration = performance.now() - startTime;

      console.error('Error fetching all photos:', error);

      // Capture general all photos fetch error
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'all_photos_fetch_general');
        scope.setTag('service', 'firebase_progress_photos');

        scope.setContext('all_photos_fetch_general_error', {
          userId,
          duration_ms: duration.toFixed(2),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });

        Sentry.captureException(error);
      });

      throw error;
    }
  }

  /**
   * Upload a progress photo to Firebase Storage using FileSystem direct upload
   */
  async uploadPhoto(
    userId: string,
    type: 'before' | 'after',
    uri: string,
    date: Date = new Date(),
  ): Promise<ProgressPhoto> {
    const startTime = performance.now();

    try {
      console.log(`Uploading ${type} photo for user: ${userId} to Firebase Storage`);

      // Add breadcrumb for upload attempt
      Sentry.addBreadcrumb({
        message: 'Progress photo upload started',
        category: 'firebase.progress_photos.upload',
        level: 'info',
        data: {
          userId,
          type,
          isRemoteUri: uri.startsWith('http'),
          date: date.toISOString(),
          timestamp: new Date().toISOString(),
        },
      });

      // Generate a unique file name with timestamp
      const timestamp = Date.now();
      const filename = `${timestamp}_${type}.jpg`;
      const filePath = `progress-photos/${userId}/${filename}`;

      // Get Firebase storage bucket and API key from environment variables
      const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

      if (!storageBucket || !apiKey) {
        const error = new Error(
          'Firebase configuration not available. Please check your environment variables.',
        );

        // Capture configuration error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'firebase_config_missing');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('firebase_config_error', {
            userId,
            type,
            hasStorageBucket: !!storageBucket,
            hasApiKey: !!apiKey,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(error);
        });

        throw error;
      }

      // Create a temporary Firebase upload URL - include the API key for auth
      const uploadURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?name=${encodeURIComponent(filePath)}&key=${apiKey}`;

      // Use Expo FileSystem to upload directly
      console.log(`Starting direct upload to Firebase path: ${filePath}`);

      // We'll check if the file is local or remote
      let fileToUpload = uri;

      // If it's a remote URL, we need to download it first
      if (uri.startsWith('http')) {
        const downloadStartTime = performance.now();

        Sentry.addBreadcrumb({
          message: 'Downloading remote progress photo',
          category: 'firebase.progress_photos.download',
          level: 'info',
          data: {
            userId,
            type,
            remoteUri: uri,
            timestamp: new Date().toISOString(),
          },
        });

        const tempLocalUri = FileSystem.cacheDirectory + filename;
        const { uri: downloadedUri } = await FileSystem.downloadAsync(uri, tempLocalUri);
        fileToUpload = downloadedUri;

        const downloadDuration = performance.now() - downloadStartTime;

        Sentry.addBreadcrumb({
          message: 'Remote progress photo downloaded',
          category: 'firebase.progress_photos.download_complete',
          level: 'info',
          data: {
            userId,
            type,
            downloadDuration_ms: downloadDuration.toFixed(2),
            localUri: downloadedUri,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Upload using FileSystem uploadAsync (works in Expo Go)
      const uploadStartTime = performance.now();

      const uploadResponse = await FileSystem.uploadAsync(uploadURL, fileToUpload, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      });

      const uploadDuration = performance.now() - uploadStartTime;

      // Log the full response for debugging
      console.log('Upload response:', JSON.stringify(uploadResponse, null, 2));

      if (uploadResponse.status !== 200) {
        console.error('Upload response:', uploadResponse);

        const error = new Error(`Upload failed with status: ${uploadResponse.status}`);

        // Capture upload error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'progress_photo_upload_failed');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('progress_photo_upload_error', {
            userId,
            type,
            uploadStatus: uploadResponse.status,
            uploadDuration_ms: uploadDuration.toFixed(2),
            responseBody: uploadResponse.body,
            filePath,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(error);
        });

        throw error;
      }

      // Parse the response to get the download token
      let responseData;
      try {
        responseData = JSON.parse(uploadResponse.body);
        console.log('Parsed response data:', JSON.stringify(responseData, null, 2));
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        console.log('Raw response body:', uploadResponse.body);

        const error = new Error('Failed to parse server response');

        // Capture parse error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'response_parse_error');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('response_parse_error', {
            userId,
            type,
            uploadDuration_ms: uploadDuration.toFixed(2),
            responseBody: uploadResponse.body,
            parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(error);
        });

        throw error;
      }

      // Check if the download token exists
      const downloadToken = responseData.downloadTokens;
      if (!downloadToken) {
        console.error('No download token in response:', responseData);

        const error = new Error('No download token in response');

        // Capture token error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'missing_download_token');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('download_token_error', {
            userId,
            type,
            uploadDuration_ms: uploadDuration.toFixed(2),
            responseData,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(error);
        });

        throw error;
      }

      // Construct the download URL with both token and API key
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}&key=${apiKey}`;

      console.log(`File uploaded successfully, download URL: ${downloadURL}`);

      Sentry.addBreadcrumb({
        message: 'Progress photo uploaded to Firebase Storage',
        category: 'firebase.progress_photos.upload_success',
        level: 'info',
        data: {
          userId,
          type,
          uploadDuration_ms: uploadDuration.toFixed(2),
          filePath,
          downloadToken,
          timestamp: new Date().toISOString(),
        },
      });

      // Generate a UUID for the photo record
      const photoId = generateUniqueId();

      // Save record to database with Firebase URL and explicit ID
      const dbStartTime = performance.now();

      const { data, error } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .insert({
          id: photoId,
          user_id: userId,
          type,
          photo_url: downloadURL,
          taken_at: date.toISOString(),
        })
        .select()
        .single();

      const dbDuration = performance.now() - dbStartTime;

      if (error) {
        console.error('Error saving photo record to database:', error);

        // Capture database save error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'progress_photo_db_save');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('progress_photo_db_save_error', {
            userId,
            type,
            photoId,
            downloadURL,
            dbDuration_ms: dbDuration.toFixed(2),
            error_message: error.message,
            error_code: error.code,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(error);
        });

        throw error;
      }

      console.log(`Photo record saved successfully with ID: ${data.id}`);

      const totalDuration = performance.now() - startTime;

      // Add completion breadcrumb
      Sentry.addBreadcrumb({
        message: 'Progress photo upload completed successfully',
        category: 'firebase.progress_photos.upload_complete',
        level: 'info',
        data: {
          userId,
          type,
          photoId: data.id,
          totalDuration_ms: totalDuration.toFixed(2),
          uploadDuration_ms: uploadDuration.toFixed(2),
          dbDuration_ms: dbDuration.toFixed(2),
          downloadURL,
          timestamp: new Date().toISOString(),
        },
      });

      // Track performance if upload was slow
      if (totalDuration > 15000) {
        Sentry.captureMessage(
          `Slow progress photo upload detected: ${totalDuration.toFixed(2)}ms`,
          'warning',
        );
      }

      return {
        id: data.id,
        url: downloadURL,
        type,
        date,
        userId,
      };
    } catch (error) {
      const totalDuration = performance.now() - startTime;

      console.error('Error uploading progress photo to Firebase:', error);

      // Capture general upload error
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'progress_photo_upload_general');
        scope.setTag('service', 'firebase_progress_photos');

        scope.setContext('progress_photo_upload_general_error', {
          userId,
          type,
          uri,
          totalDuration_ms: totalDuration.toFixed(2),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });

        Sentry.captureException(error);
      });

      throw error;
    }
  }

  /**
   * Delete a progress photo from Firebase Storage
   */
  async deletePhoto(userId: string, photoId: string): Promise<void> {
    const startTime = performance.now();

    try {
      console.log(`Deleting photo with ID: ${photoId} for user: ${userId}`);

      // Add breadcrumb for deletion attempt
      Sentry.addBreadcrumb({
        message: 'Progress photo deletion started',
        category: 'firebase.progress_photos.delete',
        level: 'info',
        data: {
          userId,
          photoId,
          timestamp: new Date().toISOString(),
        },
      });

      // Get the photo record to find the file URL
      const fetchStartTime = performance.now();

      const { data, error } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .select('*')
        .eq('id', photoId)
        .eq('user_id', userId)
        .single();

      const fetchDuration = performance.now() - fetchStartTime;

      if (error) {
        console.error('Error finding photo record:', error);

        // Capture photo record fetch error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'progress_photo_record_fetch');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('progress_photo_record_fetch_error', {
            userId,
            photoId,
            fetchDuration_ms: fetchDuration.toFixed(2),
            error_message: error.message,
            error_code: error.code,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(error);
        });

        throw error;
      }

      if (!data) {
        console.warn(`No photo found with ID ${photoId} for user ${userId}`);

        Sentry.addBreadcrumb({
          message: 'Progress photo not found for deletion',
          category: 'firebase.progress_photos.delete_not_found',
          level: 'warning',
          data: {
            userId,
            photoId,
            fetchDuration_ms: fetchDuration.toFixed(2),
            timestamp: new Date().toISOString(),
          },
        });

        return;
      }

      try {
        // Extract file path from Firebase URL
        const url = new URL(data.photo_url);
        const pathname = url.pathname;

        // Handle different Firebase Storage URL formats
        let storagePath;
        if (pathname.includes('/o/')) {
          // URL format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path
          storagePath = decodeURIComponent(pathname.split('/o/')[1].split('?')[0]);
        } else if (data.photo_url.includes('firebasestorage')) {
          // Direct path extraction
          const bucketStart = data.photo_url.indexOf('.com/') + 5;
          const objectStart = data.photo_url.indexOf('/', bucketStart) + 1;
          const queryParamStart = data.photo_url.indexOf('?', objectStart);

          storagePath = decodeURIComponent(
            data.photo_url.substring(
              objectStart,
              queryParamStart !== -1 ? queryParamStart : undefined,
            ),
          );
        } else {
          // Assume the path is directly related to the user and filename pattern
          storagePath = `progress-photos/${userId}/${data.photo_url.split('/').pop()}`;
        }

        // Delete from Firebase Storage
        console.log(`Deleting file from Firebase Storage: ${storagePath}`);

        const storageDeleteStartTime = performance.now();

        if (!storage) {
          console.error('Firebase storage is not initialized');

          const error = new Error('Firebase storage is not available');

          // Capture storage initialization error
          Sentry.withScope((scope) => {
            scope.setTag('error_type', 'firebase_storage_not_initialized');
            scope.setTag('service', 'firebase_progress_photos');

            scope.setContext('firebase_storage_error', {
              userId,
              photoId,
              storagePath,
              timestamp: new Date().toISOString(),
            });

            Sentry.captureException(error);
          });

          throw error;
        }

        const photoRef = ref(storage, storagePath);
        await deleteObject(photoRef);

        const storageDeleteDuration = performance.now() - storageDeleteStartTime;

        Sentry.addBreadcrumb({
          message: 'Progress photo deleted from Firebase Storage',
          category: 'firebase.progress_photos.storage_delete_success',
          level: 'info',
          data: {
            userId,
            photoId,
            storagePath,
            storageDeleteDuration_ms: storageDeleteDuration.toFixed(2),
            timestamp: new Date().toISOString(),
          },
        });
      } catch (storageError) {
        console.error('Error deleting file from Firebase Storage:', storageError);

        // Capture storage deletion error but continue with DB deletion
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'progress_photo_storage_delete');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('progress_photo_storage_delete_error', {
            userId,
            photoId,
            photoUrl: data.photo_url,
            error_message: storageError instanceof Error ? storageError.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(storageError);
        });
      }

      // Delete from database
      const dbDeleteStartTime = performance.now();

      const { error: deleteDbError } = await supabase
        .from(PROGRESS_PHOTOS_TABLE)
        .delete()
        .eq('id', photoId)
        .eq('user_id', userId);

      const dbDeleteDuration = performance.now() - dbDeleteStartTime;

      if (deleteDbError) {
        console.error('Error deleting photo record from database:', deleteDbError);

        // Capture database deletion error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'progress_photo_db_delete');
          scope.setTag('service', 'firebase_progress_photos');

          scope.setContext('progress_photo_db_delete_error', {
            userId,
            photoId,
            dbDeleteDuration_ms: dbDeleteDuration.toFixed(2),
            error_message: deleteDbError.message,
            error_code: deleteDbError.code,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(deleteDbError);
        });

        throw deleteDbError;
      }

      const totalDuration = performance.now() - startTime;

      console.log(`Successfully deleted photo with ID: ${photoId}`);

      // Add completion breadcrumb
      Sentry.addBreadcrumb({
        message: 'Progress photo deletion completed successfully',
        category: 'firebase.progress_photos.delete_complete',
        level: 'info',
        data: {
          userId,
          photoId,
          totalDuration_ms: totalDuration.toFixed(2),
          fetchDuration_ms: fetchDuration.toFixed(2),
          dbDeleteDuration_ms: dbDeleteDuration.toFixed(2),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      const totalDuration = performance.now() - startTime;

      console.error('Error in deletePhoto:', error);

      // Capture general deletion error
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'progress_photo_delete_general');
        scope.setTag('service', 'firebase_progress_photos');

        scope.setContext('progress_photo_delete_general_error', {
          userId,
          photoId,
          totalDuration_ms: totalDuration.toFixed(2),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });

        Sentry.captureException(error);
      });

      throw error;
    }
  }
}

// Export a singleton instance
const firebaseProgressPhotoService = new FirebaseProgressPhotoService();
export default firebaseProgressPhotoService;
