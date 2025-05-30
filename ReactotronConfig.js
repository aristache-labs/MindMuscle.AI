/* eslint-disable no-undef */
import Reactotron, {
  asyncStorage,
  networking,
  openInEditor,
  trackGlobalErrors,
} from 'reactotron-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apisaucePlugin from 'reactotron-apisauce';
import { QueryClientManager, reactotronReactQuery } from 'reactotron-react-query';
import { queryClient } from './app/services/queryClient';
// import { reactotronRedux } from 'reactotron-redux'; // Uncomment when using Redux
// import { mst } from 'reactotron-mst'; // Uncomment when using MobX State Tree
// import mmkvPlugin from 'reactotron-react-native-mmkv'; // MMKV plugin - doesn't work with Expo
// import { storage } from '../path/to/mmkv/storage'; // Update path when using MMKV

if (__DEV__) {
  // Create QueryClientManager for React Query debugging
  const queryClientManager = new QueryClientManager({
    // @ts-expect-error - Suppress TypeScript warning for queryClient
    queryClient,
  });

  const reactotron = Reactotron.setAsyncStorageHandler(AsyncStorage)
    .configure({
      name: 'MindMuscle.AI',
      host: 'localhost', // Change this to your computer's IP if using a physical device
      port: 9090,
      onDisconnect: () => {
        // Clean up React Query manager when Reactotron disconnects
        queryClientManager.unsubscribe();
      },
    })
    // Temporarily disable global error tracking to prevent infinite recursion
    // .use(
    //   trackGlobalErrors({
    //     // Filter out React Native internal frames for cleaner stack traces
    //     veto: (frame) => {
    //       // Add safety check for frame and fileName
    //       if (!frame || !frame.fileName || typeof frame.fileName !== 'string') {
    //         return true; // Filter out invalid frames
    //       }

    //       const fileName = frame.fileName;

    //       // Filter out React Native internal files
    //       if (fileName.indexOf('/node_modules/react-native/') >= 0) {
    //         return true;
    //       }
    //       // Filter out Metro bundler files
    //       if (fileName.indexOf('/metro/') >= 0) {
    //         return true;
    //       }
    //       // Filter out Expo internal files
    //       if (fileName.indexOf('/expo/') >= 0) {
    //         return true;
    //       }
    //       // Filter out Reactotron files to prevent infinite loops
    //       if (fileName.indexOf('ReactotronConfig') >= 0 || fileName.indexOf('reactotron') >= 0) {
    //         return true;
    //       }
    //       // Filter out other common noise
    //       if (
    //         fileName.includes('node_modules/@react-native') ||
    //         fileName.includes('node_modules/expo') ||
    //         fileName.includes('node_modules/reactotron') ||
    //         fileName.includes('__prelude__') ||
    //         fileName.includes('polyfills') ||
    //         fileName.includes('debuggingUtils') ||
    //         fileName.includes('errorTestingUtils')
    //       ) {
    //         return true;
    //       }
    //       // Keep all other frames
    //       return false;
    //     },
    //   }),
    // )
    .use(
      asyncStorage({
        // Ignore sensitive data from being displayed in Reactotron
        ignore: [
          'secure_', // All secure storage keys
          'auth_token', // Authentication tokens
          'user_credentials', // User credentials
          'api_keys', // API keys
          'session_data', // Session information
          'biometric_data', // Biometric authentication data
          'encrypted_', // Any encrypted data
        ],
      }),
    )
    .use(
      networking({
        // Ignore image content types to keep logs clean
        ignoreContentTypes: /^(image)\/.*$/i,
        // Ignore noisy development requests
        ignoreUrls: /\/(logs|symbolicate|hot-reload|inspector)$/,
      }),
    )
    .use(
      apisaucePlugin({
        // Skip printing the body of image requests to keep logs clean
        ignoreContentTypes: /^(image)\/.*$/i,
      }),
    )
    .use(openInEditor()) // Open code in editor when clicked
    .use(reactotronReactQuery(queryClientManager))
    // Redux Plugin - Uncomment when using Redux
    // .use(
    //   reactotronRedux({
    //     // Ignore noisy actions to keep logs clean
    //     except: [
    //       'persist/PERSIST',
    //       'persist/REHYDRATE',
    //       'persist/REGISTER',
    //       'persist/FLUSH',
    //       'persist/PAUSE',
    //       'persist/PURGE',
    //       'EFFECT_TRIGGERED',
    //       'EFFECT_RESOLVED',
    //       'EFFECT_REJECTED',
    //     ],
    //     // Highlight important actions
    //     isActionImportant: (action) => {
    //       return action.type.includes('ERROR') ||
    //              action.type.includes('SUCCESS') ||
    //              action.type.includes('WORKOUT') ||
    //              action.type.includes('USER');
    //     },
    //     // Filter sensitive data before sending to Reactotron
    //     onBackup: (state) => {
    //       const { auth, ...safeState } = state;
    //       return {
    //         ...safeState,
    //         auth: {
    //           ...auth,
    //           token: '[REDACTED]',
    //           refreshToken: '[REDACTED]',
    //           user: auth.user ? { ...auth.user, email: '[REDACTED]' } : null,
    //         },
    //       };
    //     },
    //     // Handle state restoration
    //     onRestore: (state) => {
    //       console.log('Redux state restored from Reactotron:', state);
    //       return state;
    //     },
    //   })
    // )
    // MMKV Plugin - Uncomment when using MMKV (doesn't work with Expo currently)
    // .use(
    //   mmkvPlugin({
    //     storage, // Your MMKV storage instance
    //     ignore: [
    //       'secure_', // All secure storage keys
    //       'auth_token', // Authentication tokens
    //       'user_credentials', // User credentials
    //       'api_keys', // API keys
    //       'session_data', // Session information
    //       'biometric_data', // Biometric authentication data
    //       'encrypted_', // Any encrypted data
    //     ],
    //   })
    // )
    // MST Plugin - Uncomment when using MobX State Tree
    // .use(
    //   mst({
    //     // Filter out postProcessSnapshot actions for cleaner logs
    //     filter: (event) => !/postProcessSnapshot/.test(event.name),
    //     // Use live state instead of snapshots for better performance
    //     queryMode: 'live'
    //   })
    // )
    .useReactNative({
      asyncStorage: false, // Disable built-in AsyncStorage since we're using the dedicated plugin
      networking: false, // Disable built-in networking since we're using the dedicated plugin
      editor: true, // Enable editor integration for opening files
      overlay: true, // Enable overlay for design comparison
      storybook: true, // Enable Storybook integration
    })
    .connect();

  // Clear Reactotron on every time we load the app in DEV
  reactotron.clear();

  console.log(
    'Reactotron configured and connected for MindMuscle.AI with Global Error Tracking, React Query Debugging, AsyncStorage, Networking, API monitoring, Editor integration, Overlay, Storybook, and Redux support (when enabled)',
  );

  // Export reactotron for use in Redux store configuration and Storybook switcher
  global.reactotron = reactotron;

  // Make reactotron available on console for easy access (Tip: Piggybacking on Console)
  console.tron = reactotron;

  // Add fancy console magic methods for enhanced debugging
  console.tron.logImportant = (message, ...args) => {
    reactotron.logImportant(message, ...args);
  };

  console.tron.display = (config) => {
    reactotron.display(config);
  };

  // Add convenience methods for common debugging scenarios
  console.tron.error = (message, error) => {
    reactotron.display({
      name: '🚨 Error',
      value: { message, error: error?.message || error, stack: error?.stack },
      preview: `Error: ${message}`,
      important: true,
    });
  };

  console.tron.success = (message, data) => {
    reactotron.display({
      name: '✅ Success',
      value: { message, data },
      preview: `Success: ${message}`,
      important: false,
    });
  };

  console.tron.warning = (message, data) => {
    reactotron.display({
      name: '⚠️ Warning',
      value: { message, data },
      preview: `Warning: ${message}`,
      important: true,
    });
  };

  console.tron.api = (endpoint, method, data, response) => {
    reactotron.display({
      name: '🌐 API Call',
      value: { endpoint, method, data, response },
      preview: `${method?.toUpperCase() || 'GET'} ${endpoint}`,
      important: false,
    });
  };

  console.tron.state = (stateName, state) => {
    reactotron.display({
      name: '🏪 State Update',
      value: { stateName, state },
      preview: `State: ${stateName}`,
      important: false,
    });
  };

  console.tron.navigation = (routeName, params) => {
    reactotron.display({
      name: '🧭 Navigation',
      value: { routeName, params },
      preview: `Navigate to: ${routeName}`,
      important: false,
    });
  };

  console.tron.performance = (operation, duration, details) => {
    const isImportant = duration > 1000; // Mark as important if over 1 second
    reactotron.display({
      name: '⚡ Performance',
      value: { operation, duration: `${duration}ms`, details },
      preview: `${operation}: ${duration}ms`,
      important: isImportant,
    });
  };

  // Add a helper for debugging React component renders
  console.tron.render = (componentName, props, state) => {
    reactotron.display({
      name: '🎨 Component Render',
      value: { componentName, props, state },
      preview: `Render: ${componentName}`,
      important: false,
    });
  };

  // Add a helper for debugging async operations
  console.tron.async = (operationName, promise) => {
    const startTime = Date.now();
    console.tron.log(`🔄 Starting async operation: ${operationName}`);

    return promise
      .then((result) => {
        const duration = Date.now() - startTime;
        console.tron.success(`Async operation completed: ${operationName}`, {
          duration: `${duration}ms`,
          result,
        });
        return result;
      })
      .catch((error) => {
        const duration = Date.now() - startTime;
        console.tron.error(`Async operation failed: ${operationName}`, {
          duration: `${duration}ms`,
          error: error?.message || error,
          stack: error?.stack,
        });
        throw error;
      });
  };

  // Add React Query debugging methods
  console.tron.reactQuery = {
    logCache: () => {
      const cache = queryClient.getQueryCache();
      const queries = cache.getAll();

      console.tron.display({
        name: '🔍 React Query Cache',
        value: {
          totalQueries: queries.length,
          queries: queries.map((query) => ({
            queryKey: query.queryKey,
            status: query.state.status,
            fetchStatus: query.state.fetchStatus,
            isStale: query.isStale(),
            isActive: query.isActive(),
          })),
        },
        preview: `${queries.length} queries in cache`,
        important: false,
      });
    },

    invalidateAll: async () => {
      const startTime = Date.now();
      console.tron.log('🔄 Invalidating all queries...');

      try {
        await queryClient.invalidateQueries();
        const duration = Date.now() - startTime;
        console.tron.success('All queries invalidated', { duration: `${duration}ms` });
      } catch (error) {
        const duration = Date.now() - startTime;
        console.tron.error('Failed to invalidate queries', {
          duration: `${duration}ms`,
          error: error?.message || error,
        });
      }
    },

    clearCache: () => {
      const cache = queryClient.getQueryCache();
      const queriesCount = cache.getAll().length;
      queryClient.clear();
      console.tron.logImportant(`🗑️ React Query cache cleared (${queriesCount} queries removed)`);
    },

    refetchAll: async () => {
      const startTime = Date.now();
      console.tron.log('🔄 Refetching all queries...');

      try {
        await queryClient.refetchQueries();
        const duration = Date.now() - startTime;
        console.tron.success('All queries refetched', { duration: `${duration}ms` });
      } catch (error) {
        const duration = Date.now() - startTime;
        console.tron.error('Failed to refetch queries', {
          duration: `${duration}ms`,
          error: error?.message || error,
        });
      }
    },
  };

  // Log successful Reactotron setup
  console.tron.logImportant('🚀 Reactotron is ready! Use console.tron for enhanced debugging.');

  // Display welcome message with available methods
  console.tron.display({
    name: '🎉 Reactotron Enhanced Setup Complete',
    value: {
      availableMethods: [
        'console.tron.log(message)',
        'console.tron.logImportant(message)',
        'console.tron.display(config)',
        'console.tron.error(message, error)',
        'console.tron.success(message, data)',
        'console.tron.warning(message, data)',
        'console.tron.api(endpoint, method, data, response)',
        'console.tron.state(stateName, state)',
        'console.tron.navigation(routeName, params)',
        'console.tron.performance(operation, duration, details)',
        'console.tron.render(componentName, props, state)',
        'console.tron.async(operationName, promise)',
        'console.tron.reactQuery.logCache()',
        'console.tron.reactQuery.invalidateAll()',
        'console.tron.reactQuery.clearCache()',
        'console.tron.reactQuery.refetchAll()',
      ],
      globalUtilities: [
        'ErrorTester.runAll() - Test error tracking',
        'DebugUtils.debugReactQuery.* - React Query debugging',
        'global.reactotron - Direct Reactotron access',
      ],
    },
    preview: 'Reactotron enhanced with custom debugging methods + React Query',
    important: true,
  });
}

export default __DEV__ ? global.reactotron : undefined;
