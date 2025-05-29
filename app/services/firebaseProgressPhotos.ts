import * as FileSystem from 'expo-file-system';
import { ref, deleteObject } from 'firebase/storage';
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
   * Upload a progress photo to Firebase Storage using FileSystem direct upload
   */
  async uploadPhoto(
    userId: string,
    type: 'before' | 'after',
    uri: string,
    date: Date = new Date(),
  ): Promise<ProgressPhoto> {
    try {
      console.log(`Uploading ${type} photo for user: ${userId} to Firebase Storage`);

      // Generate a unique file name with timestamp
      const timestamp = Date.now();
      const filename = `${timestamp}_${type}.jpg`;
      const filePath = `progress-photos/${userId}/${filename}`;

      // Get Firebase storage bucket and API key from environment variables
      const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;

      // Create a temporary Firebase upload URL - include the API key for auth
      const uploadURL = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o?name=${encodeURIComponent(filePath)}&key=${apiKey}`;

      // Use Expo FileSystem to upload directly
      console.log(`Starting direct upload to Firebase path: ${filePath}`);

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

      // Log the full response for debugging
      console.log('Upload response:', JSON.stringify(uploadResponse, null, 2));

      if (uploadResponse.status !== 200) {
        console.error('Upload response:', uploadResponse);
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }

      // Parse the response to get the download token
      let responseData;
      try {
        responseData = JSON.parse(uploadResponse.body);
        console.log('Parsed response data:', JSON.stringify(responseData, null, 2));
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

      console.log(`File uploaded successfully, download URL: ${downloadURL}`);

      // Generate a UUID for the photo record
      const photoId = generateUniqueId();

      // Save record to database with Firebase URL and explicit ID
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

      if (error) {
        console.error('Error saving photo record to database:', error);
        throw error;
      }

      console.log(`Photo record saved successfully with ID: ${data.id}`);

      return {
        id: data.id,
        url: downloadURL,
        type,
        date,
        userId,
      };
    } catch (error) {
      console.error('Error uploading progress photo to Firebase:', error);
      throw error;
    }
  }

  /**
   * Delete a progress photo from Firebase Storage
   */
  async deletePhoto(userId: string, photoId: string): Promise<void> {
    try {
      console.log(`Deleting photo with ID: ${photoId} for user: ${userId}`);

      // Get the photo record to find the file URL
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
        if (!storage) {
          console.error('Firebase storage is not initialized');
          throw new Error('Firebase storage is not available');
        }
        const photoRef = ref(storage, storagePath);
        await deleteObject(photoRef);
      } catch (storageError) {
        console.error('Error deleting file from Firebase Storage:', storageError);
        // Continue with DB deletion even if storage delete fails
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
      console.error('Error in deletePhoto:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const firebaseProgressPhotoService = new FirebaseProgressPhotoService();
export default firebaseProgressPhotoService;
