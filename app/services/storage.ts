import * as FileSystem from 'expo-file-system';
import supabase from './supabase';
import { decode } from 'base-64';

// Storage bucket names
export const STORAGE_BUCKETS = {
  PROGRESS_PHOTOS: 'progress-photos',
  PLANS: 'plans'
} as const;

// File types and their content types
export const CONTENT_TYPES = {
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  JPG: 'image/jpg'
} as const;

interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

interface UploadResult {
  data?: any;
  publicUrl: string;
}

export interface StorageFile {
  name: string;
  id: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

class StorageService {
  /**
   * Upload a file to a specific bucket
   */
  async uploadFile(
    bucketName: string,
    filePath: string,
    fileData: string | Uint8Array,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      // Set default options
      const uploadOptions = {
        contentType: options.contentType || 'image/jpeg',
        cacheControl: options.cacheControl || '3600',
        upsert: options.upsert || false
      };

      console.log(`📤 Attempting to upload file: bucket=${bucketName}, path=${filePath}`);
      console.log(`📤 Upload options:`, uploadOptions);
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileData, uploadOptions);

      if (error) {
        // Enhanced error logging for RLS issues
        console.error(`❌ Error uploading file to ${bucketName}:`, error);
        
        if (error.message?.includes('row-level security policy')) {
          console.error(`🔒 RLS POLICY ERROR: This appears to be a permission issue`);
          console.error(`🔍 DEBUG: Bucket=${bucketName}, Path=${filePath}`);
          console.error(`🔍 DEBUG: Path parts:`, filePath.split('/'));
        }
        
        throw error;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      console.log(`✅ Successfully uploaded file: bucket=${bucketName}, path=${filePath}`);
      console.log(`🌐 Public URL: ${publicUrl}`);

      return { data, publicUrl };
    } catch (error) {
      console.error(`❌ Error uploading file to ${bucketName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file from a specific bucket
   */
  async deleteFile(bucketName: string, filePath: string) {
    try {
      console.log(`🗑️ Attempting to delete file: bucket=${bucketName}, path=${filePath}`);
      
      // Standard delete approach
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) {
        // Enhanced error logging for RLS issues
        console.error(`❌ Error deleting file from ${bucketName}:`, error);
        
        if (error.message?.includes('row-level security policy')) {
          console.error(`🔒 RLS POLICY ERROR: This appears to be a permission issue`);
          console.error(`🔍 DEBUG: Bucket=${bucketName}, Path=${filePath}`);
          console.error(`🔍 DEBUG: Path parts:`, filePath.split('/'));
        }
        
        throw error;
      }
      
      console.log(`✅ Successfully deleted file: bucket=${bucketName}, path=${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting file from ${bucketName}:`, error);
      throw error;
    }
  }

  /**
   * Get a public URL for a file
   */
  getPublicUrl(bucketName: string, filePath: string) {
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    return publicUrl;
  }

  /**
   * List all files in a bucket/folder
   */
  async listFiles(bucketName: string, folderPath?: string): Promise<StorageFile[]> {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(folderPath || '');

      if (error) throw error;
      return data || [];
    } catch (error) {
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
      const { error } = await supabase.storage
        .from(sourceBucket)
        .move(sourcePath, destinationPath);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error moving file:', error);
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

  /**
   * Get a signed URL for a file (default 1 hour expiry)
   */
  async getSignedUrl(bucketName: string, filePath: string, expiresInSeconds: number = 3600): Promise<string> {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, expiresInSeconds);
      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }
}

// Export the service instance
export const storageService = new StorageService(); 