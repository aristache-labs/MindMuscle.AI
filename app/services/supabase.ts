import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import {
  captureAPIError,
  capturePerformanceError,
  captureValidationError,
  setContext,
  setTag,
} from './sentry';
import { addBreadcrumb, captureMessage, simpleErrorHandler } from './sentry/simpleErrorHandler';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  const configError = new Error('Missing Supabase configuration: URL or anonymous key not found');
  captureValidationError(configError, 'supabase_config', {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
  });
  throw configError;
}

// Set up Sentry context for Supabase client
setContext('supabase_client', {
  service: 'SupabaseClient',
  version: '1.0.0',
  url: supabaseUrl,
  features: ['auth', 'database', 'storage', 'realtime_disabled'],
  client_info: 'mindmuscle-ai-react-native',
});
setTag('service.type', 'supabase');

addBreadcrumb('Initializing Supabase client', 'system', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  timestamp: new Date().toISOString(),
});

// Create Supabase client with enhanced monitoring
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    // Disable realtime to prevent Node.js module imports
    params: {
      eventsPerSecond: 0,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'mindmuscle-ai-react-native',
    },
  },
});

// Enhanced auth state monitoring with Sentry
supabase.auth.onAuthStateChange((event, session) => {
  const eventStartTime = Date.now();

  addBreadcrumb('Supabase auth state changed', 'auth', {
    event,
    hasSession: !!session,
    userId: session?.user?.id,
    timestamp: new Date().toISOString(),
  });

  try {
    switch (event) {
      case 'INITIAL_SESSION':
        if (session) {
          simpleErrorHandler.setUser(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.username,
          );

          addBreadcrumb('Initial session established', 'auth', {
            userId: session.user.id,
            email: session.user.email,
            hasMetadata: !!session.user.user_metadata,
          });

          captureMessage('Supabase initial session established', 'info', {
            category: 'auth_error',
            userId: session.user.id,
            email: session.user.email,
            sessionId: session.access_token.substring(0, 10) + '...',
          });
        } else {
          addBreadcrumb('No initial session found', 'auth', {
            event: 'INITIAL_SESSION',
          });
        }
        break;

      case 'SIGNED_IN':
        if (session) {
          simpleErrorHandler.setUser(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.username,
          );

          addBreadcrumb('User signed in successfully', 'auth', {
            userId: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
          });

          captureMessage('User signed in to Supabase', 'info', {
            category: 'auth_error',
            userId: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
          });
        }
        break;

      case 'SIGNED_OUT':
        simpleErrorHandler.setUser('', '', ''); // Clear user context

        addBreadcrumb('User signed out', 'auth', {
          event: 'SIGNED_OUT',
        });

        captureMessage('User signed out from Supabase', 'info', {
          category: 'auth_error',
        });
        break;

      case 'PASSWORD_RECOVERY':
        addBreadcrumb('Password recovery initiated', 'auth', {
          event: 'PASSWORD_RECOVERY',
        });

        captureMessage('Password recovery initiated', 'info', {
          category: 'auth_error',
        });
        break;

      case 'TOKEN_REFRESHED':
        if (session) {
          addBreadcrumb('Auth token refreshed', 'auth', {
            userId: session.user.id,
            expiresAt: session.expires_at,
          });

          // Track token refresh performance
          const refreshDuration = Date.now() - eventStartTime;
          if (refreshDuration > 5000) {
            // 5 seconds
            capturePerformanceError(
              'Slow token refresh',
              'token_refresh_duration',
              refreshDuration,
            );
          }
        }
        break;

      case 'USER_UPDATED':
        if (session) {
          simpleErrorHandler.setUser(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.username,
          );

          addBreadcrumb('User profile updated', 'auth', {
            userId: session.user.id,
            email: session.user.email,
          });

          captureMessage('User profile updated in Supabase', 'info', {
            category: 'auth_error',
            userId: session.user.id,
          });
        }
        break;

      default:
        addBreadcrumb('Unknown auth event', 'auth', {
          event,
          hasSession: !!session,
        });

        captureMessage('Unknown Supabase auth event', 'warning', {
          category: 'auth_error',
          event,
          hasSession: !!session,
        });
        break;
    }

    // Track auth event processing time
    const processingTime = Date.now() - eventStartTime;
    if (processingTime > 1000) {
      // 1 second
      capturePerformanceError(
        'Slow auth event processing',
        'auth_event_processing',
        processingTime,
      );
    }
  } catch (error) {
    const processingTime = Date.now() - eventStartTime;

    captureAPIError(error as Error, 'auth_state_change', 'supabase');

    addBreadcrumb('Auth state change processing failed', 'error', {
      event,
      processingTime,
      error: (error as Error).message,
    });
  }
});

// Track client initialization success
addBreadcrumb('Supabase client initialized successfully', 'system', {
  url: supabaseUrl,
  authConfigured: true,
  realtimeDisabled: true,
  timestamp: new Date().toISOString(),
});

captureMessage('Supabase client initialized successfully', 'info', {
  category: 'javascript_error',
  service: 'supabase',
  url: supabaseUrl,
  features: ['auth', 'database', 'storage'],
  realtimeEnabled: false,
});

export default supabase;
