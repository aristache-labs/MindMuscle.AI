import { logger } from '../utils/logger';
import { ExerciseListResponseSchema } from '../validation/apiSchemas';
import { GeneralExerciseSchema } from '../validation/schemas';
import { apiClient } from './apiClient';
import supabase from './supabase';
import { validationService } from './validationService';
import * as Sentry from '@sentry/react-native';
import type { Span } from '@sentry/react-native';
import {
  captureError,
  captureDatabaseError,
  capturePerformanceError,
  captureValidationError,
  simpleErrorHandler,
} from './sentry';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  muscle_group: string;
  equipment: string;
  difficulty: string;
  created_at: string;
  updated_at: string;
  image_url?: string;
  video_url?: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  instructions?: string[];
  is_favorite?: boolean;
}

export type ExerciseCategory =
  | 'Cardio'
  | 'Shoulders'
  | 'Chest'
  | 'Biceps'
  | 'Abs'
  | 'Forearms'
  | 'Obliques'
  | 'Quads'
  | 'Adductors'
  | 'Traps'
  | 'Triceps'
  | 'Lats'
  | 'Lower_back'
  | 'Abductors'
  | 'Glutes'
  | 'Hamstrings'
  | 'Calves'
  | 'all';

interface ExerciseCache {
  all: Exercise[];
  byCategory: Record<string, Exercise[]>;
  lastUpdated: number;
}

// Cache expiry time in milliseconds (30 minutes)
const CACHE_EXPIRY = 30 * 60 * 1000;

// Helper to check if cache is available and valid
const getCachedExercises = (): ExerciseCache | null => {
  return Sentry.startSpan(
    {
      name: 'getCachedExercises',
      op: 'cache.read',
      attributes: { service: 'exerciseService' },
    },
    (span) => {
      try {
        simpleErrorHandler.setComponent('exerciseService');

        const cache = (global as { exercisesCache?: ExerciseCache }).exercisesCache;
        if (!cache) {
          span.setAttributes({ cache_status: 'miss' });
          console.log('Exercise cache miss, will fetch from API');
          return null;
        }

        // Check if cache is expired
        const now = Date.now();
        const cacheAge = now - cache.lastUpdated;

        if (cacheAge > CACHE_EXPIRY) {
          console.log('Exercise cache expired, will refresh from API');
          span.setAttributes({
            cache_status: 'expired',
            age_minutes: Math.round(cacheAge / 60000),
          });
          return null;
        }

        span.setAttributes({
          cache_status: 'hit',
          exercise_count: cache.all?.length || 0,
          age_minutes: Math.round(cacheAge / 60000),
        });

        return cache;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        captureError(errorObj, {
          category: 'storage_error',
          component: 'exerciseService',
          operation: 'getCachedExercises',
        });

        span.setAttributes({ cache_status: 'error', error_message: errorObj.message });
        console.warn('Error accessing exercise cache:', error);
        return null;
      }
    },
  );
};

// Helper to update the cache with new data
const updateCache = (allExercises: Exercise[], byCategory?: Record<string, Exercise[]>) => {
  return Sentry.startSpan(
    {
      name: 'updateCache',
      op: 'cache.write',
      attributes: {
        service: 'exerciseService',
        exercise_count: allExercises.length,
      },
    },
    (span) => {
      try {
        // Create category mapping if not provided
        const categorized = byCategory || {};

        if (!byCategory) {
          // Group exercises by category
          allExercises.forEach((exercise) => {
            const category = exercise.muscle_group || 'Other';
            if (!categorized[category]) {
              categorized[category] = [];
            }
            categorized[category].push(exercise);
          });
        }

        // Update global cache
        (global as { exercisesCache?: ExerciseCache }).exercisesCache = {
          all: allExercises,
          byCategory: categorized,
          lastUpdated: Date.now(),
        };

        const categoryCount = Object.keys(categorized).length;
        span.setAttributes({
          cache_status: 'updated',
          exercise_count: allExercises.length,
          category_count: categoryCount,
        });

        console.log(
          `Cache updated with ${allExercises.length} exercises across ${categoryCount} categories`,
        );
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        captureError(errorObj, {
          category: 'storage_error',
          component: 'exerciseService',
          operation: 'updateCache',
        });

        span.setAttributes({ cache_status: 'error', error_message: errorObj.message });
        console.warn('Error updating exercise cache:', error);
      }
    },
  );
};

