import { logger } from '../utils/logger';
import { MeasurementsResponseSchema } from '../validation/apiSchemas';
import { MeasurementSchema } from '../validation/schemas';
import { apiClient } from './apiClient';
import supabase from './supabase';
import { validationService } from './validationService';

export interface Measurement {
  id: string;
  user_id: string;
  category: string;
  value: number;
  unit: string;
  measured_at?: string;
  previous_value?: number | null;
  created_at: string;
  updated_at: string;
}

export const MEASUREMENT_CATEGORIES = {
  WEIGHT: 'WEIGHT',
  BICEPS: 'BICEPS',
  ABS: 'ABS',
  WAIST: 'WAIST',
  CHEST: 'CHEST',
  SHLDRS: 'SHLDRS',
  THIGH: 'THIGH',
  CALF: 'CALF',
} as const;

export type MeasurementCategory = keyof typeof MEASUREMENT_CATEGORIES;

export const measurementService = {
  // Get all measurements for a user with API schema validation
  async getUserMeasurements(userId: string): Promise<Measurement[]> {
    try {
      // Try API client with schema validation first
      try {
        const response = await apiClient.requestWithValidation(
          {
            url: `/rest/v1/measurements?user_id=eq.${userId}&select=*&order=measured_at.desc`,
            method: 'GET',
          },
          MeasurementsResponseSchema,
          {
            cache: { enabled: true, ttl: 180000 }, // 3 minutes cache
            auth: { required: true },
          },
        );

        const apiResponse = response.data as {
          success: true;
          data: Array<{
            id: string;
            userId: string;
            type:
              | 'weight'
              | 'height'
              | 'body_fat'
              | 'muscle_mass'
              | 'waist'
              | 'chest'
              | 'arms'
              | 'thighs';
            value: number;
            unit: 'kg' | 'lbs' | 'cm' | 'inches' | 'percentage';
            date: string;
            notes?: string;
            createdAt: string;
          }>;
        };

        // Transform API response to internal Measurement interface
        const transformedMeasurements: Measurement[] = apiResponse.data.map((measurement) => ({
          id: measurement.id,
          user_id: measurement.userId,
          category: measurement.type.toUpperCase(),
          value: measurement.value,
          unit: measurement.unit,
          measured_at: measurement.date,
          previous_value: null, // Will be calculated separately if needed
          created_at: measurement.createdAt,
          updated_at: measurement.createdAt, // API doesn't have separate updated_at
        }));

        logger.info('User measurements fetched and validated successfully via API client', {
          context: {
            userId,
            count: transformedMeasurements.length,
            fromCache: response.fromCache,
            validationPassed: response.processed,
          },
        });

        return transformedMeasurements;
      } catch (apiError) {
        logger.warn(
          'API client failed for user measurements, falling back to direct Supabase call',
          {
            context: { userId, error: (apiError as Error).message },
          },
        );

        // Fallback to direct Supabase call
        const { data, error } = await supabase
          .from('measurements')
          .select('*')
          .eq('user_id', userId)
          .order('measured_at', { ascending: false });

        if (error) {
          logger.error('Error fetching user measurements from database', error, {
            context: { userId },
          });
          throw error;
        }

        logger.info('User measurements fetched successfully via fallback', {
          context: { userId, count: data?.length || 0 },
        });

        return data || [];
      }
    } catch (error) {
      logger.error('Failed to fetch user measurements', error as Error, {
        context: { userId },
      });
      throw error;
    }
  },

  // Get latest measurements for each category
  async getLatestMeasurements(
    userId: string,
  ): Promise<Record<MeasurementCategory, Measurement | null>> {
    const { data, error } = await supabase
      .from('measurements')
      .select('*')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false });

    if (error) throw error;

    const latest: Partial<Record<MeasurementCategory, Measurement>> = {};
    const secondLatest: Partial<Record<MeasurementCategory, Measurement>> = {};

    // Group by category and get the latest and second latest for each
    data.forEach((measurement) => {
      const category = measurement.category as MeasurementCategory;
      if (!latest[category]) {
        latest[category] = measurement;
      } else if (!secondLatest[category]) {
        secondLatest[category] = measurement;
      }
    });

    // Add previous_value to each latest measurement
    Object.keys(latest).forEach((category) => {
      const categoryKey = category as MeasurementCategory;
      if (latest[categoryKey] && secondLatest[categoryKey]) {
        latest[categoryKey] = {
          ...latest[categoryKey]!,
          previous_value: secondLatest[categoryKey]!.value,
        };
      }
    });

    // Ensure all categories have a value (null if no measurement exists)
    return Object.keys(MEASUREMENT_CATEGORIES).reduce(
      (acc, category) => {
        acc[category as MeasurementCategory] = latest[category as MeasurementCategory] || null;
        return acc;
      },
      {} as Record<MeasurementCategory, Measurement | null>,
    );
  },

  // Get measurement history for a category
  async getMeasurementHistory(
    userId: string,
    category: MeasurementCategory,
  ): Promise<Measurement[]> {
    const { data, error } = await supabase
      .from('measurements')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .order('measured_at', { ascending: false });

    if (error) throw error;

    // Process measurements to ensure proper sorting and arrow calculation
    // The measurements are already sorted by date in descending order (newest first)
    // We need to reverse the order to show oldest first in the UI
    const sortedMeasurements = [...data].reverse();

    return sortedMeasurements;
  },

  // Add a new measurement and clean up old ones
  async addMeasurement(
    userId: string,
    category: MeasurementCategory,
    value: number,
    unit: string,
    measured_at?: string,
  ): Promise<Measurement> {
    try {
      // Validate measurement data before database operation
      const measurementData = {
        user_id: userId,
        measurement_type: category.toLowerCase(),
        value,
        unit,
        measured_at: measured_at || new Date().toISOString(),
      };

      const validationResult = validationService.validateMeasurement(measurementData);
      if (!validationResult.success) {
        const errorMessage = `Measurement validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        logger.error('Measurement validation failed', new Error(errorMessage), {
          context: { measurementData, errors: validationResult.errors },
        });
        throw new Error(errorMessage);
      }

      // First, get all measurements for this category
      const { data: existingMeasurements, error: fetchError } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .order('created_at', { ascending: true });

      if (fetchError) {
        logger.error('Error fetching existing measurements', fetchError, {
          context: { userId, category },
        });
        throw fetchError;
      }

      // Add the new measurement
      const { data: newMeasurement, error: insertError } = await supabase
        .from('measurements')
        .insert([
          {
            user_id: userId,
            category,
            value,
            unit,
            measured_at: measured_at || new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) {
        logger.error('Error inserting new measurement', insertError, {
          context: { measurementData },
        });
        throw insertError;
      }

      // If we have more than 3 measurements (first + last 2), delete the extras
      if (existingMeasurements && existingMeasurements.length > 2) {
        // Keep the first measurement

        // Get IDs of measurements to delete (excluding first measurement and last measurement)
        const measurementsToDelete = existingMeasurements
          .slice(1, -1) // Exclude first and last measurement
          .map((m) => m.id);

        if (measurementsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('measurements')
            .delete()
            .in('id', measurementsToDelete);

          if (deleteError) {
            logger.error('Error deleting old measurements', deleteError, {
              context: { measurementsToDelete },
            });
            throw deleteError;
          }
        }
      }

      logger.info('Measurement added successfully', {
        context: { measurementId: newMeasurement.id, category, value, unit },
      });
      return newMeasurement;
    } catch (error) {
      logger.error('Failed to add measurement', error as Error, {
        context: { userId, category, value, unit, measured_at },
      });
      throw error;
    }
  },

  // Update a measurement
  async updateMeasurement(
    measurementId: string,
    updates: Partial<Measurement>,
  ): Promise<Measurement> {
    try {
      // Validate the measurement ID
      if (!measurementId || typeof measurementId !== 'string') {
        throw new Error('Valid measurement ID is required');
      }

      // Validate update data if provided
      if (Object.keys(updates).length > 0) {
        const validationResult = validationService.validateWithSchema(
          MeasurementSchema.partial(),
          updates,
          'measurement update',
        );

        if (!validationResult.success) {
          const errorMessage = `Measurement update validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
          logger.error('Measurement update validation failed', new Error(errorMessage), {
            context: { measurementId, updates, errors: validationResult.errors },
          });
          throw new Error(errorMessage);
        }
      }

      const { data, error } = await supabase
        .from('measurements')
        .update(updates)
        .eq('id', measurementId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating measurement in database', error, {
          context: { measurementId, updates },
        });
        throw error;
      }

      logger.info('Measurement updated successfully', {
        context: { measurementId: data.id, category: data.category, value: data.value },
      });
      return data;
    } catch (error) {
      logger.error('Failed to update measurement', error as Error, {
        context: { measurementId, updates },
      });
      throw error;
    }
  },

  // Delete a measurement
  async deleteMeasurement(measurementId: string): Promise<void> {
    try {
      // Validate the measurement ID
      if (!measurementId || typeof measurementId !== 'string') {
        throw new Error('Valid measurement ID is required');
      }

      const { error } = await supabase.from('measurements').delete().eq('id', measurementId);

      if (error) {
        logger.error('Error deleting measurement from database', error, {
          context: { measurementId },
        });
        throw error;
      }

      logger.info('Measurement deleted successfully', {
        context: { measurementId },
      });
    } catch (error) {
      logger.error('Failed to delete measurement', error as Error, {
        context: { measurementId },
      });
      throw error;
    }
  },
};

export default measurementService;
