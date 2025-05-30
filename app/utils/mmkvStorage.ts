/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * MMKV Storage Utility for MindMuscle.AI
 *
 * This file provides a ready-to-use MMKV storage setup for when MMKV becomes
 * compatible with Expo or when migrating to a bare React Native project.
 *
 * Currently commented out as MMKV doesn't work with Expo managed workflow.
 */

// Uncomment when MMKV is compatible with Expo or when using bare React Native
// import { MMKV } from 'react-native-mmkv';

/**
 * MMKV Storage Instance
 * Uncomment and configure when ready to use MMKV
 */
// export const storage = new MMKV({
//   id: 'mindmuscle-ai-storage',
//   encryptionKey: 'your-encryption-key-here', // Optional: for encrypted storage
// });

/**
 * Secure MMKV Storage Instance
 * For storing sensitive data like tokens, credentials, etc.
 */
// export const secureStorage = new MMKV({
//   id: 'mindmuscle-ai-secure-storage',
//   encryptionKey: 'your-secure-encryption-key-here',
// });

/**
 * MMKV Storage Wrapper with AsyncStorage-like interface
 * Provides compatibility with existing AsyncStorage code
 */
export class MMKVStorageWrapper {
  // private storage: MMKV;

  constructor(/* storage: MMKV */) {
    // this.storage = storage;
  }

  /**
   * Get an item from MMKV storage
   */
  async getItem(key: string): Promise<string | null> {
    // return this.storage.getString(key) ?? null;
    throw new Error('MMKV not available in Expo managed workflow');
  }

  /**
   * Set an item in MMKV storage
   */
  async setItem(key: string, value: string): Promise<void> {
    // this.storage.set(key, value);
    throw new Error('MMKV not available in Expo managed workflow');
  }

  /**
   * Remove an item from MMKV storage
   */
  async removeItem(key: string): Promise<void> {
    // this.storage.delete(key);
    throw new Error('MMKV not available in Expo managed workflow');
  }

  /**
   * Clear all items from MMKV storage
   */
  async clear(): Promise<void> {
    // this.storage.clearAll();
    throw new Error('MMKV not available in Expo managed workflow');
  }

  /**
   * Get all keys from MMKV storage
   */
  async getAllKeys(): Promise<string[]> {
    // return this.storage.getAllKeys();
    throw new Error('MMKV not available in Expo managed workflow');
  }

  /**
   * Get multiple items from MMKV storage
   */
  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    // return keys.map(key => [key, this.storage.getString(key) ?? null]);
    throw new Error('MMKV not available in Expo managed workflow');
  }

  /**
   * Set multiple items in MMKV storage
   */
  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    // keyValuePairs.forEach(([key, value]) => {
    //   this.storage.set(key, value);
    // });
    throw new Error('MMKV not available in Expo managed workflow');
  }

  /**
   * Remove multiple items from MMKV storage
   */
  async multiRemove(keys: string[]): Promise<void> {
    // keys.forEach(key => {
    //   this.storage.delete(key);
    // });
    throw new Error('MMKV not available in Expo managed workflow');
  }
}

/**
 * Storage instances ready for use when MMKV is available
 */
// export const mmkvStorage = new MMKVStorageWrapper(storage);
// export const mmkvSecureStorage = new MMKVStorageWrapper(secureStorage);

/**
 * Migration utility to move data from AsyncStorage to MMKV
 */
export class StorageMigration {
  /**
   * Migrate data from AsyncStorage to MMKV
   * Call this once when transitioning from AsyncStorage to MMKV
   */
  static async migrateFromAsyncStorage() // asyncStorage: typeof import('@react-native-async-storage/async-storage').default,
  // mmkvStorage: MMKVStorageWrapper
  : Promise<void> {
    throw new Error('MMKV migration not available in Expo managed workflow');

    // Uncomment when ready to use:
    // try {
    //   const keys = await asyncStorage.getAllKeys();
    //   const keyValuePairs = await asyncStorage.multiGet(keys);
    //
    //   for (const [key, value] of keyValuePairs) {
    //     if (value !== null) {
    //       await mmkvStorage.setItem(key, value);
    //     }
    //   }
    //
    //   console.log(`Migrated ${keyValuePairs.length} items from AsyncStorage to MMKV`);
    // } catch (error) {
    //   console.error('Failed to migrate from AsyncStorage to MMKV:', error);
    //   throw error;
    // }
  }
}

/**
 * MMKV Performance Benefits (for documentation)
 *
 * When MMKV becomes available, you'll get:
 * - Up to 30x faster than AsyncStorage
 * - Synchronous API (no async/await needed)
 * - Built-in encryption support
 * - Smaller bundle size
 * - Better memory efficiency
 * - Crash recovery
 */

export default MMKVStorageWrapper;