// Helper function to handle cached category exercises
const handleCachedCategoryExercises = (
  cache: ExerciseCache | null,
  category: string,
  span: Span,
): Exercise[] | null => {
  if (cache?.byCategory && cache.byCategory[category]) {
    span.setAttributes({
      data_source: 'cache',
      exercise_count: cache.byCategory[category].length,
    });

    return cache.byCategory[category];
  }
  return null;
};

// Helper function to handle cache filtering
const handleCacheFiltering = (
  cache: ExerciseCache | null,
  category: string,
  span: Span,
): Exercise[] | null => {
  if (cache?.all) {
    const categoryExercises = cache.all.filter((ex: Exercise) => ex.muscle_group === category);

    if (categoryExercises.length > 0) {
      if (!cache.byCategory) cache.byCategory = {};
      cache.byCategory[category] = categoryExercises;
      (global as { exercisesCache?: ExerciseCache }).exercisesCache = cache;

      span.setAttributes({
        data_source: 'cache_filtered',
        exercise_count: categoryExercises.length,
      });

      return categoryExercises;
    }
  }
  return null;
};

// Helper function to handle API fallback
const handleApiFallback = async (
  category: string,
  span: Span,
  cache: ExerciseCache | null,
): Promise<Exercise[]> => {
  const startTime = Date.now();
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('muscle_group', category)
    .order('name');
  const queryDuration = Date.now() - startTime;

  if (error) {
    captureDatabaseError(
      new Error(`Failed to fetch exercises for category ${category}: ${error.message}`),
      'exercises',
      'select_by_category',
    );

    console.error(`Error fetching ${category} exercises:`, error);

    span.setAttributes({
      query_status: 'error',
      error_message: error.message,
    });

    throw error;
  }

  // Log performance if query is slow
  if (queryDuration > 1500) {
    capturePerformanceError(
      `Slow exercise query for category: ${category}`,
      'database_query_duration',
      queryDuration,
    );
  }

  // Update just this category in the cache if we already have a cache
  if (data && data.length > 0 && cache) {
    if (!cache.byCategory) cache.byCategory = {};
    cache.byCategory[category] = data;
    (global as { exercisesCache?: ExerciseCache }).exercisesCache = cache;
  }

  span.setAttributes({
    data_source: 'api',
    query_status: 'success',
    query_duration_ms: queryDuration,
    exercise_count: data?.length || 0,
  });

  return data || [];
};

