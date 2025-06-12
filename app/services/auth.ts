import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { validationService } from './validationService';
// Add Sentry imports
import { captureStorageError, captureValidationError } from './sentry';
import { addBreadcrumb } from './sentry/simpleErrorHandler';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

export const getAuth = async (): Promise<AuthState> => {
  try {
    addBreadcrumb('Getting auth state from storage', 'auth');

    const authData = await AsyncStorage.getItem('auth');
    if (authData) {
      // Validate the parsed auth data using Zod
      const validationResult = await validationService.validateAuthState(JSON.parse(authData));

      if (validationResult.success) {
        const authState = validationResult.data as AuthState;
        addBreadcrumb('Auth state retrieved successfully', 'auth', {
          hasUser: !!authState.user,
          hasToken: !!authState.token,
        });
        return authState;
      } else {
        logger.warn('Invalid auth data found in storage, clearing it', {
          context: { errors: validationResult.errors },
        });
        captureValidationError(new Error('Invalid auth data in storage'), 'authData');
        // Clear invalid data
        await AsyncStorage.removeItem('auth');
        return { user: null, token: null };
      }
    }
    addBreadcrumb('No auth data found in storage', 'auth');
    return { user: null, token: null };
  } catch (error) {
    logger.error('Error getting auth state', error as Error);
    captureStorageError(error as Error, 'AsyncStorage', 'getItem');
    // Clear potentially corrupted data
    await AsyncStorage.removeItem('auth').catch(() => {});
    return { user: null, token: null };
  }
};

export const setAuth = async (authState: AuthState): Promise<void> => {
  try {
    addBreadcrumb('Setting auth state in storage', 'auth', {
      hasUser: !!authState.user,
      hasToken: !!authState.token,
    });

    // Validate the auth state before storing
    const validationResult = await validationService.validateAuthState(authState);

    if (!validationResult.success) {
      const errorMessage = `Invalid auth state: ${validationResult.errors.map((e) => e.message).join(', ')}`;
      logger.error('Cannot store invalid auth state', new Error(errorMessage), {
        context: { authState, errors: validationResult.errors },
      });
      captureValidationError(new Error(errorMessage), 'authState');
      throw new Error(errorMessage);
    }

    await AsyncStorage.setItem('auth', JSON.stringify(validationResult.data as AuthState));
    addBreadcrumb('Auth state stored successfully', 'auth');
  } catch (error) {
    logger.error('Error setting auth state', error as Error, {
      context: { authState },
    });
    captureStorageError(error as Error, 'AsyncStorage', 'setItem');
    throw error;
  }
};

export const clearAuth = async (): Promise<void> => {
  try {
    addBreadcrumb('Clearing auth state from storage', 'auth');
    await AsyncStorage.removeItem('auth');
    addBreadcrumb('Auth state cleared successfully', 'auth');
  } catch (error) {
    logger.error('Error clearing auth state', error as Error);
    captureStorageError(error as Error, 'AsyncStorage', 'removeItem');
    throw error;
  }
};

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({ user: null, token: null });

  useEffect(() => {
    const loadAuth = async () => {
      const state = await getAuth();
      setAuthState(state);
    };
    loadAuth();
  }, []);

  return {
    ...authState,
    setAuth: async (state: AuthState) => {
      await setAuth(state);
      setAuthState(state);
    },
    clearAuth: async () => {
      await clearAuth();
      setAuthState({ user: null, token: null });
    },
  };
};

export default useAuth;
