import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { measurementService, Measurement, MeasurementCategory } from '../services/measurements';
import { useAuth } from './AuthContext';
import supabase from '../services/supabase';

interface MeasurementsContextType {
  measurements: Record<MeasurementCategory, Measurement | null>;
  measurementHistory: Record<MeasurementCategory, Measurement[]>;
  loading: boolean;
  error: string | null;
  addMeasurement: (category: MeasurementCategory, value: number, unit: string) => Promise<void>;
  deleteMeasurement: (measurementId: string, category: MeasurementCategory) => Promise<void>;
  refreshMeasurements: () => Promise<void>;
}

const MeasurementsContext = createContext<MeasurementsContextType | undefined>(undefined);

export function MeasurementsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<Record<MeasurementCategory, Measurement | null>>({} as Record<MeasurementCategory, Measurement | null>);
  const [measurementHistory, setMeasurementHistory] = useState<Record<MeasurementCategory, Measurement[]>>({} as Record<MeasurementCategory, Measurement[]>);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMeasurements = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Load latest measurements for all categories
      const latestMeasurements = await measurementService.getLatestMeasurements(user.id);
      setMeasurements(latestMeasurements);

      // Load history for all categories
      const history: Record<MeasurementCategory, Measurement[]> = {} as Record<MeasurementCategory, Measurement[]>;
      for (const category of Object.keys(latestMeasurements) as MeasurementCategory[]) {
        const categoryHistory = await measurementService.getMeasurementHistory(user.id, category);
        history[category] = categoryHistory;
      }
      setMeasurementHistory(history);
    } catch (err) {
      console.error('Error loading measurements:', err);
      setError('Failed to load measurements');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadMeasurements();
  }, [loadMeasurements]);

  const addMeasurement = async (category: MeasurementCategory, value: number, unit: string) => {
    if (!user?.id) return;

    try {
      setError(null);
      await measurementService.addMeasurement(user.id, category, value, unit);

      // If updating weight, also update user_profile_details
      if (category === 'WEIGHT') {
        await supabase
          .from('user_profile_details')
          .update({ weight_kg: value })
          .eq('user_id', user.id);
      }

      await loadMeasurements(); // Refresh all measurements
    } catch (err) {
      console.error('Error adding measurement:', err);
      setError('Failed to add measurement');
      throw err;
    }
  };

  const deleteMeasurement = async (measurementId: string, category: MeasurementCategory) => {
    try {
      setError(null);
      await measurementService.deleteMeasurement(measurementId);
      await loadMeasurements(); // Refresh all measurements
    } catch (err) {
      console.error('Error deleting measurement:', err);
      setError('Failed to delete measurement');
      throw err;
    }
  };

  const value = {
    measurements,
    measurementHistory,
    loading,
    error,
    addMeasurement,
    deleteMeasurement,
    refreshMeasurements: loadMeasurements,
  };

  return (
    <MeasurementsContext.Provider value={value}>
      {children}
    </MeasurementsContext.Provider>
  );
}

export function useMeasurements() {
  const context = useContext(MeasurementsContext);
  if (context === undefined) {
    throw new Error('useMeasurements must be used within a MeasurementsProvider');
  }
  return context;
} 