const exerciseService = {
  async getAllExercises(): Promise<Exercise[]> {
    return await Sentry.startSpan(
      {
        name: 'getAllExercises',
        op: 'service.exercise.fetch_all',
        attributes: { service: 'exerciseService' },
      },
      async (span) => {
        try {
          simpleErrorHandler.setComponent('exerciseService');

          // Check cache first
          const cache = getCachedExercises();
          if (cache?.all) {
            logger.info('Using cached exercises data (all)', {
              context: { count: cache.all.length },
            });

            span.setAttributes({
              data_source: 'cache',
              exercise_count: cache.all.length,
            });

            return cache.all;
          }

          // Use direct Supabase call (more reliable than API client for now)
          span.setAttributes({ data_source: 'fallback' });
          return this.getAllExercisesFallback();
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'api_error',
            component: 'exerciseService',
            operation: 'getAllExercises',
          });

          logger.error('Failed to fetch exercises', errorObj, {
            context: { operation: 'getAllExercises' },
          });

          span.setAttributes({
            operation_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },

  // Fallback method using direct Supabase call
  async getAllExercisesFallback(): Promise<Exercise[]> {
    return await Sentry.startSpan(
      {
        name: 'getAllExercisesFallback',
        op: 'db.query',
        attributes: { service: 'exerciseService', table: 'exercises' },
      },
      async (span) => {
        try {
          const startTime = Date.now();
          const { data, error } = await supabase.from('exercises').select('*').order('name');
          const queryDuration = Date.now() - startTime;

          if (error) {
            captureDatabaseError(
              new Error(`Failed to fetch exercises: ${error.message}`),
              'exercises',
              'select_all',
            );

            logger.error('Error fetching exercises from database', error, {
              context: { operation: 'getAllExercisesFallback' },
            });

            span.setAttributes({
              query_status: 'error',
              error_message: error.message,
            });

            throw error;
          }

          // Log performance if query is slow
          if (queryDuration > 2000) {
            capturePerformanceError(
              'Slow exercise query (get all)',
              'database_query_duration',
              queryDuration,
            );
          }

          // Validate each exercise using individual schema validation
          const validatedExercises: Exercise[] = [];
          for (const exercise of data || []) {
            const validationResult = validationService.validateGeneralExercise(exercise);
            if (validationResult.success) {
              validatedExercises.push(validationResult.data as Exercise);
            } else {
              captureValidationError(
                new Error(
                  `Invalid exercise data: ${validationResult.errors.map((e) => e.message).join(', ')}`,
                ),
                'exercise_validation',
                exercise?.id,
              );

              logger.warn('Invalid exercise data received from database', {
                context: {
                  exerciseId: exercise?.id,
                  errors: validationResult.errors,
                },
              });
            }
          }

          // Update cache with validated data
          if (validatedExercises.length > 0) {
            updateCache(validatedExercises);
          }

          span.setAttributes({
            query_status: 'success',
            query_duration_ms: queryDuration,
            total_exercises: data?.length || 0,
            validated_exercises: validatedExercises.length,
          });

          logger.info('Exercises fetched and validated successfully via fallback', {
            context: { count: validatedExercises.length },
          });

          return validatedExercises;
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'database_error',
            component: 'exerciseService',
            operation: 'getAllExercisesFallback',
          });

          logger.error('Failed to fetch exercises via fallback', errorObj, {
            context: { operation: 'getAllExercisesFallback' },
          });

          span.setAttributes({
            query_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },

  async getExercisesByCategory(category: ExerciseCategory): Promise<Exercise[]> {
    return await Sentry.startSpan(
      {
        name: 'getExercisesByCategory',
        op: 'service.exercise.fetch_by_category',
        attributes: {
          service: 'exerciseService',
          category: category,
        },
      },
      async (span) => {
        try {
          simpleErrorHandler.setComponent('exerciseService');

          // If 'all' is passed, fetch all exercises
          if (category === 'all') {
            span.setAttributes({ fetch_type: 'all_exercises' });
            return this.getAllExercises();
          }

          // Check cache first
          const cache = getCachedExercises();

          // Try cached category exercises
          const cachedResult = handleCachedCategoryExercises(cache, category, span);
          if (cachedResult) {
            return cachedResult;
          }

          // Try cache filtering
          const filteredResult = handleCacheFiltering(cache, category, span);
          if (filteredResult) {
            return filteredResult;
          }

          // Fallback to API call
          return await handleApiFallback(category, span, cache);
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'api_error',
            component: 'exerciseService',
            operation: 'getExercisesByCategory',
          });

          span.setAttributes({
            query_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },

  // New method to preload all categories at once to prevent UI glitches
  async preloadAllCategories(): Promise<void> {
    return await Sentry.startSpan(
      {
        name: 'preloadAllCategories',
        op: 'service.exercise.preload',
        attributes: { service: 'exerciseService' },
      },
      async (span) => {
        try {
          console.log('Preloading all exercise categories...');
          simpleErrorHandler.setComponent('exerciseService');

          // First check if we already have a complete cache
          const cache = getCachedExercises();
          if (cache?.all && cache.byCategory && Object.keys(cache.byCategory).length > 0) {
            console.log('All categories already cached');

            span.setAttributes({
              preload_status: 'already_cached',
              exercise_count: cache.all.length,
              category_count: Object.keys(cache.byCategory).length,
            });

            return;
          }

          // Fetch all exercises
          const allExercises = await this.getAllExercises();

          // Group by category
          const byCategory: Record<string, Exercise[]> = {};
          allExercises.forEach((exercise) => {
            const category = exercise.muscle_group || 'Other';
            if (!byCategory[category]) {
              byCategory[category] = [];
            }
            byCategory[category].push(exercise);
          });

          // Update cache with all categories
          updateCache(allExercises, byCategory);

          span.setAttributes({
            preload_status: 'completed',
            exercise_count: allExercises.length,
            category_count: Object.keys(byCategory).length,
          });

          console.log(
            `Successfully preloaded ${allExercises.length} exercises in ${Object.keys(byCategory).length} categories`,
          );
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'api_error',
            component: 'exerciseService',
            operation: 'preloadAllCategories',
          });

          console.error('Error preloading exercise categories:', errorObj);

          span.setAttributes({
            preload_status: 'error',
            error_message: errorObj.message,
          });
        }
      },
    );
  },

  async getFavoriteExercises(): Promise<Exercise[]> {
    return await Sentry.startSpan(
      {
        name: 'getFavoriteExercises',
        op: 'service.exercise.fetch_favorites',
        attributes: { service: 'exerciseService' },
      },
      async (span) => {
        try {
          simpleErrorHandler.setComponent('exerciseService');

          // Get the current user ID
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user?.id) {
            const authError = new Error('User not authenticated');
            captureError(authError, {
              category: 'auth_error',
              component: 'exerciseService',
              operation: 'getFavoriteExercises',
            });
            throw authError;
          }

          const userId = userData.user.id;
          span.setAttributes({ user_id: userId });

          // Get exercises marked as favorites by the user
          const startTime = Date.now();
          const { data, error } = await supabase
            .from('user_favorite_exercises')
            .select('exercise_id')
            .eq('user_id', userId);
          const queryDuration = Date.now() - startTime;

          if (error) {
            captureDatabaseError(
              new Error(`Failed to fetch favorite exercises: ${error.message}`),
              'user_favorite_exercises',
              'select',
            );

            console.error('Error fetching favorite exercises:', error);

            span.setAttributes({
              query_status: 'error',
              error_message: error.message,
            });

            throw error;
          }

          if (!data || data.length === 0) {
            span.setAttributes({
              query_status: 'success',
              favorite_count: 0,
              query_duration_ms: queryDuration,
            });
            return [];
          }

          // Get the actual exercise details - try cache first
          const exerciseIds = data.map((item) => item.exercise_id);
          const cache = getCachedExercises();

          if (cache?.all) {
            console.log('Using cached data for favorite exercises');
            const favoriteExercises = cache.all.filter((exercise: Exercise) =>
              exerciseIds.includes(exercise.id),
            );

            span.setAttributes({
              query_status: 'success',
              data_source: 'cache',
              favorite_count: favoriteExercises.length,
              query_duration_ms: queryDuration,
            });

            return favoriteExercises;
          }

          // Fallback to API call
          const exerciseStartTime = Date.now();
          const { data: exercises, error: exercisesError } = await supabase
            .from('exercises')
            .select('*')
            .in('id', exerciseIds)
            .order('name');
          const exerciseQueryDuration = Date.now() - exerciseStartTime;

          if (exercisesError) {
            captureDatabaseError(
              new Error(`Failed to fetch favorite exercise details: ${exercisesError.message}`),
              'exercises',
              'select_favorites',
            );

            console.error('Error fetching favorite exercise details:', exercisesError);

            span.setAttributes({
              query_status: 'error',
              error_message: exercisesError.message,
            });

            throw exercisesError;
          }

          // Log performance if query is slow
          const totalDuration = queryDuration + exerciseQueryDuration;
          if (totalDuration > 2000) {
            capturePerformanceError(
              'Slow favorite exercises query',
              'database_query_duration',
              totalDuration,
            );
          }

          span.setAttributes({
            query_status: 'success',
            data_source: 'api',
            favorite_count: exercises?.length || 0,
            total_query_duration_ms: totalDuration,
          });

          return exercises || [];
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'database_error',
            component: 'exerciseService',
            operation: 'getFavoriteExercises',
          });

          span.setAttributes({
            query_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },

  async toggleFavoriteExercise(exerciseId: string, isFavorite: boolean): Promise<void> {
    return await Sentry.startSpan(
      {
        name: 'toggleFavoriteExercise',
        op: 'service.exercise.toggle_favorite',
        attributes: {
          service: 'exerciseService',
          exercise_id: exerciseId,
          is_favorite: isFavorite,
        },
      },
      async (span) => {
        try {
          simpleErrorHandler.setComponent('exerciseService');

          // Get the current user ID
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user?.id) {
            const authError = new Error('User not authenticated');
            captureError(authError, {
              category: 'auth_error',
              component: 'exerciseService',
              operation: 'toggleFavoriteExercise',
            });
            throw authError;
          }

          const userId = userData.user.id;
          span.setAttributes({ user_id: userId });

          const startTime = Date.now();
          let error;

          if (isFavorite) {
            // Add to favorites
            const result = await supabase
              .from('user_favorite_exercises')
              .insert({ user_id: userId, exercise_id: exerciseId });
            error = result.error;
          } else {
            // Remove from favorites
            const result = await supabase
              .from('user_favorite_exercises')
              .delete()
              .eq('user_id', userId)
              .eq('exercise_id', exerciseId);
            error = result.error;
          }

          const queryDuration = Date.now() - startTime;

          if (error) {
            const operation = isFavorite ? 'add_favorite' : 'remove_favorite';
            captureDatabaseError(
              new Error(`Failed to ${operation}: ${error.message}`),
              'user_favorite_exercises',
              operation,
            );

            console.error(
              `Error ${isFavorite ? 'adding' : 'removing'} exercise ${isFavorite ? 'to' : 'from'} favorites:`,
              error,
            );

            span.setAttributes({
              operation_status: 'error',
              error_message: error.message,
            });

            throw error;
          }

          span.setAttributes({
            operation_status: 'success',
            operation_duration_ms: queryDuration,
          });
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'database_error',
            component: 'exerciseService',
            operation: 'toggleFavoriteExercise',
          });

          span.setAttributes({
            operation_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },

  async getExerciseById(id: string): Promise<Exercise | null> {
    return await Sentry.startSpan(
      {
        name: 'getExerciseById',
        op: 'service.exercise.fetch_by_id',
        attributes: {
          service: 'exerciseService',
          exercise_id: id,
        },
      },
      async (span) => {
        try {
          simpleErrorHandler.setComponent('exerciseService');

          // Check cache first
          const cache = getCachedExercises();
          if (cache?.all) {
            const exercise = cache.all.find((ex: Exercise) => ex.id === id);
            if (exercise) {
              logger.info('Using cached data for exercise details', {
                context: { exerciseId: id },
              });

              span.setAttributes({
                data_source: 'cache',
                found: true,
              });

              return exercise;
            }
          }

          // Try API client with schema validation first
          try {
            const apiStartTime = Date.now();
            const response = await apiClient.requestWithValidation(
              {
                url: `/rest/v1/exercises?id=eq.${id}&select=*`,
                method: 'GET',
              },
              ExerciseListResponseSchema,
              {
                cache: { enabled: true, ttl: 300000 }, // 5 minutes cache
                auth: { required: false },
              },
            );
            const apiDuration = Date.now() - apiStartTime;

            const apiResponse = response.data as {
              success: true;
              data: Array<{
                id: string;
                name: string;
                description: string;
                category: string;
                primaryMuscles: string[];
                secondaryMuscles: string[];
                equipment: string;
                difficulty: 'beginner' | 'intermediate' | 'advanced';
                createdAt: string;
                updatedAt: string;
                imageUrl?: string;
                videoUrl?: string;
                instructions: string[];
              }>;
            };

            // Check if exercise was found
            if (!apiResponse.data || apiResponse.data.length === 0) {
              logger.info('Exercise not found via API client', { context: { exerciseId: id } });

              span.setAttributes({
                data_source: 'api_client',
                found: false,
                query_duration_ms: apiDuration,
              });

              return null;
            }

            // Transform API response to internal Exercise interface
            const exercise = apiResponse.data[0]; // Get first (and should be only) result
            const transformedExercise: Exercise = {
              id: exercise.id,
              name: exercise.name,
              description: exercise.description,
              muscle_group: exercise.category || exercise.primaryMuscles[0] || 'Other',
              equipment: exercise.equipment,
              difficulty: exercise.difficulty,
              created_at: exercise.createdAt,
              updated_at: exercise.updatedAt,
              image_url: exercise.imageUrl,
              video_url: exercise.videoUrl,
              primary_muscles: exercise.primaryMuscles,
              secondary_muscles: exercise.secondaryMuscles,
              instructions: exercise.instructions,
              is_favorite: false,
            };

            span.setAttributes({
              data_source: 'api_client',
              found: true,
              from_cache: response.fromCache,
              validation_passed: response.processed,
              query_duration_ms: apiDuration,
            });

            logger.info('Exercise fetched and validated successfully via API client', {
              context: {
                exerciseId: id,
                fromCache: response.fromCache,
                validationPassed: response.processed,
              },
            });

            return transformedExercise;
          } catch (apiError) {
            logger.warn(
              'API client failed for single exercise, falling back to direct Supabase call',
              {
                context: { exerciseId: id, error: (apiError as Error).message },
              },
            );

            // Fallback to direct Supabase call
            const fallbackStartTime = Date.now();
            const { data, error } = await supabase
              .from('exercises')
              .select('*')
              .eq('id', id)
              .single();
            const fallbackDuration = Date.now() - fallbackStartTime;

            if (error) {
              if (error.code === 'PGRST116') {
                // No rows returned
                logger.info('Exercise not found', { context: { exerciseId: id } });

                span.setAttributes({
                  data_source: 'fallback',
                  found: false,
                  query_duration_ms: fallbackDuration,
                });

                return null;
              }

              captureDatabaseError(
                new Error(`Failed to fetch exercise by ID: ${error.message}`),
                'exercises',
                'select_by_id',
              );

              logger.error('Error fetching exercise from database', error, {
                context: { exerciseId: id },
              });

              span.setAttributes({
                data_source: 'fallback',
                query_status: 'error',
                error_message: error.message,
              });

              throw error;
            }

            // Validate the response
            const validationResult = validationService.validateGeneralExercise(data);
            if (validationResult.success) {
              span.setAttributes({
                data_source: 'fallback',
                found: true,
                validation_passed: true,
                query_duration_ms: fallbackDuration,
              });

              return validationResult.data as Exercise;
            } else {
              captureValidationError(
                new Error(
                  `Invalid exercise data: ${validationResult.errors.map((e) => e.message).join(', ')}`,
                ),
                'exercise_validation',
                id,
              );

              logger.warn('Invalid exercise data received from database', {
                context: {
                  exerciseId: id,
                  errors: validationResult.errors,
                },
              });

              span.setAttributes({
                data_source: 'fallback',
                found: true,
                validation_passed: false,
                query_duration_ms: fallbackDuration,
              });

              return null;
            }
          }
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'api_error',
            component: 'exerciseService',
            operation: 'getExerciseById',
          });

          logger.error('Failed to fetch exercise by ID', errorObj, {
            context: { exerciseId: id },
          });

          span.setAttributes({
            query_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },

  async searchExercises(query: string): Promise<Exercise[]> {
    return await Sentry.startSpan(
      {
        name: 'searchExercises',
        op: 'service.exercise.search',
        attributes: {
          service: 'exerciseService',
          query_length: query.length,
        },
      },
      async (span) => {
        try {
          simpleErrorHandler.setComponent('exerciseService');

          // Try to search in cache first for better performance
          const cache = getCachedExercises();
          if (cache?.all) {
            console.log('Searching exercises in cache');
            const lowerQuery = query.toLowerCase();
            const results = cache.all.filter(
              (ex: Exercise) =>
                ex.name.toLowerCase().includes(lowerQuery) ||
                (ex.description && ex.description.toLowerCase().includes(lowerQuery)),
            );

            span.setAttributes({
              data_source: 'cache',
              search_results: results.length,
              total_exercises: cache.all.length,
            });

            return results;
          }

          // Fallback to API call
          const startTime = Date.now();
          const { data, error } = await supabase
            .from('exercises')
            .select('*')
            .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
            .order('name');
          const queryDuration = Date.now() - startTime;

          if (error) {
            captureDatabaseError(
              new Error(`Failed to search exercises: ${error.message}`),
              'exercises',
              'search',
            );

            console.error('Error searching exercises:', error);

            span.setAttributes({
              data_source: 'api',
              query_status: 'error',
              error_message: error.message,
            });

            throw error;
          }

          // Log performance if query is slow
          if (queryDuration > 1500) {
            capturePerformanceError(
              `Slow exercise search query: "${query}"`,
              'database_query_duration',
              queryDuration,
            );
          }

          span.setAttributes({
            data_source: 'api',
            query_status: 'success',
            search_results: data?.length || 0,
            query_duration_ms: queryDuration,
          });

          return data || [];
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'database_error',
            component: 'exerciseService',
            operation: 'searchExercises',
          });

          span.setAttributes({
            query_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },

  async createExercise(
    exercise: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Exercise> {
    return await Sentry.startSpan(
      {
        name: 'createExercise',
        op: 'service.exercise.create',
        attributes: {
          service: 'exerciseService',
          exercise_name: exercise.name,
          muscle_group: exercise.muscle_group,
        },
      },
      async (span) => {
        try {
          simpleErrorHandler.setComponent('exerciseService');

          // Validate exercise data before database operation
          const validationResult = validationService.validateGeneralExercise({
            ...exercise,
            id: 'temp-id', // Add temporary ID for validation, will be removed by database
          });

          if (!validationResult.success) {
            const errorMessage = `Exercise validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;

            captureValidationError(new Error(errorMessage), 'exercise_creation', exercise.name);

            logger.error('Exercise validation failed', new Error(errorMessage), {
              context: { exercise, errors: validationResult.errors },
            });

            span.setAttributes({
              validation_status: 'failed',
              error_count: validationResult.errors.length,
            });

            throw new Error(errorMessage);
          }

          const startTime = Date.now();
          const { data, error } = await supabase
            .from('exercises')
            .insert([validationResult.data])
            .select()
            .single();
          const queryDuration = Date.now() - startTime;

          if (error) {
            captureDatabaseError(
              new Error(`Failed to create exercise: ${error.message}`),
              'exercises',
              'insert',
            );

            logger.error('Error creating exercise in database', error, {
              context: { exercise: validationResult.data },
            });

            span.setAttributes({
              operation_status: 'error',
              error_message: error.message,
            });

            throw error;
          }

          // Invalidate cache after creating a new exercise
          const globalCache = global as { exercisesCache?: ExerciseCache };
          if (globalCache.exercisesCache) {
            globalCache.exercisesCache = undefined;
            logger.info('Exercise cache invalidated after creation');
          }

          span.setAttributes({
            operation_status: 'success',
            validation_status: 'passed',
            query_duration_ms: queryDuration,
            created_exercise_id: data.id,
          });

          logger.info('Exercise created successfully', {
            context: { exerciseId: data.id, name: data.name },
          });

          return data;
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'database_error',
            component: 'exerciseService',
            operation: 'createExercise',
          });

          logger.error('Failed to create exercise', errorObj, {
            context: { exercise },
          });

          span.setAttributes({
            operation_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },

  async updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise> {
    return await Sentry.startSpan(
      {
        name: 'updateExercise',
        op: 'service.exercise.update',
        attributes: {
          service: 'exerciseService',
          exercise_id: id,
          update_fields: Object.keys(updates).join(','),
        },
      },
      async (span) => {
        try {
          simpleErrorHandler.setComponent('exerciseService');

          // Validate the ID
          if (!id || typeof id !== 'string') {
            const validationError = new Error('Valid exercise ID is required');
            captureValidationError(validationError, 'exercise_id', id);
            throw validationError;
          }

          // Validate update data if provided
          if (Object.keys(updates).length > 0) {
            const validationResult = validationService.validateWithSchema(
              GeneralExerciseSchema.partial(),
              updates,
              'exercise update',
            );

            if (!validationResult.success) {
              const errorMessage = `Exercise update validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;

              captureValidationError(new Error(errorMessage), 'exercise_update', id);

              logger.error('Exercise update validation failed', new Error(errorMessage), {
                context: { exerciseId: id, updates, errors: validationResult.errors },
              });

              span.setAttributes({
                validation_status: 'failed',
                error_count: validationResult.errors.length,
              });

              throw new Error(errorMessage);
            }
          }

          const startTime = Date.now();
          const { data, error } = await supabase
            .from('exercises')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
          const queryDuration = Date.now() - startTime;

          if (error) {
            captureDatabaseError(
              new Error(`Failed to update exercise: ${error.message}`),
              'exercises',
              'update',
            );

            logger.error('Error updating exercise in database', error, {
              context: { exerciseId: id, updates },
            });

            span.setAttributes({
              operation_status: 'error',
              error_message: error.message,
            });

            throw error;
          }

          // Invalidate cache after updating an exercise
          const globalCache = global as { exercisesCache?: ExerciseCache };
          if (globalCache.exercisesCache) {
            globalCache.exercisesCache = undefined;
            logger.info('Exercise cache invalidated after update');
          }

          span.setAttributes({
            operation_status: 'success',
            validation_status: 'passed',
            query_duration_ms: queryDuration,
            updated_exercise_id: data.id,
          });

          logger.info('Exercise updated successfully', {
            context: { exerciseId: data.id, name: data.name },
          });

          return data;
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'database_error',
            component: 'exerciseService',
            operation: 'updateExercise',
          });

          logger.error('Failed to update exercise', errorObj, {
            context: { exerciseId: id, updates },
          });

          span.setAttributes({
            operation_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },

  async deleteExercise(id: string): Promise<void> {
    return await Sentry.startSpan(
      {
        name: 'deleteExercise',
        op: 'service.exercise.delete',
        attributes: {
          service: 'exerciseService',
          exercise_id: id,
        },
      },
      async (span) => {
        try {
          simpleErrorHandler.setComponent('exerciseService');

          // Validate the ID
          if (!id || typeof id !== 'string') {
            const validationError = new Error('Valid exercise ID is required');
            captureValidationError(validationError, 'exercise_id', id);
            throw validationError;
          }

          const startTime = Date.now();
          const { error } = await supabase.from('exercises').delete().eq('id', id);
          const queryDuration = Date.now() - startTime;

          if (error) {
            captureDatabaseError(
              new Error(`Failed to delete exercise: ${error.message}`),
              'exercises',
              'delete',
            );

            logger.error('Error deleting exercise from database', error, {
              context: { exerciseId: id },
            });

            span.setAttributes({
              operation_status: 'error',
              error_message: error.message,
            });

            throw error;
          }

          // Invalidate cache after deleting an exercise
          const globalCache = global as { exercisesCache?: ExerciseCache };
          if (globalCache.exercisesCache) {
            globalCache.exercisesCache = undefined;
            logger.info('Exercise cache invalidated after deletion');
          }

          span.setAttributes({
            operation_status: 'success',
            query_duration_ms: queryDuration,
          });

          logger.info('Exercise deleted successfully', {
            context: { exerciseId: id },
          });
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error(String(error));

          captureError(errorObj, {
            category: 'database_error',
            component: 'exerciseService',
            operation: 'deleteExercise',
          });

          logger.error('Failed to delete exercise', errorObj, {
            context: { exerciseId: id },
          });

          span.setAttributes({
            operation_status: 'error',
            error_message: errorObj.message,
          });

          throw errorObj;
        }
      },
    );
  },
};

export default exerciseService;
