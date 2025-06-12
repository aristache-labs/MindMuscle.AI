import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Sentry from '@sentry/react-native';
import supabase from './supabase';

export interface UserAvatar {
  url: string;
  userId: string;
}

// Cache for avatar URLs to avoid repeated database queries
const avatarCache = new Map<string, UserAvatar>();
// Cache for preloaded avatars
const preloadedAvatarCache = new Map<string, boolean>();

class FirebaseAvatarService {
  /**
   * Get the current avatar for a user
   */
  async getUserAvatar(userId: string): Promise<UserAvatar | null> {
    const startTime = performance.now();

    try {
      // Add breadcrumb for avatar fetch attempt
      Sentry.addBreadcrumb({
        message: 'Avatar fetch started',
        category: 'firebase.avatar.fetch',
        level: 'info',
        data: {
          userId,
          cacheHit: avatarCache.has(userId),
          timestamp: new Date().toISOString(),
        },
      });

      // Check cache first
      if (avatarCache.has(userId)) {
        const cachedAvatar = avatarCache.get(userId) || null;
        const duration = performance.now() - startTime;

        Sentry.addBreadcrumb({
          message: 'Avatar retrieved from cache',
          category: 'firebase.avatar.cache',
          level: 'info',
          data: {
            userId,
            duration_ms: duration.toFixed(2),
            hasAvatar: !!cachedAvatar,
            timestamp: new Date().toISOString(),
          },
        });

        return cachedAvatar;
      }

      // Try to get the avatar URL from user metadata first (fastest)
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (!userError && userData?.user?.user_metadata?.avatar_url) {
        const avatar = {
          url: userData.user.user_metadata.avatar_url,
          userId: userId,
        };

        // Cache the result
        avatarCache.set(userId, avatar);

        const duration = performance.now() - startTime;

        Sentry.addBreadcrumb({
          message: 'Avatar retrieved from user metadata',
          category: 'firebase.avatar.metadata',
          level: 'info',
          data: {
            userId,
            duration_ms: duration.toFixed(2),
            avatarUrl: avatar.url,
            timestamp: new Date().toISOString(),
          },
        });

        return avatar;
      }

      // If not in metadata, check user_profile_details table
      const { data: profileData, error: profileError } = await supabase
        .from('user_profile_details')
        .select('avatar_url')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        const duration = performance.now() - startTime;

        console.error('Error fetching user profile details:', profileError);

        // Capture profile fetch error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'profile_fetch');
          scope.setTag('service', 'firebase_avatar');

          scope.setContext('avatar_profile_error', {
            userId,
            duration_ms: duration.toFixed(2),
            error_message: profileError.message,
            error_code: profileError.code,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(profileError);
        });

        return null;
      }

      if (profileData?.avatar_url) {
        const avatar = {
          url: profileData.avatar_url,
          userId: userId,
        };

        // Cache the result
        avatarCache.set(userId, avatar);

        const duration = performance.now() - startTime;

        Sentry.addBreadcrumb({
          message: 'Avatar retrieved from profile details',
          category: 'firebase.avatar.profile',
          level: 'info',
          data: {
            userId,
            duration_ms: duration.toFixed(2),
            avatarUrl: avatar.url,
            timestamp: new Date().toISOString(),
          },
        });

        return avatar;
      }

      const duration = performance.now() - startTime;

      Sentry.addBreadcrumb({
        message: 'No avatar found for user',
        category: 'firebase.avatar.not_found',
        level: 'info',
        data: {
          userId,
          duration_ms: duration.toFixed(2),
          timestamp: new Date().toISOString(),
        },
      });

      return null;
    } catch (error) {
      const duration = performance.now() - startTime;

      console.error('Error fetching user avatar:', error);

      // Capture avatar fetch error
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'avatar_fetch');
        scope.setTag('service', 'firebase_avatar');

        scope.setContext('avatar_fetch_error', {
          userId,
          duration_ms: duration.toFixed(2),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });

