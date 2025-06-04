import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { validationService } from './validationService';

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
    const authData = await AsyncStorage.getItem('auth');
    if (authData) {
      // Validate the parsed auth data using Zod
      const validationResult = await validationService.validateAuthState(JSON.parse(authData));

      if (validationResult.success) {
        return validationResult.data;
      } else {
        logger.warn('Invalid auth data found in storage, clearing it', {
          context: { errors: validationResult.errors },
        });
        // Clear invalid data
        await AsyncStorage.removeItem('auth');
        return { user: null, token: null };
      }
    }
    return { user: null, token: null };
  } catch (error) {
    logger.error('Error getting auth state', error as Error);
    // Clear potentially corrupted data
    await AsyncStorage.removeItem('auth').catch(() => {});
    return { user: null, token: null };
  }
};

export const setAuth = async (authState: AuthState): Promise<void> => {
  try {
    // Validate the auth state before storing
    const validationResult = await validationService.validateAuthState(authState);

    if (!validationResult.success) {
      const errorMessage = `Invalid auth state: ${validationResult.errors.map((e) => e.message).join(', ')}`;
      logger.error('Cannot store invalid auth state', new Error(errorMessage), {
        context: { authState, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }

    await AsyncStorage.setItem('auth', JSON.stringify(validationResult.data));
  } catch (error) {
    logger.error('Error setting auth state', error as Error, {
      context: { authState },
    });
    throw error;
  }
};

export const clearAuth = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('auth');
  } catch (error) {
    logger.error('Error clearing auth state', error as Error);
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
