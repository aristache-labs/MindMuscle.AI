import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { measurementService, Measurement, MeasurementCategory } from '../services/measurements';
import { useAuth } from './AuthContext';
import supabase from '../services/supabase';
import { setUser, setContext, setTag } from '../services/sentry';
import { captureError, addBreadcrumb } from '../services/sentry/simpleErrorHandler';

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
  const [measurements, setMeasurements] = useState<Record<MeasurementCategory, Measurement | null>>(
    {} as Record<MeasurementCategory, Measurement | null>,
  );
  const [measurementHistory, setMeasurementHistory] = useState<
    Record<MeasurementCategory, Measurement[]>
  >({} as Record<MeasurementCategory, Measurement[]>);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMeasurements = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      addBreadcrumb('Loading user measurements', 'measurements');

      // Set user context for Sentry
      setUser({
        id: user.id,
        email: user.email || undefined,
      });

      setTag('measurements.operation', 'load_measurements');

      // Load latest measurements for all categories
      const latestMeasurements = await measurementService.getLatestMeasurements(user.id);
      setMeasurements(latestMeasurements);

      addBreadcrumb('Latest measurements loaded successfully', 'measurements');

      // Load history for all categories
      const history: Record<MeasurementCategory, Measurement[]> = {} as Record<
        MeasurementCategory,
        Measurement[]
      >;

      let totalHistoryRecords = 0;
      for (const category of Object.keys(latestMeasurements) as MeasurementCategory[]) {
        const categoryHistory = await measurementService.getMeasurementHistory(user.id, category);
        history[category] = categoryHistory;
        totalHistoryRecords += categoryHistory.length;
      }

      setMeasurementHistory(history);

      addBreadcrumb('Measurement history loaded successfully', 'measurements');

      setContext('measurements_context', {
        user_id: user.id,
        categories_loaded: Object.keys(latestMeasurements).length,
        total_history_records: totalHistoryRecords,
        has_measurements: Object.values(latestMeasurements).some((m) => m !== null),
      });

      setTag('measurements.load_status', 'success');
    } catch (err) {
      const error = err as Error;
      console.error('Error loading measurements:', error);

      addBreadcrumb('Error loading measurements', 'measurements');

      captureError(error, {
        category: 'database_error',
        component: 'MeasurementsContext',
        operation: 'load_measurements',
        userId: user?.id,
      });

      setError('Failed to load measurements');
      setTag('measurements.load_status', 'error');
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

      addBreadcrumb('Adding new measurement', 'measurements');

      setTag('measurements.operation', 'add_measurement');
      setContext('measurement_addition', {
        category,
        value,
        unit,
        user_id: user.id,
      });

      await measurementService.addMeasurement(user.id, category, value, unit);

      addBreadcrumb('Measurement added successfully', 'measurements');

      // If updating weight, also update user_profile_details
      if (category === 'WEIGHT') {
        addBreadcrumb('Updating user profile with new weight', 'measurements');

        await supabase
          .from('user_profile_details')
          .update({ weight_kg: value })
          .eq('user_id', user.id);

        addBreadcrumb('User profile weight updated successfully', 'measurements');
      }

      await loadMeasurements(); // Refresh all measurements

      addBreadcrumb('Measurements refreshed after addition', 'measurements');

      setTag('measurements.add_status', 'success');
      setContext('measurement_success', {
        category,
        value,
        unit,
        profile_updated: category === 'WEIGHT',
      });
    } catch (err) {
      const error = err as Error;
      console.error('Error adding measurement:', error);

      addBreadcrumb('Error adding measurement', 'measurements');

      captureError(error, {
        category: 'database_error',
        component: 'MeasurementsContext',
        operation: 'add_measurement',
        userId: user?.id,
        measurementCategory: category,
        value: value.toString(),
        unit,
      });

      setError('Failed to add measurement');
      setTag('measurements.add_status', 'error');
      throw error;
    }
  };

  const deleteMeasurement = async (measurementId: string, category: MeasurementCategory) => {
    try {
      setError(null);

      addBreadcrumb('Deleting measurement', 'measurements');

      setTag('measurements.operation', 'delete_measurement');
      setContext('measurement_deletion', {
        measurement_id: measurementId,
        category,
        user_id: user?.id,
      });

      await measurementService.deleteMeasurement(measurementId);

      addBreadcrumb('Measurement deleted successfully', 'measurements');

      await loadMeasurements(); // Refresh all measurements

      addBreadcrumb('Measurements refreshed after deletion', 'measurements');

      setTag('measurements.delete_status', 'success');
      setContext('measurement_delete_success', {
        measurement_id: measurementId,
        category,
      });
    } catch (err) {
      const error = err as Error;
      console.error('Error deleting measurement:', error);

      addBreadcrumb('Error deleting measurement', 'measurements');

      captureError(error, {
        category: 'database_error',
        component: 'MeasurementsContext',
        operation: 'delete_measurement',
        userId: user?.id,
        measurementId,
        measurementCategory: category,
      });

      setError('Failed to delete measurement');
      setTag('measurements.delete_status', 'error');
      throw error;
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

  return <MeasurementsContext.Provider value={value}>{children}</MeasurementsContext.Provider>;
}

export function useMeasurements() {
  const context = useContext(MeasurementsContext);
  if (context === undefined) {
    const error = new Error('useMeasurements must be used within a MeasurementsProvider');

    addBreadcrumb('useMeasurements hook used outside provider', 'measurements');

    captureError(error, {
      category: 'ui_error',
      component: 'MeasurementsContext',
      operation: 'use_measurements_hook',
    });

    throw error;
  }
  return context;
}

export default MeasurementsProvider;
