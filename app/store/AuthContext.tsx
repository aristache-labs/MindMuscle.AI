import AsyncStorage from '@react-native-async-storage/async-storage';
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
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: persistSession,
        persistSession: persistSession,
        detectSessionInUrl: false,
      },
    });
  };

  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [_supabase, _setSupabase] = useState(createSupabaseClient(true));

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    let isMounted = true;

    // Add timeout to prevent infinite loading
    const initTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Auth initialization timeout, setting loading to false');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    // Get initial session with error handling
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await _supabase.auth.getSession();

        if (isMounted) {
          if (error) {
            console.warn('Error getting initial session:', error);
            setSession(null);
          } else {
            setSession(session);
          }
          setLoading(false);
          clearTimeout(initTimeout);
        }
      } catch (err) {
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
    try {
      setError(null);
      setIsLoading(true);

      // Always persist session for login functionality
      // The rememberMe parameter only affects credential storage, not session persistence
      const response = await _supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (response.error) {
        logger.error('Sign in failed', response.error, {
          context: { email },
        });
        setError(response.error);
      } else {
        logger.info('User signed in successfully', {
          context: { email, rememberMe },
        });
        setError(null);
      }

      return response;
    } catch (err) {
      const authError = err as AuthError;
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
    try {
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

      if (response.error) {
        logger.error('Sign up failed', response.error, {
          context: { email },
        });
        setError(response.error);
      } else {
        logger.info('User signed up successfully', {
          context: { email, rememberMe },
        });
        setError(null);
      }

      return response;
    } catch (err) {
      const authError = err as AuthError;
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
    try {
      setError(null);
      setIsLoading(true);
      const response = await _supabase.auth.signOut();

      if (response.error) {
        logger.error('Sign out failed', response.error);
        setError(response.error);
      } else {
        logger.info('User signed out successfully');
        setError(null);

        // Clear saved credentials when user explicitly signs out
        safeAsyncFireAndForget(
          async () => {
            await Promise.all([
              secureStorage.deleteItemAsync(SAVED_EMAIL_KEY),
              secureStorage.deleteItemAsync(SAVED_PASSWORD_KEY),
              secureStorage.deleteItemAsync(REMEMBER_ME_KEY),
            ]);
            logger.info('Saved credentials cleared on sign out');
          },
          {
            errorPrefix: 'Failed to clear saved credentials on sign out',
            context: { action: 'sign_out' },
            logToConsole: true,
          },
        );
      }

      return response;
    } catch (err) {
      const authError = err as AuthError;
      logger.error('Unexpected error during sign out', authError);
      setError(authError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      setIsLoading(true);
      const {
        data: { user },
        error,
      } = await _supabase.auth.getUser();

      if (error) {
        if (error.name === 'AuthSessionMissingError') {
          // Session is missing, we should reset the state and let auth guards handle the redirect
          logger.warn('Auth session missing during refresh, clearing session state', {
            context: { error: error.message },
          });
          setSession(null);
          return;
        }

        logger.error('Error refreshing user:', error);
        throw error;
      }

      if (user) {
        try {
          const {
            data: { session: newSession },
            error: sessionError,
          } = await _supabase.auth.getSession();
          if (sessionError) {
            logger.error('Error getting session:', sessionError);
            throw sessionError;
          }
          setSession(newSession);
        } catch (sessionErr: unknown) {
          // If we can't get a session but we have a user, something is wrong with the session
          // We should reset the auth state
          const error = sessionErr as Error;
          if (error.name === 'AuthSessionMissingError') {
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
      const error =
        err instanceof Error ? err : new Error((err as Error)?.message || 'Unknown error');
      logger.error('Error refreshing user data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserMetadata = async (metadata: Record<string, unknown>) => {
    try {
      setIsLoading(true);
      const {
        data: { user },
        error,
      } = await _supabase.auth.updateUser({
        data: metadata,
      });

      if (error) {
        logger.error('Error updating user metadata:', error);
        throw error;
      }

      if (user) {
        const {
          data: { session: newSession },
          error: sessionError,
        } = await _supabase.auth.getSession();
        if (sessionError) {
          logger.error('Error getting session:', sessionError);
          throw sessionError;
        }
        setSession(newSession);
      }
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err : new Error((err as Error)?.message || 'Unknown error');
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
