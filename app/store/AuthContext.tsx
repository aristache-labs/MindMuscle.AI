import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import {
  AuthError,
  AuthResponse,
  AuthSession,
  createClient,
  SupabaseClient,
} from '@supabase/supabase-js';
import React, { createContext, JSX, ReactNode, useContext, useEffect, useState } from 'react';
import { supabaseAnonKey, supabaseUrl } from '../services/supabase';
import { safeAsyncFireAndForget } from '../utils/asyncErrorHandler';
import { logger } from '../utils/logger';
import secureStorage from '../utils/secureStorage';

// Keys for secure storage (same as in login.tsx)
const SAVED_EMAIL_KEY = 'mindmuscle_saved_email';
const SAVED_PASSWORD_KEY = 'mindmuscle_saved_password';
const REMEMBER_ME_KEY = 'mindmuscle_remember_me';

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  user_metadata?: Record<string, unknown>;
}

interface AuthContextType {
  supabase: SupabaseClient;
  session: AuthSession | null;
  loading: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<AuthResponse>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    rememberMe?: boolean,
  ) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: AuthError | null }>;
  error: AuthError | null;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  updateUserMetadata: (metadata: Record<string, unknown>) => Promise<void>;
  user: UserProfile | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const createSupabaseClient = (persistSession: boolean): SupabaseClient => {
    try {
      Sentry.addBreadcrumb({
        message: 'Creating Supabase client',
        category: 'auth.client',
        data: { persistSession },
        level: 'debug',
      });

      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: persistSession,
          persistSession: persistSession,
          detectSessionInUrl: false,
        },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'createSupabaseClient' },
        extra: { persistSession },
      });
      throw error;
    }
  };

  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [_supabase] = useState(createSupabaseClient(true));

  const clearError = () => {
    Sentry.addBreadcrumb({
      message: 'Clearing auth error',
      category: 'auth.error',
      level: 'debug',
    });
    setError(null);
  };

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();

    Sentry.addBreadcrumb({
      message: 'Initializing auth context',
      category: 'auth.init',
      level: 'info',
    });

    // Add timeout to prevent infinite loading
    const initTimeout = setTimeout(() => {
      if (isMounted) {
        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          message: 'Auth initialization timeout',
          category: 'auth.init',
          data: { duration, timeout: 5000 },
          level: 'warning',
        });
        console.warn('Auth initialization timeout, setting loading to false');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    // Get initial session with error handling
    const initializeAuth = async () => {
      try {
        Sentry.addBreadcrumb({
          message: 'Getting initial session',
          category: 'auth.init',
          level: 'debug',
        });

        const {
          data: { session },
          error,
        } = await _supabase.auth.getSession();

        if (isMounted) {
          if (error) {
            Sentry.captureException(error, {
              tags: { operation: 'initializeAuth', step: 'getSession' },
            });
            console.warn('Error getting initial session:', error);
            setSession(null);
          } else {
            const duration = Date.now() - startTime;
            Sentry.addBreadcrumb({
              message: 'Successfully initialized auth',
              category: 'auth.init',
              data: {
                hasSession: !!session,
                userId: session?.user?.id,
                duration,
              },
              level: 'info',
            });
            setSession(session);
          }
          setLoading(false);
          clearTimeout(initTimeout);
        }
      } catch (err) {
        const duration = Date.now() - startTime;
        Sentry.captureException(err, {
          tags: { operation: 'initializeAuth' },
          extra: { duration },
        });
        console.error('Failed to initialize auth:', err);
        if (isMounted) {
          setSession(null);
          setLoading(false);
          clearTimeout(initTimeout);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = _supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        Sentry.addBreadcrumb({
          message: 'Auth state changed',
          category: 'auth.state',
          data: {
            event: _event,
            hasSession: !!session,
            userId: session?.user?.id,
          },
          level: 'info',
        });
        logger.info('Auth state changed', { context: { event: _event } });
        setSession(session);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      subscription.unsubscribe();
    };
  }, [_supabase]);

  const signIn = async (
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<AuthResponse> => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Starting sign in process',
        category: 'auth.signin',
        data: { email, rememberMe },
        level: 'info',
      });

      setError(null);
      setIsLoading(true);

      // Always persist session for login functionality
      // The rememberMe parameter only affects credential storage, not session persistence
      const response = await _supabase.auth.signInWithPassword({
        email,
        password,
      });

      const duration = Date.now() - startTime;

      if (response.error) {
        Sentry.captureException(response.error, {
          tags: { operation: 'signIn', step: 'signInWithPassword' },
          extra: {
            email,
            rememberMe,
            duration,
            errorCode: response.error.status,
          },
        });
        logger.error('Sign in failed', response.error, {
          context: { email },
        });
        setError(response.error);
      } else {
        Sentry.addBreadcrumb({
          message: 'User signed in successfully',
          category: 'auth.signin',
          data: {
            email,
            rememberMe,
            userId: response.data.user?.id,
            duration,
          },
          level: 'info',
        });
        logger.info('User signed in successfully', {
          context: { email, rememberMe },
        });
        setError(null);
      }

      return response;
    } catch (err) {
      const duration = Date.now() - startTime;
      const authError = err as AuthError;

      Sentry.captureException(authError, {
        tags: { operation: 'signIn' },
        extra: { email, rememberMe, duration },
      });

      logger.error('Unexpected error during sign in', authError, {
        context: { email },
      });
      setError(authError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    rememberMe = false,
  ): Promise<AuthResponse> => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Starting sign up process',
        category: 'auth.signup',
        data: { email, fullName, rememberMe },
        level: 'info',
      });

      setError(null);
      setIsLoading(true);

      // Always persist session for login functionality
      // The rememberMe parameter only affects credential storage, not session persistence
      const response = await _supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      const duration = Date.now() - startTime;

      if (response.error) {
        Sentry.captureException(response.error, {
          tags: { operation: 'signUp', step: 'signUpWithPassword' },
          extra: {
            email,
            fullName,
            rememberMe,
            duration,
            errorCode: response.error.status,
          },
        });
        logger.error('Sign up failed', response.error, {
          context: { email },
        });
        setError(response.error);
      } else {
        Sentry.addBreadcrumb({
          message: 'User signed up successfully',
          category: 'auth.signup',
          data: {
            email,
            fullName,
            rememberMe,
            userId: response.data.user?.id,
            needsConfirmation: !response.data.session,
            duration,
          },
          level: 'info',
        });
        logger.info('User signed up successfully', {
          context: { email, rememberMe },
        });
        setError(null);
      }

      return response;
    } catch (err) {
      const duration = Date.now() - startTime;
      const authError = err as AuthError;

      Sentry.captureException(authError, {
        tags: { operation: 'signUp' },
        extra: { email, fullName, rememberMe, duration },
      });

      logger.error('Unexpected error during sign up', authError, {
        context: { email },
      });
      setError(authError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<{ error: AuthError | null }> => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Starting sign out process',
        category: 'auth.signout',
        data: { userId: session?.user?.id },
        level: 'info',
      });

      setError(null);
      setIsLoading(true);
      const response = await _supabase.auth.signOut();

      const duration = Date.now() - startTime;

      if (response.error) {
        Sentry.captureException(response.error, {
          tags: { operation: 'signOut', step: 'supabaseSignOut' },
          extra: {
            userId: session?.user?.id,
            duration,
            errorCode: response.error.status,
          },
        });
        logger.error('Sign out failed', response.error);
        setError(response.error);
      } else {
        Sentry.addBreadcrumb({
          message: 'User signed out successfully',
          category: 'auth.signout',
          data: {
            userId: session?.user?.id,
            duration,
          },
          level: 'info',
        });
        logger.info('User signed out successfully');
        setError(null);

        // Handle saved credentials based on remember me preference
        safeAsyncFireAndForget(
          async () => {
            Sentry.addBreadcrumb({
              message: 'Handling saved credentials on sign out',
              category: 'auth.signout',
              level: 'debug',
            });

            // Check if user had remember me enabled
            const savedRememberMe = await secureStorage.getItemAsync(REMEMBER_ME_KEY);
            const shouldRemember = savedRememberMe === 'true';

            if (shouldRemember) {
              // If remember me was enabled, only clear the password, keep email and remember me preference
              await secureStorage.deleteItemAsync(SAVED_PASSWORD_KEY);

              Sentry.addBreadcrumb({
                message: 'Cleared password only, preserving email and remember me preference',
                category: 'auth.signout',
                level: 'debug',
              });

              logger.info('Cleared password only on sign out, preserving remember me');
            } else {
              // If remember me was not enabled, clear everything
              await Promise.all([
                secureStorage.deleteItemAsync(SAVED_EMAIL_KEY),
                secureStorage.deleteItemAsync(SAVED_PASSWORD_KEY),
                secureStorage.deleteItemAsync(REMEMBER_ME_KEY),
              ]);

              Sentry.addBreadcrumb({
                message: 'Cleared all saved credentials',
                category: 'auth.signout',
                level: 'debug',
              });

              logger.info('Cleared all saved credentials on sign out');
            }
          },
          {
            errorPrefix: 'Failed to handle saved credentials on sign out',
            context: { action: 'sign_out' },
            logToConsole: true,
          },
        );
      }

      return response;
    } catch (err) {
      const duration = Date.now() - startTime;
      const authError = err as AuthError;

      Sentry.captureException(authError, {
        tags: { operation: 'signOut' },
        extra: {
          userId: session?.user?.id,
          duration,
        },
      });

      logger.error('Unexpected error during sign out', authError);
      setError(authError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Starting user refresh',
        category: 'auth.refresh',
        data: { userId: session?.user?.id },
        level: 'info',
      });

      setIsLoading(true);
      const {
        data: { user },
        error,
      } = await _supabase.auth.getUser();

      if (error) {
        if (error.name === 'AuthSessionMissingError') {
          // Session is missing, we should reset the state and let auth guards handle the redirect
          const duration = Date.now() - startTime;

          Sentry.addBreadcrumb({
            message: 'Auth session missing during refresh, clearing session state',
            category: 'auth.refresh',
            data: {
              errorName: error.name,
              errorMessage: error.message,
              duration,
            },
            level: 'warning',
          });

          logger.warn('Auth session missing during refresh, clearing session state', {
            context: { error: error.message },
          });
          setSession(null);
          return;
        }

        Sentry.captureException(error, {
          tags: { operation: 'refreshUser', step: 'getUser' },
          extra: {
            userId: session?.user?.id,
            errorName: error.name,
            duration: Date.now() - startTime,
          },
        });

        logger.error('Error refreshing user:', error);
        throw error;
      }

      if (user) {
        Sentry.addBreadcrumb({
          message: 'User data retrieved, getting session',
          category: 'auth.refresh',
          data: { userId: user.id },
          level: 'debug',
        });

        try {
          const {
            data: { session: newSession },
            error: sessionError,
          } = await _supabase.auth.getSession();

          if (sessionError) {
            Sentry.captureException(sessionError, {
              tags: { operation: 'refreshUser', step: 'getSession' },
              extra: {
                userId: user.id,
                errorName: sessionError.name,
                duration: Date.now() - startTime,
              },
            });
            logger.error('Error getting session:', sessionError);
            throw sessionError;
          }

          const duration = Date.now() - startTime;
          Sentry.addBreadcrumb({
            message: 'Successfully refreshed user and session',
            category: 'auth.refresh',
            data: {
              userId: user.id,
              hasSession: !!newSession,
              duration,
            },
            level: 'info',
          });

          setSession(newSession);
        } catch (sessionErr: unknown) {
          // If we can't get a session but we have a user, something is wrong with the session
          // We should reset the auth state
          const error = sessionErr as Error;
          if (error.name === 'AuthSessionMissingError') {
            const duration = Date.now() - startTime;

            Sentry.addBreadcrumb({
              message: 'Auth session missing while having user data, clearing session state',
              category: 'auth.refresh',
              data: {
                userId: user.id,
                errorName: error.name,
                errorMessage: error.message,
                duration,
              },
              level: 'warning',
            });

            logger.warn('Auth session missing while having user data, clearing session state', {
              context: { error: error.message },
            });
            setSession(null);
            return;
          }
          throw sessionErr;
        }
      }
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const error =
        err instanceof Error ? err : new Error((err as Error)?.message || 'Unknown error');

      Sentry.captureException(error, {
        tags: { operation: 'refreshUser' },
        extra: {
          userId: session?.user?.id,
          duration,
        },
      });

      logger.error('Error refreshing user data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserMetadata = async (metadata: Record<string, unknown>) => {
    const startTime = Date.now();

    try {
      Sentry.addBreadcrumb({
        message: 'Starting user metadata update',
        category: 'auth.metadata',
        data: {
          userId: session?.user?.id,
          metadataKeys: Object.keys(metadata),
        },
        level: 'info',
      });

      setIsLoading(true);
      const {
        data: { user },
        error,
      } = await _supabase.auth.updateUser({
        data: metadata,
      });

      if (error) {
        const duration = Date.now() - startTime;

        Sentry.captureException(error, {
          tags: { operation: 'updateUserMetadata', step: 'updateUser' },
          extra: {
            userId: session?.user?.id,
            metadataKeys: Object.keys(metadata),
            errorCode: error.status,
            duration,
          },
        });

        logger.error('Error updating user metadata:', error);
        throw error;
      }

      if (user) {
        Sentry.addBreadcrumb({
          message: 'User metadata updated, refreshing session',
          category: 'auth.metadata',
          data: { userId: user.id },
          level: 'debug',
        });

        const {
          data: { session: newSession },
          error: sessionError,
        } = await _supabase.auth.getSession();

        if (sessionError) {
          const duration = Date.now() - startTime;

          Sentry.captureException(sessionError, {
            tags: { operation: 'updateUserMetadata', step: 'getSession' },
            extra: {
              userId: user.id,
              errorName: sessionError.name,
              duration,
            },
          });

          logger.error('Error getting session:', sessionError);
          throw sessionError;
        }

        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          message: 'Successfully updated user metadata and refreshed session',
          category: 'auth.metadata',
          data: {
            userId: user.id,
            metadataKeys: Object.keys(metadata),
            hasSession: !!newSession,
            duration,
          },
          level: 'info',
        });

        setSession(newSession);
      }
    } catch (err: unknown) {
      const duration = Date.now() - startTime;
      const error =
        err instanceof Error ? err : new Error((err as Error)?.message || 'Unknown error');

      Sentry.captureException(error, {
        tags: { operation: 'updateUserMetadata' },
        extra: {
          userId: session?.user?.id,
          metadataKeys: Object.keys(metadata),
          duration,
        },
      });

      logger.error('Error updating user metadata:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    supabase: _supabase,
    session,
    loading,
    isLoading,
    signIn,
    signUp,
    signOut,
    error,
    clearError,
    refreshUser,
    updateUserMetadata,
    user: session?.user
      ? {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name,
          user_metadata: session.user.user_metadata,
        }
      : null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthProvider;
