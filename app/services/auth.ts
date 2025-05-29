import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

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
      return JSON.parse(authData);
    }
    return { user: null, token: null };
  } catch (error) {
    console.error('Error getting auth state:', error);
    return { user: null, token: null };
  }
};

export const setAuth = async (authState: AuthState): Promise<void> => {
  try {
    await AsyncStorage.setItem('auth', JSON.stringify(authState));
  } catch (error) {
    console.error('Error setting auth state:', error);
    throw error;
  }
};

export const clearAuth = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('auth');
  } catch (error) {
    console.error('Error clearing auth state:', error);
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
