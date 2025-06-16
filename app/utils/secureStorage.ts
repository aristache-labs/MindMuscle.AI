import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { startTransaction } from './sentryCompat';

// Check if SecureStore is available at module level
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SecureStoreModule: any = null;
let isSecureStoreModuleAvailable = false;

// Try to load SecureStore module safely
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStoreModule = require('expo-secure-store');
  isSecureStoreModuleAvailable = true;
  console.log('SecureStore module loaded successfully');

  Sentry.addBreadcrumb({
    message: 'SecureStore module loaded successfully',
    category: 'secure_storage',
    level: 'info',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (error: any) {
  console.warn('SecureStore module not available, will use AsyncStorage fallback:', error.message);
  isSecureStoreModuleAvailable = false;

  Sentry.addBreadcrumb({
    message: 'SecureStore module not available, using AsyncStorage fallback',
    category: 'secure_storage',
    data: { error: error.message },
    level: 'warning',
  });

  Sentry.setTag('storage.secure_store_available', false);
}

// Storage utility with fallback support
class SecureStorageUtility {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private secureStore: any = null;
  private isSecureStoreAvailable = false;
  private initializationPromise: Promise<void>;
  private isInitialized = false;

  constructor() {
    this.initializationPromise = this.initializeSecureStore();
  }

  private async initializeSecureStore(): Promise<void> {
    const transaction = startTransaction({
      name: 'initializeSecureStore',
      op: 'secure_storage',
    });

    try {
      Sentry.addBreadcrumb({
        message: 'Initializing SecureStore',
        category: 'secure_storage',
        level: 'info',
      });

      // Only proceed if the module was loaded successfully
      if (!isSecureStoreModuleAvailable || !SecureStoreModule) {
        console.warn('SecureStore module not available, using AsyncStorage fallback');
        this.isSecureStoreAvailable = false;
        this.secureStore = null;

        Sentry.addBreadcrumb({
          message: 'SecureStore module not loaded, using AsyncStorage',
          category: 'secure_storage',
          level: 'warning',
        });

        Sentry.setTag('storage.type', 'async');
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

          Sentry.addBreadcrumb({
            message: 'SecureStore native module verified and available',
            category: 'secure_storage',
            level: 'info',
          });

          Sentry.setTag('storage.type', 'secure');
          Sentry.setTag('storage.secure_store_verified', true);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

            Sentry.addBreadcrumb({
              message: 'SecureStore native module not available, using AsyncStorage fallback',
              category: 'secure_storage',
              data: { error: testError.message },
              level: 'warning',
            });

            Sentry.setTag('storage.type', 'async');
            Sentry.setTag('storage.fallback_reason', 'native_module_unavailable');
          } else {
            // Other errors (like key not found) mean SecureStore is working
            this.secureStore = SecureStoreModule;
            this.isSecureStoreAvailable = true;
            console.log('SecureStore native module is available - using secure storage');

            Sentry.addBreadcrumb({
              message: 'SecureStore working despite test error (expected for key not found)',
              category: 'secure_storage',
              level: 'info',
            });

            Sentry.setTag('storage.type', 'secure');
            Sentry.setTag('storage.secure_store_verified', true);
          }
        }
      } else {
        console.warn('SecureStore methods not available, falling back to AsyncStorage');
        this.isSecureStoreAvailable = false;
        this.secureStore = null;

        Sentry.addBreadcrumb({
          message: 'SecureStore methods not available, using AsyncStorage',
          category: 'secure_storage',
          level: 'warning',
        });

        Sentry.setTag('storage.type', 'async');
        Sentry.setTag('storage.fallback_reason', 'methods_unavailable');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (initError: any) {
      console.warn(
        'SecureStore initialization failed, falling back to AsyncStorage:',
        initError.message,
      );
      this.isSecureStoreAvailable = false;
      this.secureStore = null;

      Sentry.captureException(initError, {
        tags: {
          component: 'secureStorage',
          function: 'initializeSecureStore',
        },
        contexts: {
          secure_storage: {
            module_available: isSecureStoreModuleAvailable,
            initialization_step: 'general_init',
          },
        },
      });

      Sentry.setTag('storage.type', 'async');
      Sentry.setTag('storage.fallback_reason', 'initialization_failed');
    } finally {
      this.isInitialized = true;
      transaction.finish();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializationPromise;
    }
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    const transaction = startTransaction({
      name: 'setItemAsync',
      op: 'secure_storage',
    });

    try {
      await this.ensureInitialized();

      Sentry.addBreadcrumb({
        message: 'Setting secure storage item',
        category: 'secure_storage',
        data: {
          key: key.substring(0, 10) + '...', // Partial key for privacy
          storage_type: this.isSecureStoreAvailable ? 'secure' : 'async',
          value_length: value.length,
        },
        level: 'info',
      });

      if (this.isSecureStoreAvailable && this.secureStore) {
        try {
          const result = await this.secureStore.setItemAsync(key, value);

          Sentry.addBreadcrumb({
            message: 'SecureStore setItem successful',
            category: 'secure_storage',
            data: { key: key.substring(0, 10) + '...' },
            level: 'info',
          });

          return result;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          console.warn('SecureStore setItem failed, falling back to AsyncStorage:', error.message);

          Sentry.addBreadcrumb({
            message: 'SecureStore setItem failed, using AsyncStorage fallback',
            category: 'secure_storage',
            data: {
              key: key.substring(0, 10) + '...',
              error: error.message,
            },
            level: 'warning',
          });

          return AsyncStorage.setItem(`secure_${key}`, value);
        }
      } else {
        Sentry.addBreadcrumb({
          message: 'Using AsyncStorage for setItem (SecureStore not available)',
          category: 'secure_storage',
          data: { key: key.substring(0, 10) + '...' },
          level: 'info',
        });

        return AsyncStorage.setItem(`secure_${key}`, value);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'secureStorage',
          function: 'setItemAsync',
        },
        contexts: {
          secure_storage: {
            key: key.substring(0, 10) + '...',
            storage_type: this.isSecureStoreAvailable ? 'secure' : 'async',
            value_length: value.length,
          },
        },
      });
      throw error;
    } finally {
      transaction.finish();
    }
  }

  async getItemAsync(key: string): Promise<string | null> {
    const transaction = startTransaction({
      name: 'getItemAsync',
      op: 'secure_storage',
    });

    try {
      await this.ensureInitialized();

      Sentry.addBreadcrumb({
        message: 'Getting secure storage item',
        category: 'secure_storage',
        data: {
          key: key.substring(0, 10) + '...', // Partial key for privacy
          storage_type: this.isSecureStoreAvailable ? 'secure' : 'async',
        },
        level: 'info',
      });

      if (this.isSecureStoreAvailable && this.secureStore) {
        try {
          const result = await this.secureStore.getItemAsync(key);

          Sentry.addBreadcrumb({
            message: 'SecureStore getItem successful',
            category: 'secure_storage',
            data: {
              key: key.substring(0, 10) + '...',
              has_value: result !== null,
            },
            level: 'info',
          });

          return result;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          console.warn('SecureStore getItem failed, falling back to AsyncStorage:', error.message);

          Sentry.addBreadcrumb({
            message: 'SecureStore getItem failed, using AsyncStorage fallback',
            category: 'secure_storage',
            data: {
              key: key.substring(0, 10) + '...',
              error: error.message,
            },
            level: 'warning',
          });

          return AsyncStorage.getItem(`secure_${key}`);
        }
      } else {
        Sentry.addBreadcrumb({
          message: 'Using AsyncStorage for getItem (SecureStore not available)',
          category: 'secure_storage',
          data: { key: key.substring(0, 10) + '...' },
          level: 'info',
        });

        return AsyncStorage.getItem(`secure_${key}`);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'secureStorage',
          function: 'getItemAsync',
        },
        contexts: {
          secure_storage: {
            key: key.substring(0, 10) + '...',
            storage_type: this.isSecureStoreAvailable ? 'secure' : 'async',
          },
        },
      });
      throw error;
    } finally {
      transaction.finish();
    }
  }

  async deleteItemAsync(key: string): Promise<void> {
    const transaction = startTransaction({
      name: 'deleteItemAsync',
      op: 'secure_storage',
    });

    try {
      await this.ensureInitialized();

      Sentry.addBreadcrumb({
        message: 'Deleting secure storage item',
        category: 'secure_storage',
        data: {
          key: key.substring(0, 10) + '...', // Partial key for privacy
          storage_type: this.isSecureStoreAvailable ? 'secure' : 'async',
        },
        level: 'info',
      });

      if (this.isSecureStoreAvailable && this.secureStore) {
        try {
          const result = await this.secureStore.deleteItemAsync(key);

          Sentry.addBreadcrumb({
            message: 'SecureStore deleteItem successful',
            category: 'secure_storage',
            data: { key: key.substring(0, 10) + '...' },
            level: 'info',
          });

          return result;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          console.warn(
            'SecureStore deleteItem failed, falling back to AsyncStorage:',
            error.message,
          );

          Sentry.addBreadcrumb({
            message: 'SecureStore deleteItem failed, using AsyncStorage fallback',
            category: 'secure_storage',
            data: {
              key: key.substring(0, 10) + '...',
              error: error.message,
            },
            level: 'warning',
          });

          return AsyncStorage.removeItem(`secure_${key}`);
        }
      } else {
        Sentry.addBreadcrumb({
          message: 'Using AsyncStorage for deleteItem (SecureStore not available)',
          category: 'secure_storage',
          data: { key: key.substring(0, 10) + '...' },
          level: 'info',
        });

        return AsyncStorage.removeItem(`secure_${key}`);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'secureStorage',
          function: 'deleteItemAsync',
        },
        contexts: {
          secure_storage: {
            key: key.substring(0, 10) + '...',
            storage_type: this.isSecureStoreAvailable ? 'secure' : 'async',
          },
        },
      });
      throw error;
    } finally {
      transaction.finish();
    }
  }

  async getStorageType(): Promise<'secure' | 'async'> {
    try {
      await this.ensureInitialized();
      const storageType = this.isSecureStoreAvailable ? 'secure' : 'async';

      Sentry.addBreadcrumb({
        message: 'Storage type requested',
        category: 'secure_storage',
        data: { storage_type: storageType },
        level: 'info',
      });

      return storageType;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'secureStorage',
          function: 'getStorageType',
        },
      });
      throw error;
    }
  }
}

// Export a singleton instance
export const secureStorage = new SecureStorageUtility();
export default secureStorage;
