/**
 * Patch for expo-router splash screen compatibility issue
 *
 * This patch addresses the issue where expo-router tries to call
 * SplashModule.internalPreventAutoHideAsync and SplashModule.internalMaybeHideAsync
 * which don't exist in the current expo-splash-screen version.
 *
 * The issue occurs when Sentry is initialized and expo-router tries to manage
 * the splash screen using internal functions that are undefined.
 *
 * GitHub Issue: https://github.com/expo/expo/issues/33316
 *
 * This patch must be imported early in the app initialization process,
 * before expo-router or any other code tries to use the splash screen.
 */

import { Platform } from 'react-native';
import logger from './logger';

// Only apply patch on native platforms
if (Platform.OS !== 'web') {
  try {
    // Get the expo module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo');
    const SplashModule = requireOptionalNativeModule('ExpoSplashScreen');

    if (SplashModule) {
      // Add missing internal functions if they don't exist
      if (!SplashModule.internalPreventAutoHideAsync) {
        SplashModule.internalPreventAutoHideAsync = async () => {
          logger.debugComponent('SPLASH_PATCH', 'Using fallback internalPreventAutoHideAsync');
          // Fallback to regular preventAutoHideAsync if available
          if (typeof SplashModule.preventAutoHideAsync === 'function') {
            return await SplashModule.preventAutoHideAsync();
          }
          return false;
        };
      }

      if (!SplashModule.internalMaybeHideAsync) {
        SplashModule.internalMaybeHideAsync = async () => {
          logger.debugComponent('SPLASH_PATCH', 'Using fallback internalMaybeHideAsync');
          // Fallback to regular hide if available
          if (typeof SplashModule.hide === 'function') {
            SplashModule.hide();
            return true;
          }
          return false;
        };
      }

      logger.debugComponent(
        'SPLASH_PATCH',
        'Splash screen compatibility patch applied successfully',
      );
    } else {
      logger.debugComponent('SPLASH_PATCH', 'SplashModule not available - patch not needed');
    }
  } catch (error) {
    logger.warn('Failed to apply splash screen patch:', { context: { error: String(error) } });
  }
}

export default {};
