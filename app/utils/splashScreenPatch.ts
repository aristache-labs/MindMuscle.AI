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
import * as Sentry from '@sentry/react-native';
import logger from './logger';

// Only apply patch on native platforms
if (Platform.OS !== 'web') {
  Sentry.startSpan(
    {
      name: 'splashScreenPatch',
      op: 'app_initialization',
    },
    () => {
      try {
        Sentry.addBreadcrumb({
          message: 'Applying splash screen compatibility patch',
          category: 'splash_screen',
          data: { platform: Platform.OS },
          level: 'info',
        });

        // Get the expo module
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { requireOptionalNativeModule } = require('expo');
        const SplashModule = requireOptionalNativeModule('ExpoSplashScreen');

        if (SplashModule) {
          Sentry.addBreadcrumb({
            message: 'SplashModule found, checking for missing functions',
            category: 'splash_screen',
            level: 'info',
          });

          // Add missing internal functions if they don't exist
          if (!SplashModule.internalPreventAutoHideAsync) {
            Sentry.addBreadcrumb({
              message: 'Adding fallback internalPreventAutoHideAsync function',
              category: 'splash_screen',
              level: 'info',
            });

            SplashModule.internalPreventAutoHideAsync = async () => {
              logger.debugComponent('SPLASH_PATCH', 'Using fallback internalPreventAutoHideAsync');

              Sentry.addBreadcrumb({
                message: 'Executing fallback internalPreventAutoHideAsync',
                category: 'splash_screen',
                level: 'debug',
              });

              // Fallback to regular preventAutoHideAsync if available
              if (typeof SplashModule.preventAutoHideAsync === 'function') {
                try {
                  const result = await SplashModule.preventAutoHideAsync();
                  Sentry.addBreadcrumb({
                    message: 'Fallback preventAutoHideAsync executed successfully',
                    category: 'splash_screen',
                    data: { result },
                    level: 'info',
                  });
                  return result;
                } catch (error) {
                  Sentry.captureException(error, {
                    tags: {
                      component: 'splashScreenPatch',
                      function: 'internalPreventAutoHideAsync',
                    },
                  });
                  return false;
                }
              }

              Sentry.addBreadcrumb({
                message: 'No preventAutoHideAsync function available',
                category: 'splash_screen',
                level: 'warning',
              });
              return false;
            };
          } else {
            Sentry.addBreadcrumb({
              message: 'internalPreventAutoHideAsync already exists',
              category: 'splash_screen',
              level: 'info',
            });
          }

          if (!SplashModule.internalMaybeHideAsync) {
            Sentry.addBreadcrumb({
              message: 'Adding fallback internalMaybeHideAsync function',
              category: 'splash_screen',
              level: 'info',
            });

            SplashModule.internalMaybeHideAsync = async () => {
              logger.debugComponent('SPLASH_PATCH', 'Using fallback internalMaybeHideAsync');

              Sentry.addBreadcrumb({
                message: 'Executing fallback internalMaybeHideAsync',
                category: 'splash_screen',
                level: 'debug',
              });

              // Fallback to regular hide if available
              if (typeof SplashModule.hide === 'function') {
                try {
                  SplashModule.hide();
                  Sentry.addBreadcrumb({
                    message: 'Fallback hide executed successfully',
                    category: 'splash_screen',
                    level: 'info',
                  });
                  return true;
                } catch (error) {
                  Sentry.captureException(error, {
                    tags: {
                      component: 'splashScreenPatch',
                      function: 'internalMaybeHideAsync',
                    },
                  });
                  return false;
                }
              }

              Sentry.addBreadcrumb({
                message: 'No hide function available',
                category: 'splash_screen',
                level: 'warning',
              });
              return false;
            };
          } else {
            Sentry.addBreadcrumb({
              message: 'internalMaybeHideAsync already exists',
              category: 'splash_screen',
              level: 'info',
            });
          }

          logger.debugComponent(
            'SPLASH_PATCH',
            'Splash screen compatibility patch applied successfully',
          );

          Sentry.addBreadcrumb({
            message: 'Splash screen compatibility patch applied successfully',
            category: 'splash_screen',
            level: 'info',
          });

          Sentry.setTag('splash_screen.patch_applied', true);
        } else {
          logger.debugComponent('SPLASH_PATCH', 'SplashModule not available - patch not needed');

          Sentry.addBreadcrumb({
            message: 'SplashModule not available - patch not needed',
            category: 'splash_screen',
            level: 'info',
          });

          Sentry.setTag('splash_screen.module_available', false);
        }
      } catch (error) {
        logger.warn('Failed to apply splash screen patch:', { context: { error: String(error) } });

        Sentry.captureException(error, {
          tags: {
            component: 'splashScreenPatch',
            function: 'patchApplication',
          },
          contexts: {
            splash_screen: {
              platform: Platform.OS,
              patch_attempt: true,
            },
          },
        });

        Sentry.setTag('splash_screen.patch_failed', true);
      }
    },
  );
}

export default {};
