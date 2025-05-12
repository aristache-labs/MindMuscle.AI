import React, { createContext, useContext, useState, useEffect, ReactNode, JSX } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabaseUrl, supabaseAnonKey } from '../services/supabase';
import { AuthError, AuthSession, AuthResponse } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

interface AuthContextType {
  supabase: SupabaseClient;
  session: AuthSession | null;
  loading: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<AuthResponse>;
  signUp: (email: string, password: string, fullName: string, rememberMe?: boolean) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: AuthError | null }>;
  error: AuthError | null;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  updateUserMetadata: (metadata: { [key: string]: any }) => Promise<void>;
  user: {
    id: string;
    email: string;
    full_name?: string;
    user_metadata?: { [key: string]: any };
  } | null;
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

  const [supabase, setSupabase] = useState<SupabaseClient>(() => createSupabaseClient(true));
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<AuthError | null>(null);

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      logger.info('Auth state changed', { context: { event: _event } });
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = async (
    email: string, 
    password: string, 
    rememberMe = false
  ): Promise<AuthResponse> => {
    try {
      setError(null);
      setIsLoading(true);
      // Create a new Supabase client with the appropriate session persistence
      const newClient = createSupabaseClient(rememberMe);
      setSupabase(newClient);

      const response = await newClient.auth.signInWithPassword({
        email,
        password,
      });

      if (response.error) {
        logger.error('Sign in failed', response.error, { 
          context: { email } 
        });
        setError(response.error);
      } else {
        logger.info('User signed in successfully', { 
          context: { email } 
        });
        setError(null);
      }
      
      return response;
    } catch (err) {
      const authError = err as AuthError;
      logger.error('Unexpected error during sign in', authError, { 
        context: { email } 
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
    rememberMe = false
  ): Promise<AuthResponse> => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Create a new Supabase client with the appropriate session persistence
      const newClient = createSupabaseClient(rememberMe);
      setSupabase(newClient);
      
      const response = await newClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (response.error) {
        logger.error('Sign up failed', response.error, { 
          context: { email } 
        });
        setError(response.error);
      } else {
        logger.info('User signed up successfully', { 
          context: { email } 
        });
        setError(null);
      }

      return response;
    } catch (err) {
      const authError = err as AuthError;
      logger.error('Unexpected error during sign up', authError, { 
        context: { email } 
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
      const response = await supabase.auth.signOut();
      
      if (response.error) {
        logger.error('Sign out failed', response.error);
        setError(response.error);
      } else {
        logger.info('User signed out successfully');
        setError(null);
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
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        if (error.name === 'AuthSessionMissingError') {
          // Session is missing, we should reset the state and let auth guards handle the redirect
          logger.warn('Auth session missing during refresh, clearing session state', { 
            context: { error: error.message } 
          });
          setSession(null);
          return;
        }
        
        logger.error('Error refreshing user:', error);
        throw error;
      }
      
      if (user) {
        try {
          const { data: { session: newSession }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            logger.error('Error getting session:', sessionError);
            throw sessionError;
          }
          setSession(newSession);
        } catch (sessionErr: any) {
          // If we can't get a session but we have a user, something is wrong with the session
          // We should reset the auth state
          if (sessionErr.name === 'AuthSessionMissingError') {
            logger.warn('Auth session missing while having user data, clearing session state', { 
              context: { error: sessionErr.message } 
            });
            setSession(null);
            return;
          }
          throw sessionErr;
        }
      }
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(err?.message || 'Unknown error');
      logger.error('Error refreshing user data:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserMetadata = async (metadata: { [key: string]: any }) => {
    try {
      setIsLoading(true);
      const { data: { user }, error } = await supabase.auth.updateUser({
        data: metadata
      });

      if (error) {
        logger.error('Error updating user metadata:', error);
        throw error;
      }

      if (user) {
        const { data: { session: newSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          logger.error('Error getting session:', sessionError);
          throw sessionError;
        }
        setSession(newSession);
      }
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(err?.message || 'Unknown error');
      logger.error('Error updating user metadata:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    supabase,
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
    user: session?.user ? {
      id: session.user.id,
      email: session.user.email || '',
      full_name: session.user.user_metadata?.full_name,
      user_metadata: session.user.user_metadata,
    } : null,
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