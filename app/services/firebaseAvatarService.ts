import * as FileSystem from 'expo-file-system';
import { ref, deleteObject } from 'firebase/storage';
import { storage } from './firebase';
import supabase from './supabase';
import { Asset } from 'expo-asset';

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
    try {
      // Check cache first
      if (avatarCache.has(userId)) {
        return avatarCache.get(userId) || null;
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

        return avatar;
      }

      // If not in metadata, check user_profile_details table
      const { data: profileData, error: profileError } = await supabase
        .from('user_profile_details')
        .select('avatar_url')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching user profile details:', profileError);
        // No need to throw, we'll just return null
        return null;
      }

      if (profileData?.avatar_url) {
        const avatar = {
          url: profileData.avatar_url,
          userId: userId,
        };

        // Cache the result
        avatarCache.set(userId, avatar);

        return avatar;
      }

      return null;
    } catch (error) {
      console.error('Error fetching user avatar:', error);
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
    try {
      // Skip if already preloaded
      if (preloadedAvatarCache.has(userId)) {
        return true;
      }

      // Get the avatar URL
      const avatar = await this.getUserAvatar(userId);
      if (!avatar || !avatar.url) {
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
        return true;
      } catch (error) {
        console.warn('Error preloading avatar with Asset API:', error);
        return false;
      }
    } catch (error) {
      console.warn('Error in preloadAvatar:', error);
      return false;
    }
  }

  /**
   * Upload an avatar image to Firebase Storage
   */
  async uploadAvatar(userId: string, uri: string): Promise<UserAvatar> {
    try {
      // Generate a unique file name with timestamp
      const timestamp = Date.now();
      const filename = `${timestamp}_avatar.jpg`;
      const filePath = `user-avatars/${userId}/${filename}`;

      // Get Firebase storage bucket and API key from environment variables
      const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

      // Create a temporary Firebase upload URL - include the API key for auth
      const uploadURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?name=${encodeURIComponent(filePath)}&key=${apiKey}`;

      // We'll check if the file is local or remote
      let fileToUpload = uri;

      // If it's a remote URL, we need to download it first
      if (uri.startsWith('http')) {
        const tempLocalUri = FileSystem.cacheDirectory + filename;
        const { uri: downloadedUri } = await FileSystem.downloadAsync(uri, tempLocalUri);
        fileToUpload = downloadedUri;
      }

      // Upload using FileSystem uploadAsync (works in Expo Go)
      const uploadResponse = await FileSystem.uploadAsync(uploadURL, fileToUpload, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      });

      if (uploadResponse.status !== 200) {
        console.error('Upload response:', uploadResponse);
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }

      // Parse the response to get the download token
      let responseData;
      try {
        responseData = JSON.parse(uploadResponse.body);
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        console.log('Raw response body:', uploadResponse.body);
        throw new Error('Failed to parse server response');
      }

      // Check if the download token exists
      const downloadToken = responseData.downloadTokens;
      if (!downloadToken) {
        console.error('No download token in response:', responseData);
        throw new Error('No download token in response');
      }

      // Construct the download URL with both token and API key
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}&key=${apiKey}`;

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
        // Continue anyway, as the avatar is still saved in the user_profile_details table
      }

      const avatar = {
        url: downloadURL,
        userId,
      };

      // Update cache
      avatarCache.set(userId, avatar);
      // Clear preload cache since we have a new avatar
      preloadedAvatarCache.delete(userId);

      return avatar;
    } catch (error) {
      console.error('Error uploading avatar to Firebase:', error);
      throw error;
    }
  }

  /**
   * Clear the avatar cache for a specific user or all users
   */
  clearCache(userId?: string): void {
    if (userId) {
      avatarCache.delete(userId);
      preloadedAvatarCache.delete(userId);
    } else {
      avatarCache.clear();
      preloadedAvatarCache.clear();
    }
  }

  /**
   * Delete the old avatar image from Firebase Storage
   */
  private async deleteOldAvatarImage(userId: string): Promise<void> {
    try {
      // Try to get existing avatar URL
      const avatar = await this.getUserAvatar(userId);

      if (!avatar || !avatar.url || !avatar.url.includes('firebasestorage')) {
        return; // No existing avatar or not a Firebase URL
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

        // Delete from Firebase Storage
        if (!storage) {
          console.error('Firebase storage is not initialized');
          throw new Error('Firebase storage is not available');
        }
        const photoRef = ref(storage, storagePath);
        await deleteObject(photoRef);

        // Clear cache for this user
        this.clearCache(userId);
      } catch (storageError) {
        console.error('Error deleting old avatar from Firebase Storage:', storageError);
        // Continue even if deletion fails
      }
    } catch (error) {
      console.error('Error in deleteOldAvatarImage:', error);
      // Don't throw, just log the error
    }
  }
}

export default new FirebaseAvatarService();
