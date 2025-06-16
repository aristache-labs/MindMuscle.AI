import { Platform } from 'react-native';
import secureStorage from '../utils/secureStorage';
import { logger } from '../utils/logger';
import { addBreadcrumb } from './sentry';
import * as SecureStore from 'expo-secure-store';

// Keys for credential storage
const CREDENTIAL_SERVICE_NAME = 'mindmuscle_ai';
const EMAIL_KEY = 'mindmuscle_saved_email';
const REMEMBER_ME_KEY = 'mindmuscle_remember_me';
const KEYCHAIN_EMAIL_KEY = 'keychain_email';
const KEYCHAIN_PASSWORD_KEY = 'keychain_password';

export interface CredentialSuggestion {
  email: string;
  hasPassword: boolean;
  source: 'keychain' | 'secure_storage' | 'system';
}

export interface CredentialManagerConfig {
  serviceName: string;
  enableSystemIntegration: boolean;
  enableBiometrics: boolean;
}

class CredentialManager {
  private config: CredentialManagerConfig;

  constructor(config: CredentialManagerConfig) {
    this.config = config;
  }

  /**
   * Check if native credential management is available
   */
  async isNativeCredentialManagerAvailable(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // Check if Keychain is available
        return await SecureStore.isAvailableAsync();
      }

      if (Platform.OS === 'android') {
        // Android Autofill Framework is available on Android 8.0+ (API level 26+)
        return Platform.Version >= 26 && (await SecureStore.isAvailableAsync());
      }

