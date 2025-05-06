import * as FileSystem from 'expo-file-system';
import supabase from './supabase';
import { decode } from 'base-64';
import { Platform } from 'react-native';

// Storage bucket names
export const STORAGE_BUCKETS = {
  PROGRESS_PHOTOS: 'progress-photos',
  AVATARS: 'avatars',
  PLANS: 'plans'
} as const;

// File types and their content types
export const CONTENT_TYPES = {
  JPEG: 'image/jpeg',
  JPG: 'image/jpeg', // Alias for JPEG
  PNG: 'image/png',
  WEBP: 'image/webp'
} as const;

// File extensions mapping to content types
export const FILE_EXTENSIONS = {
  'jpg': CONTENT_TYPES.JPEG,
  'jpeg': CONTENT_TYPES.JPEG,
  'png': CONTENT_TYPES.PNG,
  'webp': CONTENT_TYPES.WEBP
} as const;

interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

// Custom error class for permission-related errors
export class StoragePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoragePermissionError';
  }
}

class StorageService {
  /**
   * Check if user has access to a bucket
   * @param bucketName The bucket to check access for
   */
  async checkBucketAccess(bucketName: string): Promise<boolean> {
    try {
      // Try to list files - this will fail if no access
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1 });
      
      return !error;
    } catch (error) {
      console.warn(`No access to bucket ${bucketName}:`, error);
      return false;
    }
  }
  
  /**
   * Get current user ID from session
   */
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Ensure the file path starts with the user ID for proper RLS policy enforcement
   * @param filePath Original file path
   * @param userId User ID to enforce in the path
   * @returns Corrected file path
   */
  ensureCorrectPathFormat(filePath: string, userId: string): string {
    // If path is empty or userId is empty, console warn and return a safe path
    if (!filePath || !userId) {
      console.warn('Empty path or userId provided to ensureCorrectPathFormat');
      return userId ? `${userId}/file` : 'file';
    }
    
    // If the path already starts with the user ID, return it as is
    if (filePath.startsWith(`${userId}/`)) {
      return filePath;
    }
    
    // Extract just the filename portion, regardless of path depth
    const fileName = filePath.split('/').pop() || 'file';
    
    // Always create a path with the user ID at the beginning and just the filename
    return `${userId}/${fileName}`;
  }

  /**
   * Ensure filename has an appropriate extension based on content type
   * @param fileName The filename to check/fix
   * @param contentType The content type (MIME type)
   * @returns Filename with proper extension
   */
  ensureFileExtension(fileName: string, contentType?: string): string {
    // If filename already has a valid image extension, return it as is
    if (fileName.includes('.') && /\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
      return fileName;
    }
    
    // Strip any existing extension
    const baseName = fileName.includes('.') 
      ? fileName.substring(0, fileName.lastIndexOf('.')) 
      : fileName;
    
    // Get appropriate extension based on content type
    if (contentType) {
      // Find the extension that matches this content type
      for (const [ext, mimeType] of Object.entries(FILE_EXTENSIONS)) {
        if (mimeType === contentType) {
          return `${baseName}.${ext}`;
        }
      }
    }
    
    // Default to jpg if content type not recognized or not specified
    return `${baseName}.jpg`;
  }
  
  /**
   * Try a direct API approach for avatar upload (avoiding storage RLS)
   * This is a last resort method when normal uploads fail
   */
  private async directApiUpload(
    bucketName: string,
    filePath: string,
    fileData: string | Uint8Array,
    contentType = 'image/jpeg'
  ): Promise<{ publicUrl: string }> {
    try {
      // Get current user ID
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new StoragePermissionError('You must be logged in to upload files');
      }

      // Make sure we have a base64 string (remove data:image/jpeg;base64, if present)
      let base64Data: string;
      if (typeof fileData === 'string') {
        // If it's a base64 string, make sure it doesn't have the prefix
        base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
      } else {
        // Convert Uint8Array to base64
        const binary = Array.from(fileData)
          .map(byte => String.fromCharCode(byte))
          .join('');
        base64Data = btoa(binary);
      }

      // Ensure the file path starts with user ID
      const correctedPath = this.ensureCorrectPathFormat(filePath, userId);
      const fullPath = `${bucketName}/${correctedPath}`;
      
      console.log(`Attempting direct API upload to: ${fullPath}`);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      // Prepare multipart form
      const formData = new FormData();
      let blob;
      
      if (Platform.OS === 'web') {
        // For web
        const byteChars = atob(base64Data);
        const byteArrays = [];
        for (let i = 0; i < byteChars.length; i += 512) {
          const slice = byteChars.slice(i, i + 512);
          const byteNumbers = new Array(slice.length);
          for (let j = 0; j < slice.length; j++) {
            byteNumbers[j] = slice.charCodeAt(j);
          }
          byteArrays.push(new Uint8Array(byteNumbers));
        }
        blob = new Blob(byteArrays, { type: contentType });
      } else {
        // For React Native
        // Convert base64 to Blob-like object
        blob = {
          uri: `data:${contentType};base64,${base64Data}`,
          type: contentType,
          name: correctedPath.split('/').pop()
        };
      }
      
      formData.append('file', blob as any);

      // Get the Supabase project URL - access it correctly
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://jhdcpgriosdjjyakwfhu.supabase.co';
      const apiUrl = `${supabaseUrl}/storage/v1/object/${fullPath}`;
      
      // Make a direct fetch call to the Supabase API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Direct API upload successful:', result);
      
      // Construct the public URL
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${fullPath}`;
      
      return { publicUrl };
    } catch (error) {
      console.error('Error in direct API upload:', error);
      throw error;
    }
  }

  /**
   * Upload a file to a specific bucket
   */
  async uploadFile(
    bucketName: string,
    filePath: string,
    fileData: string | Uint8Array,
    options: UploadOptions = {}
  ) {
    try {
      // Verify the user has access to this bucket
      const hasAccess = await this.checkBucketAccess(bucketName);
      if (!hasAccess) {
        throw new StoragePermissionError(`You don't have permission to upload to ${bucketName}`);
      }
      
      // Get current user ID
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new StoragePermissionError('You must be logged in to upload files');
      }
      
      // Set default options
      const uploadOptions = {
        contentType: options.contentType || 'image/jpeg',
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert || false
      };
      
      // Ensure file has proper extension based on content type
      let correctedFilename = this.ensureFileExtension(filePath, uploadOptions.contentType);
      
      // Ensure the file path starts with the user ID for ALL protected buckets
      // This is critical for RLS policies to work correctly
      let correctedPath = correctedFilename;
      if (bucketName === STORAGE_BUCKETS.AVATARS || bucketName === STORAGE_BUCKETS.PROGRESS_PHOTOS) {
        correctedPath = this.ensureCorrectPathFormat(correctedFilename, userId);
        console.log(`Corrected path: ${correctedPath} (from ${filePath})`);
        
        // Double-check the path starts with user ID
        if (!correctedPath.startsWith(`${userId}/`)) {
          console.error(`VALIDATION FAILED: Path ${correctedPath} doesn't start with user ID ${userId}/`);
          throw new StoragePermissionError(
            `File path must start with your user ID (${userId}/) for bucket ${bucketName}. Got: ${correctedPath}`
          );
        } else {
          console.log(`VALIDATION PASSED: Path ${correctedPath} correctly starts with user ID ${userId}/`);
        }
      }

      // Detailed debugging for avatar uploads
      if (bucketName === STORAGE_BUCKETS.AVATARS) {
        console.log(`--- AVATAR UPLOAD DEBUG ---`);
        console.log(`Original path: ${filePath}`);
        console.log(`Corrected path: ${correctedPath}`);
        console.log(`User ID: ${userId}`);
        console.log(`Content type: ${uploadOptions.contentType}`);
        console.log(`Upsert: ${uploadOptions.upsert}`);
        console.log(`--------------------------`);
      }

      // For avatars, try direct API upload first due to persistent RLS issues
      if (bucketName === STORAGE_BUCKETS.AVATARS) {
        try {
          console.log('Trying direct API upload for avatar...');
          const result = await this.directApiUpload(
            bucketName, 
            correctedPath, 
            fileData, 
            uploadOptions.contentType
          );
          console.log('Direct API upload successful!');
          return result;
        } catch (directApiError) {
          console.error('Direct API upload failed, falling back to standard method:', directApiError);
          // Continue with standard upload method as fallback
        }
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(correctedPath, fileData, uploadOptions);

      if (error) {
        // Specifically handle RLS policy errors with helpful message
        if (error.message?.toLowerCase().includes('row level security') || 
            error.message?.toLowerCase().includes('unauthorized') ||
            error.message?.toLowerCase().includes('permission')) {
          console.error(`STORAGE RLS ERROR: ${error.message} for path ${correctedPath} in bucket ${bucketName}`);
          throw new StoragePermissionError(
            `Row Level Security prevented upload to ${bucketName}/${correctedPath}. ` +
            `Ensure your Supabase storage RLS policies allow this action and file path starts with your user ID (${userId}/).`
          );
        }
        throw error;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(correctedPath);

      console.log(`Upload successful! Public URL: ${publicUrl}`);
      return { data, publicUrl };
    } catch (error) {
      if (error instanceof StoragePermissionError) {
        console.error(`Permission error:`, error.message);
      } else {
        console.error(`Error uploading file to ${bucketName}:`, error);
      }
      throw error;
    }
  }

  /**
   * Delete a file from a specific bucket
   */
  async deleteFile(bucketName: string, filePath: string) {
    try {
      // Check permissions first to avoid unnecessary operations
      const hasAccess = await this.checkBucketAccess(bucketName);
      if (!hasAccess) {
        throw new StoragePermissionError(`You don't have permission to delete from ${bucketName}`);
      }
      
      // Get current user ID
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new StoragePermissionError('You must be logged in to delete files');
      }
      
      // Ensure the file path starts with the user ID for RLS policies
      let correctedPath = filePath;
      if (bucketName === STORAGE_BUCKETS.AVATARS || bucketName === STORAGE_BUCKETS.PROGRESS_PHOTOS) {
        correctedPath = this.ensureCorrectPathFormat(filePath, userId);
        console.log(`Corrected delete path: ${correctedPath} (from ${filePath})`);
        
        // Double-check the path starts with user ID
        if (!correctedPath.startsWith(`${userId}/`)) {
          throw new StoragePermissionError(
            `File path must start with your user ID (${userId}/) for bucket ${bucketName}. Got: ${correctedPath}`
          );
        }
      }
      
      // For avatars, if no extension is provided, try all possible extensions
      if (bucketName === STORAGE_BUCKETS.AVATARS && !correctedPath.match(/\.(jpg|jpeg|png|webp)$/i)) {
        // Extract the base path without extension
        const basePath = correctedPath.includes('.')
          ? correctedPath.substring(0, correctedPath.lastIndexOf('.'))
          : correctedPath;
        
        // Try all possible extensions
        const possiblePaths = [
          `${basePath}.jpg`,
          `${basePath}.jpeg`,
          `${basePath}.png`,
          `${basePath}.webp`
        ];
        
        console.log(`Trying multiple extensions for: ${basePath}`);
        
        // Try to delete each possible file - continue on first success
        let anySuccess = false;
        for (const path of possiblePaths) {
          try {
            // Check if this file exists - skip if error
            try {
              await supabase.storage
                .from(bucketName)
                .download(path);
            } catch (error) {
              // File doesn't exist with this extension, continue to the next one
              console.log(`File doesn't exist with path: ${path}`);
              continue;
            }
              
            // If download succeeded, file exists - try to delete it
            const { error } = await supabase.storage
              .from(bucketName)
              .remove([path]);
              
            if (!error) {
              console.log(`Successfully deleted file with extension: ${path}`);
              anySuccess = true;
              break; // Exit after first successful deletion
            }
          } catch (error) {
            // Log but continue trying other extensions
            console.warn(`Error trying to delete ${path}:`, error);
          }
        }
        
        if (anySuccess) {
          return true;
        }
        
        // If we get here, we tried all extensions and none worked
        console.warn(`Could not find or delete file with any common extensions: ${basePath}`);
        return true; // Return success since it's likely the file doesn't exist
      }
      
      // Standard deletion for files with extensions
      try {
        // Attempt direct deletion - avoids errors if file doesn't exist
        const { error } = await supabase.storage
          .from(bucketName)
          .remove([correctedPath]);

        if (error) {
          // Specifically handle RLS policy errors with helpful message
          if (error.message?.toLowerCase().includes('row level security') || 
              error.message?.toLowerCase().includes('unauthorized') ||
              error.message?.toLowerCase().includes('permission')) {
            throw new StoragePermissionError(
              `Row Level Security prevented deletion from ${bucketName}/${correctedPath}. ` +
              `Ensure your Supabase storage RLS policies allow this action and file path starts with your user ID (${userId}/).`
            );
          }
          throw error;
        }
      } catch (error) {
        // Only throw errors related to permissions
        if (error instanceof StoragePermissionError) {
          throw error;
        }
        
        // For other errors, log and return true (file might not exist)
        console.warn(`Error deleting ${correctedPath}:`, error);
      }
      
      return true;
    } catch (error) {
      if (error instanceof StoragePermissionError) {
        console.error(`Permission error:`, error.message);
      } else {
        console.error(`Error deleting file from ${bucketName}:`, error);
      }
      throw error;
    }
  }

  /**
   * Get a public URL for a file
   */
  getPublicUrl(bucketName: string, filePath: string) {
    // Handle path correction for avatars bucket
    if (bucketName === STORAGE_BUCKETS.AVATARS || bucketName === STORAGE_BUCKETS.PROGRESS_PHOTOS) {
      // Try to correct the path if we have a user ID
      this.getCurrentUserId().then(userId => {
        if (userId && !filePath.startsWith(`${userId}/`)) {
          console.warn(`Warning: File path ${filePath} in ${bucketName} does not start with user ID. This might cause RLS issues.`);
        }
      }).catch(() => {});
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    return publicUrl;
  }

  /**
   * List all files in a bucket/folder
   */
  async listFiles(bucketName: string, folderPath?: string) {
    try {
      // For buckets with RLS, make sure the folder path is properly formatted
      let correctedPath = folderPath || '';
      
      if ((bucketName === STORAGE_BUCKETS.AVATARS || bucketName === STORAGE_BUCKETS.PROGRESS_PHOTOS) && folderPath) {
        const userId = await this.getCurrentUserId();
        if (userId && !folderPath.startsWith(`${userId}/`) && !folderPath.startsWith(userId)) {
          // If listing user content but not using user ID in path, correct it
          correctedPath = userId;
        }
      }
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(correctedPath);

      if (error) {
        if (error.message?.includes('row-level security') || error.message?.includes('Unauthorized')) {
          throw new StoragePermissionError(
            `Row Level Security prevented listing files in ${bucketName}/${correctedPath}. Ensure your Supabase storage RLS policies allow this action.`
          );
        }
        throw error;
      }
      
      return data || [];
    } catch (error) {
      if (error instanceof StoragePermissionError) {
        console.warn(`Permission error:`, error.message);
        return []; // Return empty array on permission error
      }
      console.error(`Error listing files in ${bucketName}:`, error);
      throw error;
    }
  }

  /**
   * Move/Copy a file within or between buckets
   */
  async moveFile(
    sourceBucket: string,
    sourcePath: string,
    destinationBucket: string,
    destinationPath: string
  ) {
    try {
      // Check access for both buckets
      const sourceAccess = await this.checkBucketAccess(sourceBucket);
      const destAccess = await this.checkBucketAccess(destinationBucket);
      
      if (!sourceAccess || !destAccess) {
        throw new StoragePermissionError(
          `Permission denied: You need access to both ${sourceBucket} and ${destinationBucket} buckets.`
        );
      }
      
      // For buckets with RLS, make sure the paths are properly formatted
      let correctedSourcePath = sourcePath;
      let correctedDestPath = destinationPath;
      
      const userId = await this.getCurrentUserId();
      if (userId) {
        if (sourceBucket === STORAGE_BUCKETS.AVATARS || sourceBucket === STORAGE_BUCKETS.PROGRESS_PHOTOS) {
          correctedSourcePath = this.ensureCorrectPathFormat(sourcePath, userId);
        }
        
        if (destinationBucket === STORAGE_BUCKETS.AVATARS || destinationBucket === STORAGE_BUCKETS.PROGRESS_PHOTOS) {
          correctedDestPath = this.ensureCorrectPathFormat(destinationPath, userId);
        }
      }
      
      const { error } = await supabase.storage
        .from(sourceBucket)
        .move(correctedSourcePath, correctedDestPath);

      if (error) {
        if (error.message?.includes('row-level security') || error.message?.includes('Unauthorized')) {
          throw new StoragePermissionError(
            `Row Level Security prevented moving file from ${sourceBucket}/${correctedSourcePath} to ${destinationBucket}/${correctedDestPath}.`
          );
        }
        throw error;
      }
      
      return true;
    } catch (error) {
      if (error instanceof StoragePermissionError) {
        console.error(`Permission error:`, error.message);
      } else {
        console.error('Error moving file:', error);
      }
      throw error;
    }
  }

  /**
   * Upload a base64 image
   */
  async uploadBase64Image(
    bucketName: string,
    filePath: string,
    base64Data: string,
    options: UploadOptions = {}
  ) {
    try {
      // For avatars, try direct API first
      if (bucketName === STORAGE_BUCKETS.AVATARS) {
        try {
          console.log('Trying direct API upload for avatar (base64)...');
          return await this.directApiUpload(
            bucketName, 
            filePath, 
            base64Data, 
            options.contentType || 'image/jpeg'
          );
        } catch (directApiError) {
          console.error('Direct API upload failed for base64, falling back to standard method:', directApiError);
          // Continue with standard upload method as fallback
        }
      }

      // Convert base64 to Uint8Array
      const binaryString = decode(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return await this.uploadFile(bucketName, filePath, bytes, options);
    } catch (error) {
      console.error('Error uploading base64 image:', error);
      throw error;
    }
  }

  /**
   * Upload a file from a local URI
   */
  async uploadFromUri(
    bucketName: string,
    filePath: string,
    uri: string,
    options: UploadOptions = {}
  ) {
    try {
      // For avatars bucket, try direct API upload first
      if (bucketName === STORAGE_BUCKETS.AVATARS) {
        try {
          // Get current user ID
          const userId = await this.getCurrentUserId();
          if (!userId) {
            throw new StoragePermissionError('You must be logged in to upload files');
          }
          
          // Ensure correct path format
          const correctedPath = this.ensureCorrectPathFormat(filePath, userId);

          // Try direct API upload first for avatars
          console.log('Attempting direct avatar upload from URI using fetch...');
          
          // Get the file as a blob directly
          const response = await fetch(uri);
          const blob = await response.blob();
          
          // Get auth token
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('No access token available');
          }
          
          // Upload directly via API
          const formData = new FormData();
          formData.append('file', blob);
          
          // Get the Supabase project URL - access it correctly
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://jhdcpgriosdjjyakwfhu.supabase.co';
          const fullPath = `${bucketName}/${correctedPath}`;
          const apiUrl = `${supabaseUrl}/storage/v1/object/${fullPath}`;
          
          const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          });
          
          if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            throw new Error(`API error (${apiResponse.status}): ${errorText}`);
          }
          
          // Construct the public URL
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/${fullPath}`;
          console.log('Direct avatar upload successful!');
          
          return { publicUrl };
        } catch (directApiError) {
          console.error('Direct avatar upload failed, falling back to standard method:', directApiError);
          // Fall back to standard method
        }
      }

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      return await this.uploadBase64Image(bucketName, filePath, base64, options);
    } catch (error) {
      console.error('Error uploading file from URI:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();
export default storageService; 