        Sentry.captureException(error);
      });

      return null; // Return null instead of throwing to avoid crashes
    }
  }

  /**
   * Preload the user's avatar for faster display
   * @param userId User ID to preload avatar for
   * @param timeout Optional timeout in milliseconds
   * @returns Promise that resolves when preloading is complete
   */
  async preloadAvatar(userId: string, timeout: number = 5000): Promise<boolean> {
    const startTime = performance.now();

    try {
      // Add breadcrumb for preload attempt
      Sentry.addBreadcrumb({
        message: 'Avatar preload started',
        category: 'firebase.avatar.preload',
        level: 'info',
        data: {
          userId,
          timeout,
          alreadyPreloaded: preloadedAvatarCache.has(userId),
          timestamp: new Date().toISOString(),
        },
      });

      // Skip if already preloaded
      if (preloadedAvatarCache.has(userId)) {
        const duration = performance.now() - startTime;

        Sentry.addBreadcrumb({
          message: 'Avatar already preloaded',
          category: 'firebase.avatar.preload_skip',
          level: 'info',
          data: {
            userId,
            duration_ms: duration.toFixed(2),
            timestamp: new Date().toISOString(),
          },
        });

        return true;
      }

      // Get the avatar URL
      const avatar = await this.getUserAvatar(userId);
      if (!avatar || !avatar.url) {
        const duration = performance.now() - startTime;

        Sentry.addBreadcrumb({
          message: 'No avatar URL available for preload',
          category: 'firebase.avatar.preload_no_url',
          level: 'warning',
          data: {
            userId,
            duration_ms: duration.toFixed(2),
            hasAvatar: !!avatar,
            timestamp: new Date().toISOString(),
          },
        });

        return false;
      }

      // Use Asset API for preloading with timeout
      try {
        const avatarAsset = Asset.fromURI(avatar.url);
        await Promise.race([
          avatarAsset.downloadAsync(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Avatar preload timeout')), timeout),
          ),
        ]);

        // Mark as preloaded
        preloadedAvatarCache.set(userId, true);

        const duration = performance.now() - startTime;

        Sentry.addBreadcrumb({
          message: 'Avatar preloaded successfully',
          category: 'firebase.avatar.preload_success',
          level: 'info',
          data: {
            userId,
            duration_ms: duration.toFixed(2),
            avatarUrl: avatar.url,
            timeout,
            timestamp: new Date().toISOString(),
          },
        });

        return true;
      } catch (error) {
        const duration = performance.now() - startTime;

        console.warn('Error preloading avatar with Asset API:', error);

        // Capture preload error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'avatar_preload');
          scope.setTag('service', 'firebase_avatar');

          scope.setContext('avatar_preload_error', {
            userId,
            avatarUrl: avatar.url,
            timeout,
            duration_ms: duration.toFixed(2),
            error_message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(error);
        });

        return false;
      }
    } catch (error) {
      const duration = performance.now() - startTime;

      console.warn('Error in preloadAvatar:', error);

      // Capture general preload error
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'avatar_preload_general');
        scope.setTag('service', 'firebase_avatar');

        scope.setContext('avatar_preload_general_error', {
          userId,
          timeout,
          duration_ms: duration.toFixed(2),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });

        Sentry.captureException(error);
      });

      return false;
    }
  }

  /**
   * Upload an avatar image to Firebase Storage
   */
  async uploadAvatar(userId: string, uri: string): Promise<UserAvatar> {
    const startTime = performance.now();

    try {
      // Add breadcrumb for upload attempt
      Sentry.addBreadcrumb({
        message: 'Avatar upload started',
        category: 'firebase.avatar.upload',
        level: 'info',
        data: {
          userId,
          isRemoteUri: uri.startsWith('http'),
          timestamp: new Date().toISOString(),
        },
      });

      // Generate a unique file name with timestamp
      const timestamp = Date.now();
      const filename = `${timestamp}_avatar.jpg`;
      const filePath = `user-avatars/${userId}/${filename}`;

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
          scope.setTag('service', 'firebase_avatar');

          scope.setContext('firebase_config_error', {
            userId,
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

      // We'll check if the file is local or remote
      let fileToUpload = uri;

      // If it's a remote URL, we need to download it first
      if (uri.startsWith('http')) {
        const downloadStartTime = performance.now();

        Sentry.addBreadcrumb({
          message: 'Downloading remote avatar image',
          category: 'firebase.avatar.download',
          level: 'info',
          data: {
            userId,
            remoteUri: uri,
            timestamp: new Date().toISOString(),
          },
        });

        const tempLocalUri = FileSystem.cacheDirectory + filename;
        const { uri: downloadedUri } = await FileSystem.downloadAsync(uri, tempLocalUri);
        fileToUpload = downloadedUri;

        const downloadDuration = performance.now() - downloadStartTime;

        Sentry.addBreadcrumb({
          message: 'Remote avatar image downloaded',
          category: 'firebase.avatar.download_complete',
          level: 'info',
          data: {
            userId,
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

      if (uploadResponse.status !== 200) {
        console.error('Upload response:', uploadResponse);

        const error = new Error(`Upload failed with status: ${uploadResponse.status}`);

        // Capture upload error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'avatar_upload_failed');
          scope.setTag('service', 'firebase_avatar');

          scope.setContext('avatar_upload_error', {
            userId,
            uploadStatus: uploadResponse.status,
            uploadDuration_ms: uploadDuration.toFixed(2),
            responseBody: uploadResponse.body,
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
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        console.log('Raw response body:', uploadResponse.body);

        const error = new Error('Failed to parse server response');

        // Capture parse error
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'response_parse_error');
          scope.setTag('service', 'firebase_avatar');

          scope.setContext('response_parse_error', {
            userId,
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
          scope.setTag('service', 'firebase_avatar');

          scope.setContext('download_token_error', {
            userId,
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

      Sentry.addBreadcrumb({
        message: 'Avatar uploaded to Firebase Storage',
        category: 'firebase.avatar.upload_success',
        level: 'info',
        data: {
          userId,
          uploadDuration_ms: uploadDuration.toFixed(2),
          filePath,
          downloadToken,
          timestamp: new Date().toISOString(),
        },
      });

      // Try to get previous avatar URL to delete the file
      await this.deleteOldAvatarImage(userId);

      // Update user_profile_details table with the avatar URL
      const { data: profileDetails, error: fetchError } = await supabase
        .from('user_profile_details')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching user profile details:', fetchError);

        // Capture profile fetch error but don't throw
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'profile_details_fetch');
          scope.setTag('service', 'firebase_avatar');

          scope.setContext('profile_details_fetch_error', {
            userId,
            error_message: fetchError.message,
            error_code: fetchError.code,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(fetchError);
        });
      }

      if (profileDetails?.id) {
        // Profile details exist, update it
        const { error: updateError } = await supabase
          .from('user_profile_details')
          .update({
            avatar_url: downloadURL,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating user_profile_details with avatar URL:', updateError);

          // Capture update error but don't throw
          Sentry.withScope((scope) => {
            scope.setTag('error_type', 'profile_details_update');
            scope.setTag('service', 'firebase_avatar');

            scope.setContext('profile_details_update_error', {
              userId,
              downloadURL,
              error_message: updateError.message,
              error_code: updateError.code,
              timestamp: new Date().toISOString(),
            });

            Sentry.captureException(updateError);
          });
        } else {
          Sentry.addBreadcrumb({
            message: 'Profile details updated with avatar URL',
            category: 'firebase.avatar.profile_update',
            level: 'info',
            data: {
              userId,
              timestamp: new Date().toISOString(),
            },
          });
        }
      } else {
        // Profile details don't exist, create a new record
        const { error: insertError } = await supabase.from('user_profile_details').insert({
          user_id: userId,
          avatar_url: downloadURL,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error('Error inserting user_profile_details with avatar URL:', insertError);

          // Capture insert error but don't throw
          Sentry.withScope((scope) => {
            scope.setTag('error_type', 'profile_details_insert');
            scope.setTag('service', 'firebase_avatar');

            scope.setContext('profile_details_insert_error', {
              userId,
              downloadURL,
              error_message: insertError.message,
              error_code: insertError.code,
              timestamp: new Date().toISOString(),
            });

            Sentry.captureException(insertError);
          });
        } else {
          Sentry.addBreadcrumb({
            message: 'Profile details created with avatar URL',
            category: 'firebase.avatar.profile_create',
            level: 'info',
            data: {
              userId,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Update user metadata with avatar URL too for quick access
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: downloadURL,
        },
      });

      if (updateError) {
        console.error('Error updating user metadata with avatar URL:', updateError);

        // Capture metadata update error but don't throw
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'user_metadata_update');
          scope.setTag('service', 'firebase_avatar');

          scope.setContext('user_metadata_update_error', {
            userId,
            downloadURL,
            error_message: updateError.message,
            error_code: updateError.code,
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(updateError);
        });
      } else {
        Sentry.addBreadcrumb({
          message: 'User metadata updated with avatar URL',
          category: 'firebase.avatar.metadata_update',
          level: 'info',
          data: {
            userId,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const avatar = {
        url: downloadURL,
        userId,
      };

      // Update cache
      avatarCache.set(userId, avatar);
      // Clear preload cache since we have a new avatar
      preloadedAvatarCache.delete(userId);

      const totalDuration = performance.now() - startTime;

      Sentry.addBreadcrumb({
        message: 'Avatar upload completed successfully',
        category: 'firebase.avatar.upload_complete',
        level: 'info',
        data: {
          userId,
          totalDuration_ms: totalDuration.toFixed(2),
          uploadDuration_ms: uploadDuration.toFixed(2),
          downloadURL,
          timestamp: new Date().toISOString(),
        },
      });

      // Track performance if upload was slow
      if (totalDuration > 10000) {
        Sentry.captureMessage(
          `Slow avatar upload detected: ${totalDuration.toFixed(2)}ms`,
          'warning',
        );
      }

      return avatar;
    } catch (error) {
      const totalDuration = performance.now() - startTime;

      console.error('Error uploading avatar to Firebase:', error);

      // Capture general upload error
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'avatar_upload_general');
        scope.setTag('service', 'firebase_avatar');

        scope.setContext('avatar_upload_general_error', {
          userId,
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
   * Clear the avatar cache for a specific user or all users
   */
  clearCache(userId?: string): void {
    try {
      Sentry.addBreadcrumb({
        message: 'Avatar cache cleared',
        category: 'firebase.avatar.cache_clear',
        level: 'info',
        data: {
          userId: userId || 'all_users',
          specificUser: !!userId,
          timestamp: new Date().toISOString(),
        },
      });

      if (userId) {
        avatarCache.delete(userId);
        preloadedAvatarCache.delete(userId);
      } else {
        avatarCache.clear();
        preloadedAvatarCache.clear();
      }
    } catch (error) {
      // Capture cache clear error
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'cache_clear');
        scope.setTag('service', 'firebase_avatar');

        scope.setContext('cache_clear_error', {
          userId: userId || 'all_users',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });

        Sentry.captureException(error);
      });
    }
  }

  /**
   * Delete the old avatar image from Firebase Storage using REST API
   */
  private async deleteOldAvatarImage(userId: string): Promise<void> {
    const startTime = performance.now();

    try {
      // Add breadcrumb for deletion attempt
      Sentry.addBreadcrumb({
        message: 'Old avatar deletion started',
        category: 'firebase.avatar.delete',
        level: 'info',
        data: {
          userId,
          timestamp: new Date().toISOString(),
        },
      });

      // Try to get existing avatar URL
      const avatar = await this.getUserAvatar(userId);

      if (!avatar || !avatar.url || !avatar.url.includes('firebasestorage')) {
        const duration = performance.now() - startTime;

        Sentry.addBreadcrumb({
          message: 'No existing Firebase avatar to delete',
          category: 'firebase.avatar.delete_skip',
          level: 'info',
          data: {
            userId,
            duration_ms: duration.toFixed(2),
            hasAvatar: !!avatar,
            isFirebaseUrl: avatar?.url?.includes('firebasestorage') || false,
            timestamp: new Date().toISOString(),
          },
        });

        return; // No existing avatar or not a Firebase URL
      }

      // Check if Firebase configuration is available
      const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

      if (!storageBucket || !apiKey) {
        console.warn('Firebase configuration not available, skipping avatar deletion');

        Sentry.addBreadcrumb({
          message: 'Firebase config missing - skipping avatar deletion',
          category: 'firebase.avatar.delete_config_missing',
          level: 'warning',
          data: {
            userId,
            hasStorageBucket: !!storageBucket,
            hasApiKey: !!apiKey,
            timestamp: new Date().toISOString(),
          },
        });

        return;
      }

      try {
        // Extract file path from Firebase URL
        const url = new URL(avatar.url);
        const pathname = url.pathname;

        // Handle different Firebase Storage URL formats
        let storagePath;
        if (pathname.includes('/o/')) {
          // URL format: https://firebasestorage.googleapis.com/v0/b/bucket/o/path
          storagePath = decodeURIComponent(pathname.split('/o/')[1].split('?')[0]);
        } else if (avatar.url.includes('firebasestorage')) {
          // Direct path extraction
          const bucketStart = avatar.url.indexOf('.com/') + 5;
          const objectStart = avatar.url.indexOf('/', bucketStart) + 1;
          const queryParamStart = avatar.url.indexOf('?', objectStart);

          storagePath = decodeURIComponent(
            avatar.url.substring(objectStart, queryParamStart !== -1 ? queryParamStart : undefined),
          );
        } else {
          // Assume the path is directly related to the user and filename pattern
          storagePath = `user-avatars/${userId}/${avatar.url.split('/').pop()}`;
        }

        // Delete from Firebase Storage using REST API
        const deleteURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(storagePath)}?key=${apiKey}`;

        const response = await fetch(deleteURL, {
          method: 'DELETE',
        });

        const duration = performance.now() - startTime;

        if (response.ok) {
          console.log('Successfully deleted old avatar from Firebase Storage');

          Sentry.addBreadcrumb({
            message: 'Old avatar deleted successfully',
            category: 'firebase.avatar.delete_success',
            level: 'info',
            data: {
              userId,
              duration_ms: duration.toFixed(2),
              storagePath,
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          console.warn(
            'Failed to delete old avatar, but continuing with upload. Status:',
            response.status,
          );

          Sentry.addBreadcrumb({
            message: 'Old avatar deletion failed',
            category: 'firebase.avatar.delete_failed',
            level: 'warning',
            data: {
              userId,
              duration_ms: duration.toFixed(2),
              responseStatus: response.status,
              storagePath,
              timestamp: new Date().toISOString(),
            },
          });
        }

        // Clear cache for this user
        this.clearCache(userId);
      } catch (storageError) {
        const duration = performance.now() - startTime;

        console.warn('Error deleting old avatar from Firebase Storage:', storageError);

        // Capture storage deletion error but don't throw
        Sentry.withScope((scope) => {
          scope.setTag('error_type', 'avatar_storage_delete');
          scope.setTag('service', 'firebase_avatar');

          scope.setContext('avatar_storage_delete_error', {
            userId,
            avatarUrl: avatar.url,
            duration_ms: duration.toFixed(2),
            error_message: storageError instanceof Error ? storageError.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });

          Sentry.captureException(storageError);
        });
      }
    } catch (error) {
      const duration = performance.now() - startTime;

      console.warn('Error in deleteOldAvatarImage:', error);

      // Capture general deletion error but don't throw
      Sentry.withScope((scope) => {
        scope.setTag('error_type', 'avatar_delete_general');
        scope.setTag('service', 'firebase_avatar');

        scope.setContext('avatar_delete_general_error', {
          userId,
          duration_ms: duration.toFixed(2),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });

        Sentry.captureException(error);
      });
    }
  }
}

export default new FirebaseAvatarService();