      return false;
    } catch (error) {
      logger.error(
        'Error checking credential manager availability',
        error instanceof Error ? error : new Error('Unknown error'),
      );
      return false;
    }
  }

  /**
   * Get suggested credentials for autofill
   */
  async getSuggestedCredentials(): Promise<CredentialSuggestion[]> {
    try {
      const suggestions: CredentialSuggestion[] = [];

      addBreadcrumb({
        message: 'Fetching credential suggestions',
        category: 'auth.credentials',
        level: 'info',
        data: {
          platform: Platform.OS,
          service: this.config.serviceName,
        },
      });

      // First, check our secure storage for remember me preference
      const rememberMe = await secureStorage.getItemAsync(REMEMBER_ME_KEY);
      const savedEmail = await secureStorage.getItemAsync(EMAIL_KEY);

      if (rememberMe === 'true' && savedEmail) {
        suggestions.push({
          email: savedEmail,
          hasPassword: false, // We never store passwords for security
          source: 'secure_storage',
        });

        addBreadcrumb({
          message: 'Found saved email in secure storage',
          category: 'auth.credentials',
          level: 'debug',
          data: {
            hasEmail: !!savedEmail,
            source: 'secure_storage',
          },
        });
      }

      // Check keychain for saved credentials
      try {
        const keychainEmail = await SecureStore.getItemAsync(KEYCHAIN_EMAIL_KEY);
        if (keychainEmail && keychainEmail !== savedEmail) {
          suggestions.push({
            email: keychainEmail,
            hasPassword: true,
            source: 'keychain',
          });

          addBreadcrumb({
            message: 'Found saved email in keychain',
            category: 'auth.credentials',
            level: 'debug',
            data: {
              hasEmail: !!keychainEmail,
              source: 'keychain',
            },
          });
        }
      } catch (error) {
        // Keychain might not have any saved credentials
        console.log('No keychain credentials found:', error);
      }

      return suggestions;
    } catch (error) {
      logger.error(
        'Error getting credential suggestions',
        error instanceof Error ? error : new Error('Unknown error'),
      );
      addBreadcrumb({
        message: 'Failed to get credential suggestions',
        category: 'auth.credentials',
        level: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return [];
    }
  }

  /**
   * Request to save credentials to native credential manager
   * This actually saves to the secure keychain/storage
   */
  async requestToSaveCredentials(email: string, password: string): Promise<boolean> {
    try {
      addBreadcrumb({
        message: 'Requesting to save credentials to system',
        category: 'auth.credentials',
        level: 'info',
        data: {
          platform: Platform.OS,
          hasEmail: !!email,
          hasPassword: !!password,
        },
      });

      console.log('🔑 [Credential Manager] Attempting to save credentials:', {
        platform: Platform.OS,
        email: email,
        hasPassword: !!password,
        enabledAutofill: this.config.enableSystemIntegration,
      });

      const available = await this.isNativeCredentialManagerAvailable();

      if (!available) {
        console.warn(
          '🔑 [Credential Manager] Native credential manager not available on this device',
        );
        return false;
      }

      // Save to secure store/keychain with proper service name
      const secureStoreOptions = {
        keychainService: this.config.serviceName,
        ...(Platform.OS === 'ios' && {
          accessGroup: undefined, // Use default access group
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
        ...(Platform.OS === 'android' && {
          encryptionKey: undefined, // Use default encryption
        }),
      };

      // Save credentials to native storage
      await Promise.all([
        SecureStore.setItemAsync(KEYCHAIN_EMAIL_KEY, email, secureStoreOptions),
        SecureStore.setItemAsync(KEYCHAIN_PASSWORD_KEY, password, secureStoreOptions),
      ]);

      logger.info('Credentials saved to native storage', {
        context: { platform: Platform.OS, service: this.config.serviceName },
      });

      console.log('🔑 [Credential Manager] Credentials saved to native storage successfully');

      // Note: The actual system prompt for password saving is handled by the OS
      // when the user interacts with password fields that have proper autofill attributes
      // This happens automatically when the TextInput has the correct properties set

      return true;
    } catch (error) {
      console.error('🔑 [Credential Manager] Error saving credentials:', error);
      logger.error(
        'Error saving credentials to native storage',
        error instanceof Error ? error : new Error('Unknown error'),
      );
      addBreadcrumb({
        message: 'Failed to save credentials to native storage',
        category: 'auth.credentials',
        level: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      return false;
    }
  }

  /**
   * Get saved credentials from keychain if available
   */
  async getSavedCredentials(): Promise<{ email?: string; password?: string } | null> {
    try {
      const secureStoreOptions = {
        keychainService: this.config.serviceName,
        ...(Platform.OS === 'ios' && {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      };

      const [email, password] = await Promise.all([
        SecureStore.getItemAsync(KEYCHAIN_EMAIL_KEY, secureStoreOptions).catch(() => null),
        SecureStore.getItemAsync(KEYCHAIN_PASSWORD_KEY, secureStoreOptions).catch(() => null),
      ]);

      if (email || password) {
        addBreadcrumb({
          message: 'Retrieved saved credentials from keychain',
          category: 'auth.credentials',
          level: 'info',
          data: {
            hasEmail: !!email,
            hasPassword: !!password,
          },
        });

        return { email: email || undefined, password: password || undefined };
      }

      return null;
    } catch (error) {
      logger.error(
        'Error retrieving saved credentials',
        error instanceof Error ? error : new Error('Unknown error'),
      );
      return null;
    }
  }

  /**
   * Clear all saved credentials from both our storage and system
   */
  async clearAllCredentials(): Promise<void> {
    try {
      addBreadcrumb({
        message: 'Clearing all saved credentials',
        category: 'auth.credentials',
        level: 'info',
      });

      // Clear our app's stored credentials
      await Promise.all([
        secureStorage.deleteItemAsync(EMAIL_KEY),
        secureStorage.deleteItemAsync(REMEMBER_ME_KEY),
      ]);

      // Clear keychain credentials
      const secureStoreOptions = {
        keychainService: this.config.serviceName,
      };

      await Promise.all([
        SecureStore.deleteItemAsync(KEYCHAIN_EMAIL_KEY, secureStoreOptions).catch(() => {}),
        SecureStore.deleteItemAsync(KEYCHAIN_PASSWORD_KEY, secureStoreOptions).catch(() => {}),
      ]);

      logger.info('All credentials cleared successfully');
      console.log('🔑 [Credential Manager] All credentials cleared');
    } catch (error) {
      logger.error(
        'Error clearing credentials',
        error instanceof Error ? error : new Error('Unknown error'),
      );
      addBreadcrumb({
        message: 'Failed to clear credentials',
        category: 'auth.credentials',
        level: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  /**
   * Check if remember me is enabled
   */
  async isRememberMeEnabled(): Promise<boolean> {
    try {
      const rememberMe = await secureStorage.getItemAsync(REMEMBER_ME_KEY);
      return rememberMe === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get debug information about the credential manager
   */
  async getCredentialManagerInfo(): Promise<{
    platform: string;
    available: boolean;
    features: string[];
    hasStoredCredentials: boolean;
    rememberMeEnabled: boolean;
  }> {
    const available = await this.isNativeCredentialManagerAvailable();
    const savedCredentials = await this.getSavedCredentials();
    const rememberMeEnabled = await this.isRememberMeEnabled();

    const features = [];
    if (Platform.OS === 'ios') {
      features.push('iOS Keychain', 'Biometric Authentication', 'AutoFill');
    }
    if (Platform.OS === 'android') {
      features.push('Android Autofill Framework', 'Credential Manager API');
    }

    return {
      platform: Platform.OS,
      available,
      features,
      hasStoredCredentials: !!(savedCredentials?.email || savedCredentials?.password),
      rememberMeEnabled,
    };
  }
}

// Create and export the credential manager instance
export const credentialManager = new CredentialManager({
  serviceName: CREDENTIAL_SERVICE_NAME,
  enableSystemIntegration: true,
  enableBiometrics: true,
});

// Utility functions for autofill configuration
export const shouldEnableAutofill = (): boolean => {
  return Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 26);
};

export const getUsernameAutoComplete = (): 'username' | 'email' => {
  // Use 'email' for both platforms to ensure email suggestions work
  return 'email';
};

export const getUsernameTextContentType = (): 'username' | 'emailAddress' => {
  // Use 'emailAddress' for both platforms to trigger email autofill
  return 'emailAddress';
};

export default credentialManager;
