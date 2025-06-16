import { initializeApp, FirebaseApp } from 'firebase/app';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import * as Sentry from '@sentry/react-native';

// Check if Firebase environment variables are available
const hasFirebaseConfig =
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
  process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN &&
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID &&
  process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = hasFirebaseConfig
  ? {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    }
  : null;

// Initialize Firebase only if we have configuration
let app: FirebaseApp | undefined;
let storage: FirebaseStorage | undefined;

/**
 * Initialize Firebase with comprehensive Sentry monitoring
 */
function initializeFirebaseWithSentry() {
  const startTime = performance.now();

  try {
    // Add breadcrumb for Firebase initialization attempt
    Sentry.addBreadcrumb({
      message: 'Firebase initialization started',
      category: 'firebase.initialization',
      level: 'info',
      data: {
        hasConfig: !!firebaseConfig,
        storageBucket: firebaseConfig?.storageBucket || 'not_configured',
        timestamp: new Date().toISOString(),
      },
    });

    if (!firebaseConfig) {
      const warningMessage =
        'Firebase configuration not found. Firebase features will not be available.';

      // Log warning with Sentry
      Sentry.captureMessage(warningMessage, 'warning');

      // Set context for debugging
      Sentry.setContext('firebase_config', {
        status: 'missing',
        available_env_vars: {
          api_key: !!process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
          auth_domain: !!process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
          project_id: !!process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
          storage_bucket: !!process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
        },
        timestamp: new Date().toISOString(),
      });

      console.warn(warningMessage);
      return;
    }

    // Initialize Firebase app
    app = initializeApp(firebaseConfig);

    // Initialize Firebase storage
    storage = getStorage(app);

    const initializationDuration = performance.now() - startTime;

    // Log successful initialization
    console.log('Firebase initialized with storage bucket:', firebaseConfig.storageBucket);

    // Add success breadcrumb
    Sentry.addBreadcrumb({
      message: 'Firebase initialized successfully',
      category: 'firebase.initialization',
      level: 'info',
      data: {
        storageBucket: firebaseConfig.storageBucket,
        duration_ms: initializationDuration.toFixed(2),
        projectId: firebaseConfig.projectId,
        timestamp: new Date().toISOString(),
      },
    });

    // Set Firebase context for debugging
    Sentry.setContext('firebase_config', {
      status: 'initialized',
      project_id: firebaseConfig.projectId,
      storage_bucket: firebaseConfig.storageBucket,
      auth_domain: firebaseConfig.authDomain,
      initialization_duration_ms: initializationDuration.toFixed(2),
      timestamp: new Date().toISOString(),
    });

    // Track performance if initialization was slow
    if (initializationDuration > 1000) {
      Sentry.captureMessage(
        `Slow Firebase initialization detected: ${initializationDuration.toFixed(2)}ms`,
        'warning',
      );
    }

    // Capture successful initialization message
    Sentry.captureMessage('Firebase service initialized successfully', 'info');
  } catch (error) {
    const initializationDuration = performance.now() - startTime;

    console.error('Error initializing Firebase:', error);

    // Capture Firebase initialization error
    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'firebase_initialization');
      scope.setTag('service', 'firebase');

      scope.setContext('firebase_initialization_error', {
        duration_ms: initializationDuration.toFixed(2),
        config_available: !!firebaseConfig,
        storage_bucket: firebaseConfig?.storageBucket || 'not_available',
        project_id: firebaseConfig?.projectId || 'not_available',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });

      scope.addBreadcrumb({
        message: 'Firebase initialization failed',
        category: 'firebase.initialization',
        level: 'error',
        data: {
          error_message: error instanceof Error ? error.message : 'Unknown error',
          duration_ms: initializationDuration.toFixed(2),
          timestamp: new Date().toISOString(),
        },
      });

      Sentry.captureException(error);
    });
  }
}

// Initialize Firebase with Sentry monitoring
if (firebaseConfig) {
  initializeFirebaseWithSentry();
} else {
  // Log missing configuration
  Sentry.addBreadcrumb({
    message: 'Firebase configuration missing - skipping initialization',
    category: 'firebase.configuration',
    level: 'warning',
    data: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Firebase service utilities with Sentry monitoring
 */
export const FirebaseService = {
  /**
   * Get Firebase app instance with error handling
   */
  getApp: (): FirebaseApp | undefined => {
    try {
      if (!app) {
        Sentry.captureMessage('Firebase app not initialized', 'warning');
      }
      return app;
    } catch (error) {
      Sentry.captureException(error);
      return undefined;
    }
  },

  /**
   * Get Firebase storage instance with error handling
   */
  getStorage: (): FirebaseStorage | undefined => {
    try {
      if (!storage) {
        Sentry.captureMessage('Firebase storage not initialized', 'warning');
      }
      return storage;
    } catch (error) {
      Sentry.captureException(error);
      return undefined;
    }
  },

  /**
   * Check if Firebase is properly configured and initialized
   */
  isInitialized: (): boolean => {
    try {
      const initialized = !!(app && storage);

      Sentry.addBreadcrumb({
        message: `Firebase initialization check: ${initialized ? 'initialized' : 'not initialized'}`,
        category: 'firebase.status_check',
        level: initialized ? 'info' : 'warning',
        data: {
          app_available: !!app,
          storage_available: !!storage,
          config_available: !!firebaseConfig,
          timestamp: new Date().toISOString(),
        },
      });

      return initialized;
    } catch (error) {
      Sentry.captureException(error);
      return false;
    }
  },

  /**
   * Get Firebase configuration status
   */
  getConfigStatus: () => {
    try {
      const status = {
        hasConfig: !!firebaseConfig,
        isInitialized: !!(app && storage),
        projectId: firebaseConfig?.projectId || null,
        storageBucket: firebaseConfig?.storageBucket || null,
      };

      Sentry.addBreadcrumb({
        message: 'Firebase configuration status requested',
        category: 'firebase.config_status',
        level: 'info',
        data: {
          ...status,
          timestamp: new Date().toISOString(),
        },
      });

      return status;
    } catch (error) {
      Sentry.captureException(error);
      return {
        hasConfig: false,
        isInitialized: false,
        projectId: null,
        storageBucket: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

// Add a default export React component to satisfy Expo Router
export default function FirebaseWrapper() {
  // This component is never actually rendered, it's just here to satisfy Expo Router
  return null;
}

export { app, storage };
