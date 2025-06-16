import { logger } from '../utils/logger';
import { MeasurementsResponseSchema } from '../validation/apiSchemas';
import { MeasurementSchema } from '../validation/schemas';
import { apiClient } from './apiClient';
import supabase from './supabase';
import { validationService } from './validationService';
import { SentryDataCollection } from './sentry/dataCollection';
import { SentryLogger } from './sentry/logger';

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
  SHOULDERS: 'SHOULDERS',
  THIGH: 'THIGH',
  CALF: 'CALF',
} as const;

export type MeasurementCategory = keyof typeof MEASUREMENT_CATEGORIES;

export const measurementService = {
  // Get all measurements for a user with API schema validation
  async getUserMeasurements(userId: string): Promise<Measurement[]> {
    const operationStartTime = Date.now();

    // Set initial context for measurement fetching
    SentryDataCollection.setContext('measurement_operation', {
      operation: 'get_user_measurements',
      user_id: userId,
      timestamp: new Date().toISOString(),
      status: 'starting',
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Starting to fetch user measurements',
      category: 'measurements.fetch',
      level: 'info',
      data: {
        user_id: userId,
        operation: 'get_user_measurements',
      },
    });

    try {
      // Try API client with schema validation first
      try {
        const apiStartTime = Date.now();

        SentryDataCollection.addBreadcrumb({
          message: 'Attempting API client request for measurements',
          category: 'measurements.api',
          level: 'debug',
          data: {
            user_id: userId,
            method: 'api_client_with_validation',
          },
        });

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

        const apiDuration = Date.now() - apiStartTime;

        SentryDataCollection.addBreadcrumb({
          message: 'API client request completed successfully',
          category: 'measurements.api',
          level: 'info',
          data: {
            user_id: userId,
            duration: apiDuration,
            from_cache: response.fromCache,
            validation_passed: response.processed,
          },
        });

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
        const transformStartTime = Date.now();
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

        const transformDuration = Date.now() - transformStartTime;
        const totalDuration = Date.now() - operationStartTime;

        SentryDataCollection.addBreadcrumb({
          message: 'Measurements data transformation completed',
          category: 'measurements.transform',
          level: 'debug',
          data: {
            user_id: userId,
            transform_duration: transformDuration,
            measurements_count: transformedMeasurements.length,
          },
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'get_user_measurements',
          user_id: userId,
          status: 'completed',
          method: 'api_client',
          total_duration: totalDuration,
          api_duration: apiDuration,
          transform_duration: transformDuration,
          measurements_count: transformedMeasurements.length,
          from_cache: response.fromCache,
          timestamp: new Date().toISOString(),
        });

        // Track performance metrics
        SentryLogger.database.query('measurements', 'fetch_user_measurements', {
          user_id: userId,
          method: 'api_client',
          duration: totalDuration,
          count: transformedMeasurements.length,
          from_cache: response.fromCache,
        });

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
        const apiDuration = Date.now() - operationStartTime;

        SentryDataCollection.addBreadcrumb({
          message: 'API client failed, falling back to direct Supabase call',
          category: 'measurements.fallback',
          level: 'warning',
          data: {
            user_id: userId,
            api_error: (apiError as Error).message,
            api_duration: apiDuration,
          },
        });

        SentryDataCollection.captureException(apiError as Error, {
          operation: 'get_user_measurements_api',
          user_id: userId,
          duration: apiDuration,
          fallback_available: true,
        });

        logger.warn(
          'API client failed for user measurements, falling back to direct Supabase call',
          {
            context: { userId, error: (apiError as Error).message },
          },
        );

        // Fallback to direct Supabase call
        const fallbackStartTime = Date.now();

        SentryDataCollection.addBreadcrumb({
          message: 'Starting fallback Supabase query',
          category: 'measurements.fallback',
          level: 'info',
          data: {
            user_id: userId,
            method: 'direct_supabase',
          },
        });

        const { data, error } = await supabase
          .from('measurements')
          .select('*')
          .eq('user_id', userId)
          .order('measured_at', { ascending: false });

        const fallbackDuration = Date.now() - fallbackStartTime;
        const totalDuration = Date.now() - operationStartTime;

        if (error) {
          SentryDataCollection.captureException(error, {
            operation: 'get_user_measurements_fallback',
            user_id: userId,
            duration: totalDuration,
            fallback_duration: fallbackDuration,
          });

          SentryDataCollection.setContext('measurement_operation', {
            operation: 'get_user_measurements',
            user_id: userId,
            status: 'failed',
            method: 'fallback_supabase',
            error: error.message,
            duration: totalDuration,
            timestamp: new Date().toISOString(),
          });

          SentryLogger.database.error('measurements', 'fetch_user_measurements', error.message, {
            user_id: userId,
            method: 'fallback_supabase',
            duration: totalDuration,
            error: error,
          });

          logger.error('Error fetching user measurements from database', error, {
            context: { userId },
          });
          throw error;
        }

        SentryDataCollection.addBreadcrumb({
          message: 'Fallback Supabase query completed successfully',
          category: 'measurements.fallback',
          level: 'info',
          data: {
            user_id: userId,
            fallback_duration: fallbackDuration,
            measurements_count: data?.length || 0,
          },
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'get_user_measurements',
          user_id: userId,
          status: 'completed',
          method: 'fallback_supabase',
          total_duration: totalDuration,
          fallback_duration: fallbackDuration,
          measurements_count: data?.length || 0,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.query('measurements', 'fetch_user_measurements', {
          user_id: userId,
          method: 'fallback_supabase',
          duration: totalDuration,
          count: data?.length || 0,
        });

        logger.info('User measurements fetched successfully via fallback', {
          context: { userId, count: data?.length || 0 },
        });

        return data || [];
      }
    } catch (error) {
      const totalDuration = Date.now() - operationStartTime;

      SentryDataCollection.captureException(error as Error, {
        operation: 'get_user_measurements',
        user_id: userId,
        duration: totalDuration,
        failed_completely: true,
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'get_user_measurements',
        user_id: userId,
        status: 'failed',
        error: (error as Error).message,
        duration: totalDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.error(
        'measurements',
        'fetch_user_measurements',
        (error as Error).message,
        {
          user_id: userId,
          duration: totalDuration,
          error: error,
        },
      );

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
    const operationStartTime = Date.now();

    SentryDataCollection.setContext('measurement_operation', {
      operation: 'get_latest_measurements',
      user_id: userId,
      timestamp: new Date().toISOString(),
      status: 'starting',
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Starting to fetch latest measurements for each category',
      category: 'measurements.latest',
      level: 'info',
      data: {
        user_id: userId,
        categories: Object.keys(MEASUREMENT_CATEGORIES),
      },
    });

    try {
      const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', userId)
        .order('measured_at', { ascending: false });

      const queryDuration = Date.now() - operationStartTime;

      if (error) {
        SentryDataCollection.captureException(error, {
          operation: 'get_latest_measurements',
          user_id: userId,
          duration: queryDuration,
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'get_latest_measurements',
          user_id: userId,
          status: 'failed',
          error: error.message,
          duration: queryDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.error('measurements', 'get_latest_measurements', error.message, {
          user_id: userId,
          duration: queryDuration,
          error: error,
        });

        throw error;
      }

      const processingStartTime = Date.now();
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
      const result = Object.keys(MEASUREMENT_CATEGORIES).reduce(
        (acc, category) => {
          acc[category as MeasurementCategory] = latest[category as MeasurementCategory] || null;
          return acc;
        },
        {} as Record<MeasurementCategory, Measurement | null>,
      );

      const processingDuration = Date.now() - processingStartTime;
      const totalDuration = Date.now() - operationStartTime;

      const categoriesWithData = Object.values(result).filter(Boolean).length;

      SentryDataCollection.addBreadcrumb({
        message: 'Latest measurements processing completed',
        category: 'measurements.latest',
        level: 'info',
        data: {
          user_id: userId,
          processing_duration: processingDuration,
          total_measurements: data.length,
          categories_with_data: categoriesWithData,
          total_categories: Object.keys(MEASUREMENT_CATEGORIES).length,
        },
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'get_latest_measurements',
        user_id: userId,
        status: 'completed',
        total_duration: totalDuration,
        query_duration: queryDuration,
        processing_duration: processingDuration,
        total_measurements: data.length,
        categories_with_data: categoriesWithData,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.query('measurements', 'get_latest_measurements', {
        user_id: userId,
        duration: totalDuration,
        total_measurements: data.length,
        categories_with_data: categoriesWithData,
      });

      return result;
    } catch (error) {
      const totalDuration = Date.now() - operationStartTime;

      SentryDataCollection.captureException(error as Error, {
        operation: 'get_latest_measurements',
        user_id: userId,
        duration: totalDuration,
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'get_latest_measurements',
        user_id: userId,
        status: 'failed',
        error: (error as Error).message,
        duration: totalDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.error(
        'measurements',
        'get_latest_measurements',
        (error as Error).message,
        {
          user_id: userId,
          duration: totalDuration,
          error: error,
        },
      );

      throw error;
    }
  },

  // Get measurement history for a category
  async getMeasurementHistory(
    userId: string,
    category: MeasurementCategory,
  ): Promise<Measurement[]> {
    const operationStartTime = Date.now();

    SentryDataCollection.setContext('measurement_operation', {
      operation: 'get_measurement_history',
      user_id: userId,
      category: category,
      timestamp: new Date().toISOString(),
      status: 'starting',
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Starting to fetch measurement history for category',
      category: 'measurements.history',
      level: 'info',
      data: {
        user_id: userId,
        measurement_category: category,
      },
    });

    try {
      const { data, error } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .order('measured_at', { ascending: false });

      const queryDuration = Date.now() - operationStartTime;

      if (error) {
        SentryDataCollection.captureException(error, {
          operation: 'get_measurement_history',
          user_id: userId,
          category: category,
          duration: queryDuration,
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'get_measurement_history',
          user_id: userId,
          category: category,
          status: 'failed',
          error: error.message,
          duration: queryDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.error('measurements', 'get_measurement_history', error.message, {
          user_id: userId,
          category: category,
          duration: queryDuration,
          error: error,
        });

        throw error;
      }

      // Process measurements to ensure proper sorting and arrow calculation
      // The measurements are already sorted by date in descending order (newest first)
      // We need to reverse the order to show oldest first in the UI
      const processingStartTime = Date.now();
      const sortedMeasurements = [...data].reverse();
      const processingDuration = Date.now() - processingStartTime;
      const totalDuration = Date.now() - operationStartTime;

      SentryDataCollection.addBreadcrumb({
        message: 'Measurement history processing completed',
        category: 'measurements.history',
        level: 'info',
        data: {
          user_id: userId,
          category: category,
          processing_duration: processingDuration,
          measurements_count: sortedMeasurements.length,
        },
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'get_measurement_history',
        user_id: userId,
        category: category,
        status: 'completed',
        total_duration: totalDuration,
        query_duration: queryDuration,
        processing_duration: processingDuration,
        measurements_count: sortedMeasurements.length,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.query('measurements', 'get_measurement_history', {
        user_id: userId,
        category: category,
        duration: totalDuration,
        count: sortedMeasurements.length,
      });

      return sortedMeasurements;
    } catch (error) {
      const totalDuration = Date.now() - operationStartTime;

      SentryDataCollection.captureException(error as Error, {
        operation: 'get_measurement_history',
        user_id: userId,
        category: category,
        duration: totalDuration,
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'get_measurement_history',
        user_id: userId,
        category: category,
        status: 'failed',
        error: (error as Error).message,
        duration: totalDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.error(
        'measurements',
        'get_measurement_history',
        (error as Error).message,
        {
          user_id: userId,
          category: category,
          duration: totalDuration,
          error: error,
        },
      );

      throw error;
    }
  },

  // Add a new measurement and clean up old ones
  async addMeasurement(
    userId: string,
    category: MeasurementCategory,
    value: number,
    unit: string,
    measured_at?: string,
  ): Promise<Measurement> {
    const operationStartTime = Date.now();

    SentryDataCollection.setContext('measurement_operation', {
      operation: 'add_measurement',
      user_id: userId,
      category: category,
      value: value,
      unit: unit,
      timestamp: new Date().toISOString(),
      status: 'starting',
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Starting to add new measurement',
      category: 'measurements.add',
      level: 'info',
      data: {
        user_id: userId,
        measurement_category: category,
        value: value,
        unit: unit,
        has_custom_date: !!measured_at,
      },
    });

    try {
      // Validate measurement data before database operation
      const validationStartTime = Date.now();
      const measurementData = {
        user_id: userId,
        measurement_type: category.toLowerCase(),
        value,
        unit,
        measured_at: measured_at || new Date().toISOString(),
      };

      SentryDataCollection.addBreadcrumb({
        message: 'Starting measurement data validation',
        category: 'measurements.validation',
        level: 'debug',
        data: {
          user_id: userId,
          measurement_type: category.toLowerCase(),
        },
      });

      const validationResult = validationService.validateMeasurement(measurementData);
      const validationDuration = Date.now() - validationStartTime;

      if (!validationResult.success) {
        const errorMessage = `Measurement validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;

        SentryDataCollection.captureException(new Error(errorMessage), {
          operation: 'add_measurement_validation',
          user_id: userId,
          category: category,
          validation_errors: validationResult.errors,
          duration: validationDuration,
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'add_measurement',
          user_id: userId,
          category: category,
          status: 'failed',
          error: 'validation_failed',
          validation_duration: validationDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.error('measurements', 'add_measurement', errorMessage, {
          user_id: userId,
          category: category,
          validation_errors: validationResult.errors,
          duration: validationDuration,
        });

        logger.error('Measurement validation failed', new Error(errorMessage), {
          context: { measurementData, errors: validationResult.errors },
        });
        throw new Error(errorMessage);
      }

      SentryDataCollection.addBreadcrumb({
        message: 'Measurement validation completed successfully',
        category: 'measurements.validation',
        level: 'debug',
        data: {
          user_id: userId,
          validation_duration: validationDuration,
        },
      });

      // First, get all measurements for this category
      const fetchStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Fetching existing measurements for cleanup',
        category: 'measurements.cleanup',
        level: 'debug',
        data: {
          user_id: userId,
          category: category,
        },
      });

      const { data: existingMeasurements, error: fetchError } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .order('created_at', { ascending: true });

      const fetchDuration = Date.now() - fetchStartTime;

      if (fetchError) {
        SentryDataCollection.captureException(fetchError, {
          operation: 'add_measurement_fetch_existing',
          user_id: userId,
          category: category,
          duration: fetchDuration,
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'add_measurement',
          user_id: userId,
          category: category,
          status: 'failed',
          error: 'fetch_existing_failed',
          fetch_duration: fetchDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.error('measurements', 'add_measurement', fetchError.message, {
          user_id: userId,
          category: category,
          operation: 'fetch_existing',
          duration: fetchDuration,
          error: fetchError,
        });

        logger.error('Error fetching existing measurements', fetchError, {
          context: { userId, category },
        });
        throw fetchError;
      }

      SentryDataCollection.addBreadcrumb({
        message: 'Existing measurements fetched successfully',
        category: 'measurements.cleanup',
        level: 'debug',
        data: {
          user_id: userId,
          category: category,
          existing_count: existingMeasurements?.length || 0,
          fetch_duration: fetchDuration,
        },
      });

      // Add the new measurement
      const insertStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Inserting new measurement',
        category: 'measurements.insert',
        level: 'info',
        data: {
          user_id: userId,
          category: category,
          value: value,
          unit: unit,
        },
      });

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

      const insertDuration = Date.now() - insertStartTime;

      if (insertError) {
        SentryDataCollection.captureException(insertError, {
          operation: 'add_measurement_insert',
          user_id: userId,
          category: category,
          value: value,
          unit: unit,
          duration: insertDuration,
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'add_measurement',
          user_id: userId,
          category: category,
          status: 'failed',
          error: 'insert_failed',
          insert_duration: insertDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.error('measurements', 'add_measurement', insertError.message, {
          user_id: userId,
          category: category,
          operation: 'insert',
          duration: insertDuration,
          error: insertError,
        });

        logger.error('Error inserting new measurement', insertError, {
          context: { measurementData },
        });
        throw insertError;
      }

      SentryDataCollection.addBreadcrumb({
        message: 'New measurement inserted successfully',
        category: 'measurements.insert',
        level: 'info',
        data: {
          user_id: userId,
          category: category,
          measurement_id: newMeasurement.id,
          insert_duration: insertDuration,
        },
      });

      // If we have more than 3 measurements (first + last 2), delete the extras
      let cleanupDuration = 0;
      let deletedCount = 0;

      if (existingMeasurements && existingMeasurements.length > 2) {
        const cleanupStartTime = Date.now();

        // Keep the first measurement
        // Get IDs of measurements to delete (excluding first measurement and last measurement)
        const measurementsToDelete = existingMeasurements
          .slice(1, -1) // Exclude first and last measurement
          .map((m) => m.id);

        if (measurementsToDelete.length > 0) {
          SentryDataCollection.addBreadcrumb({
            message: 'Starting cleanup of old measurements',
            category: 'measurements.cleanup',
            level: 'info',
            data: {
              user_id: userId,
              category: category,
              measurements_to_delete: measurementsToDelete.length,
            },
          });

          const { error: deleteError } = await supabase
            .from('measurements')
            .delete()
            .in('id', measurementsToDelete);

          cleanupDuration = Date.now() - cleanupStartTime;
          deletedCount = measurementsToDelete.length;

          if (deleteError) {
            SentryDataCollection.captureException(deleteError, {
              operation: 'add_measurement_cleanup',
              user_id: userId,
              category: category,
              measurements_to_delete: measurementsToDelete.length,
              duration: cleanupDuration,
            });

            SentryLogger.database.error('measurements', 'add_measurement', deleteError.message, {
              user_id: userId,
              category: category,
              operation: 'cleanup',
              duration: cleanupDuration,
              error: deleteError,
            });

            logger.error('Error deleting old measurements', deleteError, {
              context: { measurementsToDelete },
            });
            throw deleteError;
          }

          SentryDataCollection.addBreadcrumb({
            message: 'Old measurements cleanup completed',
            category: 'measurements.cleanup',
            level: 'info',
            data: {
              user_id: userId,
              category: category,
              deleted_count: deletedCount,
              cleanup_duration: cleanupDuration,
            },
          });
        }
      }

      const totalDuration = Date.now() - operationStartTime;

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'add_measurement',
        user_id: userId,
        category: category,
        status: 'completed',
        measurement_id: newMeasurement.id,
        total_duration: totalDuration,
        validation_duration: validationDuration,
        fetch_duration: fetchDuration,
        insert_duration: insertDuration,
        cleanup_duration: cleanupDuration,
        deleted_count: deletedCount,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.query('measurements', 'add_measurement', {
        user_id: userId,
        category: category,
        measurement_id: newMeasurement.id,
        duration: totalDuration,
        deleted_count: deletedCount,
      });

      logger.info('Measurement added successfully', {
        context: { measurementId: newMeasurement.id, category, value, unit },
      });
      return newMeasurement;
    } catch (error) {
      const totalDuration = Date.now() - operationStartTime;

      SentryDataCollection.captureException(error as Error, {
        operation: 'add_measurement',
        user_id: userId,
        category: category,
        value: value,
        unit: unit,
        duration: totalDuration,
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'add_measurement',
        user_id: userId,
        category: category,
        status: 'failed',
        error: (error as Error).message,
        duration: totalDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.error('measurements', 'add_measurement', (error as Error).message, {
        user_id: userId,
        category: category,
        value: value,
        unit: unit,
        duration: totalDuration,
        error: error,
      });

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
    const operationStartTime = Date.now();

    SentryDataCollection.setContext('measurement_operation', {
      operation: 'update_measurement',
      measurement_id: measurementId,
      update_fields: Object.keys(updates),
      timestamp: new Date().toISOString(),
      status: 'starting',
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Starting measurement update',
      category: 'measurements.update',
      level: 'info',
      data: {
        measurement_id: measurementId,
        update_fields: Object.keys(updates),
        has_value_update: 'value' in updates,
        has_category_update: 'category' in updates,
      },
    });

    try {
      // Validate the measurement ID
      const validationStartTime = Date.now();

      if (!measurementId || typeof measurementId !== 'string') {
        const error = new Error('Valid measurement ID is required');

        SentryDataCollection.captureException(error, {
          operation: 'update_measurement_validation',
          measurement_id: measurementId,
          validation_type: 'id_validation',
        });

        throw error;
      }

      // Validate update data if provided
      if (Object.keys(updates).length > 0) {
        SentryDataCollection.addBreadcrumb({
          message: 'Starting update data validation',
          category: 'measurements.validation',
          level: 'debug',
          data: {
            measurement_id: measurementId,
            update_fields: Object.keys(updates),
          },
        });

        const validationResult = validationService.validateWithSchema(
          MeasurementSchema.partial(),
          updates,
          'measurement update',
        );

        const validationDuration = Date.now() - validationStartTime;

        if (!validationResult.success) {
          const errorMessage = `Measurement update validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;

          SentryDataCollection.captureException(new Error(errorMessage), {
            operation: 'update_measurement_validation',
            measurement_id: measurementId,
            validation_errors: validationResult.errors,
            duration: validationDuration,
          });

          SentryDataCollection.setContext('measurement_operation', {
            operation: 'update_measurement',
            measurement_id: measurementId,
            status: 'failed',
            error: 'validation_failed',
            validation_duration: validationDuration,
            timestamp: new Date().toISOString(),
          });

          SentryLogger.database.error('measurements', 'update_measurement', errorMessage, {
            measurement_id: measurementId,
            validation_errors: validationResult.errors,
            duration: validationDuration,
          });

          logger.error('Measurement update validation failed', new Error(errorMessage), {
            context: { measurementId, updates, errors: validationResult.errors },
          });
          throw new Error(errorMessage);
        }

        SentryDataCollection.addBreadcrumb({
          message: 'Update data validation completed successfully',
          category: 'measurements.validation',
          level: 'debug',
          data: {
            measurement_id: measurementId,
            validation_duration: validationDuration,
          },
        });
      }

      // Perform the update
      const updateStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Executing measurement update',
        category: 'measurements.update',
        level: 'info',
        data: {
          measurement_id: measurementId,
          update_fields: Object.keys(updates),
        },
      });

      const { data, error } = await supabase
        .from('measurements')
        .update(updates)
        .eq('id', measurementId)
        .select()
        .single();

      const updateDuration = Date.now() - updateStartTime;
      const totalDuration = Date.now() - operationStartTime;

      if (error) {
        SentryDataCollection.captureException(error, {
          operation: 'update_measurement_database',
          measurement_id: measurementId,
          update_fields: Object.keys(updates),
          duration: updateDuration,
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'update_measurement',
          measurement_id: measurementId,
          status: 'failed',
          error: error.message,
          update_duration: updateDuration,
          total_duration: totalDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.error('measurements', 'update_measurement', error.message, {
          measurement_id: measurementId,
          update_fields: Object.keys(updates),
          duration: updateDuration,
          error: error,
        });

        logger.error('Error updating measurement in database', error, {
          context: { measurementId, updates },
        });
        throw error;
      }

      SentryDataCollection.addBreadcrumb({
        message: 'Measurement update completed successfully',
        category: 'measurements.update',
        level: 'info',
        data: {
          measurement_id: data.id,
          category: data.category,
          value: data.value,
          update_duration: updateDuration,
        },
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'update_measurement',
        measurement_id: data.id,
        status: 'completed',
        category: data.category,
        value: data.value,
        total_duration: totalDuration,
        update_duration: updateDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.query('measurements', 'update_measurement', {
        measurement_id: data.id,
        category: data.category,
        duration: totalDuration,
        update_fields: Object.keys(updates),
      });

      logger.info('Measurement updated successfully', {
        context: { measurementId: data.id, category: data.category, value: data.value },
      });
      return data;
    } catch (error) {
      const totalDuration = Date.now() - operationStartTime;

      SentryDataCollection.captureException(error as Error, {
        operation: 'update_measurement',
        measurement_id: measurementId,
        update_fields: Object.keys(updates),
        duration: totalDuration,
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'update_measurement',
        measurement_id: measurementId,
        status: 'failed',
        error: (error as Error).message,
        duration: totalDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.error('measurements', 'update_measurement', (error as Error).message, {
        measurement_id: measurementId,
        update_fields: Object.keys(updates),
        duration: totalDuration,
        error: error,
      });

      logger.error('Failed to update measurement', error as Error, {
        context: { measurementId, updates },
      });
      throw error;
    }
  },

  // Delete a measurement
  async deleteMeasurement(measurementId: string): Promise<void> {
    const operationStartTime = Date.now();

    SentryDataCollection.setContext('measurement_operation', {
      operation: 'delete_measurement',
      measurement_id: measurementId,
      timestamp: new Date().toISOString(),
      status: 'starting',
    });

    SentryDataCollection.addBreadcrumb({
      message: 'Starting measurement deletion',
      category: 'measurements.delete',
      level: 'info',
      data: {
        measurement_id: measurementId,
      },
    });

    try {
      // Validate the measurement ID
      if (!measurementId || typeof measurementId !== 'string') {
        const error = new Error('Valid measurement ID is required');

        SentryDataCollection.captureException(error, {
          operation: 'delete_measurement_validation',
          measurement_id: measurementId,
          validation_type: 'id_validation',
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'delete_measurement',
          measurement_id: measurementId,
          status: 'failed',
          error: 'invalid_id',
          timestamp: new Date().toISOString(),
        });

        throw error;
      }

      // Perform the deletion
      const deleteStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Executing measurement deletion',
        category: 'measurements.delete',
        level: 'info',
        data: {
          measurement_id: measurementId,
        },
      });

      const { error } = await supabase.from('measurements').delete().eq('id', measurementId);

      const deleteDuration = Date.now() - deleteStartTime;
      const totalDuration = Date.now() - operationStartTime;

      if (error) {
        SentryDataCollection.captureException(error, {
          operation: 'delete_measurement_database',
          measurement_id: measurementId,
          duration: deleteDuration,
        });

        SentryDataCollection.setContext('measurement_operation', {
          operation: 'delete_measurement',
          measurement_id: measurementId,
          status: 'failed',
          error: error.message,
          delete_duration: deleteDuration,
          total_duration: totalDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.error('measurements', 'delete_measurement', error.message, {
          measurement_id: measurementId,
          duration: deleteDuration,
          error: error,
        });

        logger.error('Error deleting measurement from database', error, {
          context: { measurementId },
        });
        throw error;
      }

      SentryDataCollection.addBreadcrumb({
        message: 'Measurement deletion completed successfully',
        category: 'measurements.delete',
        level: 'info',
        data: {
          measurement_id: measurementId,
          delete_duration: deleteDuration,
        },
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'delete_measurement',
        measurement_id: measurementId,
        status: 'completed',
        total_duration: totalDuration,
        delete_duration: deleteDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.query('measurements', 'delete_measurement', {
        measurement_id: measurementId,
        duration: totalDuration,
      });

      logger.info('Measurement deleted successfully', {
        context: { measurementId },
      });
    } catch (error) {
      const totalDuration = Date.now() - operationStartTime;

      SentryDataCollection.captureException(error as Error, {
        operation: 'delete_measurement',
        measurement_id: measurementId,
        duration: totalDuration,
      });

      SentryDataCollection.setContext('measurement_operation', {
        operation: 'delete_measurement',
        measurement_id: measurementId,
        status: 'failed',
        error: (error as Error).message,
        duration: totalDuration,
        timestamp: new Date().toISOString(),
      });

      SentryLogger.database.error('measurements', 'delete_measurement', (error as Error).message, {
        measurement_id: measurementId,
        duration: totalDuration,
        error: error,
      });

      logger.error('Failed to delete measurement', error as Error, {
        context: { measurementId },
      });
      throw error;
    }
  },
};

export default measurementService;
