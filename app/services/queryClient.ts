import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default query configuration
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (previously cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
});

// Create a persister for AsyncStorage
// We need to create a custom adapter since the AsyncStorage functions are async
export const asyncStoragePersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await AsyncStorage.setItem('MINDMUSCLE_QUERY_CACHE', JSON.stringify(client));
  },
  restoreClient: async () => {
    const storageValue = await AsyncStorage.getItem('MINDMUSCLE_QUERY_CACHE');
    if (storageValue) {
      return JSON.parse(storageValue) as PersistedClient;
    }
    return undefined;
  },
  removeClient: async () => {
    await AsyncStorage.removeItem('MINDMUSCLE_QUERY_CACHE');
  },
};

// This is only here to satisfy Expo Router and is not meant to be used
export default function QueryClientProvider() {
  return null;
}
