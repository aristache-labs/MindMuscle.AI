import AsyncStorage from '@react-native-async-storage/async-storage';

// Check if SecureStore is available at module level
let SecureStoreModule: any = null;
let isSecureStoreModuleAvailable = false;

// Try to load SecureStore module safely
try {
  SecureStoreModule = require('expo-secure-store');
  isSecureStoreModuleAvailable = true;
  console.log('SecureStore module loaded successfully');
} catch (error: any) {
  console.warn('SecureStore module not available, will use AsyncStorage fallback:', error.message);
  isSecureStoreModuleAvailable = false;
}

// Storage utility with fallback support
class SecureStorageUtility {
  private secureStore: any = null;
  private isSecureStoreAvailable = false;
  private initializationPromise: Promise<void>;
  private isInitialized = false;

  constructor() {
    this.initializationPromise = this.initializeSecureStore();
  }

  private async initializeSecureStore(): Promise<void> {
    try {
      // Only proceed if the module was loaded successfully
      if (!isSecureStoreModuleAvailable || !SecureStoreModule) {
        console.warn('SecureStore module not available, using AsyncStorage fallback');
        this.isSecureStoreAvailable = false;
        this.secureStore = null;
        return;
      }

      // Test if the native functionality is available
      if (typeof SecureStoreModule.getItemAsync === 'function') {
        try {
          // Try a simple operation to verify native module works
          await SecureStoreModule.getItemAsync('__test_key__');
          this.secureStore = SecureStoreModule;
          this.isSecureStoreAvailable = true;
          console.log('SecureStore native module is available - using secure storage');
        } catch (testError: any) {
          // Check if it's a native module error
          if (
            testError.message?.includes('Cannot find native module') ||
            testError.message?.includes('ExpoSecureStore') ||
            testError.message?.includes('is not a function')
          ) {
            console.warn('SecureStore native module not available, falling back to AsyncStorage');
            this.isSecureStoreAvailable = false;
            this.secureStore = null;
          } else {
            // Other errors (like key not found) mean SecureStore is working
            this.secureStore = SecureStoreModule;
            this.isSecureStoreAvailable = true;
            console.log('SecureStore native module is available - using secure storage');
          }
        }
      } else {
        console.warn('SecureStore methods not available, falling back to AsyncStorage');
        this.isSecureStoreAvailable = false;
        this.secureStore = null;
      }
    } catch (initError: any) {
      console.warn(
        'SecureStore initialization failed, falling back to AsyncStorage:',
        initError.message,
      );
      this.isSecureStoreAvailable = false;
      this.secureStore = null;
    } finally {
      this.isInitialized = true;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializationPromise;
    }
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isSecureStoreAvailable && this.secureStore) {
      try {
        return await this.secureStore.setItemAsync(key, value);
      } catch (error: any) {
        console.warn('SecureStore setItem failed, falling back to AsyncStorage:', error.message);
        return AsyncStorage.setItem(`secure_${key}`, value);
      }
    } else {
      return AsyncStorage.setItem(`secure_${key}`, value);
    }
  }

  async getItemAsync(key: string): Promise<string | null> {
    await this.ensureInitialized();

    if (this.isSecureStoreAvailable && this.secureStore) {
      try {
        return await this.secureStore.getItemAsync(key);
      } catch (error: any) {
        console.warn('SecureStore getItem failed, falling back to AsyncStorage:', error.message);
        return AsyncStorage.getItem(`secure_${key}`);
      }
    } else {
      return AsyncStorage.getItem(`secure_${key}`);
    }
  }

  async deleteItemAsync(key: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isSecureStoreAvailable && this.secureStore) {
      try {
        return await this.secureStore.deleteItemAsync(key);
      } catch (error: any) {
        console.warn('SecureStore deleteItem failed, falling back to AsyncStorage:', error.message);
        return AsyncStorage.removeItem(`secure_${key}`);
      }
    } else {
      return AsyncStorage.removeItem(`secure_${key}`);
    }
  }

  async getStorageType(): Promise<'secure' | 'async'> {
    await this.ensureInitialized();
    return this.isSecureStoreAvailable ? 'secure' : 'async';
  }
}

// Export a singleton instance
export const secureStorage = new SecureStorageUtility();
export default secureStorage;
