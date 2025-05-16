import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import workoutPlanService from '../services/workoutPlanService';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  lastSync: Date | null;
  manualSync: () => Promise<void>;
  isSyncing: boolean;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  isInternetReachable: null,
  lastSync: null,
  manualSync: async () => {},
  isSyncing: false,
});

export const useNetwork = () => useContext(NetworkContext);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [networkState, setNetworkState] = useState<NetworkContextType>({
    isConnected: true,
    isInternetReachable: null,
    lastSync: null,
    manualSync: async () => {},
    isSyncing: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setNetworkState(prev => ({
        ...prev,
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
      }));

      // If connection is restored, sync offline data
      if (state.isConnected && state.isInternetReachable) {
        console.log('Network connection available, syncing offline data...');
        syncOfflineData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const syncOfflineData = async () => {
    try {
      // Avoid multiple sync operations running at the same time
      if (isSyncing) {
        console.log('Sync already in progress, skipping');
        return;
      }
      
      setIsSyncing(true);
      console.log('Network connection available, starting data sync...');

      // Call the original syncOfflineData method to maintain compatibility
      try {
        await workoutPlanService.syncOfflineData();
        console.log('General data sync completed');
      } catch (syncError) {
        console.error('Error in general data sync:', syncError);
      }
      
      // Sync workout exercise history data specifically
      try {
        const exerciseHistorySuccess = await workoutPlanService.syncOfflineExerciseData();
        console.log('Exercise history sync result:', exerciseHistorySuccess ? 'Success' : 'Some items failed');
      } catch (exerciseError) {
        console.error('Error in exercise history sync:', exerciseError);
      }
      
      // Update last sync timestamp regardless of success/failure
      setNetworkState(prev => ({
        ...prev,
        lastSync: new Date(),
      }));
      
      console.log('Data sync completed at:', new Date().toISOString());
    } catch (error) {
      console.error('Error syncing offline data:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Function to manually trigger a sync
  const manualSync = async () => {
    console.log('Manual sync triggered');
    return syncOfflineData();
  };

  // Update the network state with the sync function
  useEffect(() => {
    setNetworkState(prev => ({
      ...prev,
      manualSync,
      isSyncing,
    }));
  }, [isSyncing]);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
} 