import { logger } from '../utils/logger';
import { ExerciseListResponseSchema } from '../validation/apiSchemas';
import { GeneralExerciseSchema } from '../validation/schemas';
import { apiClient } from './apiClient';
import supabase from './supabase';
import { validationService } from './validationService';

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
  try {
    const cache = (global as { exercisesCache?: ExerciseCache }).exercisesCache;
    if (!cache) return null;

    // Check if cache is expired
    const now = Date.now();
    if (now - cache.lastUpdated > CACHE_EXPIRY) {
      console.log('Exercise cache expired, will refresh from API');
      return null;
    }

    return cache;
  } catch (error) {
    console.warn('Error accessing exercise cache:', error);
    return null;
  }
};

// Helper to update the cache with new data
const updateCache = (allExercises: Exercise[], byCategory?: Record<string, Exercise[]>) => {
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

    console.log(
      `Cache updated with ${allExercises.length} exercises across ${Object.keys(categorized).length} categories`,
    );
  } catch (error) {
    console.warn('Error updating exercise cache:', error);
  }
};

const exerciseService = {
  async getAllExercises(): Promise<Exercise[]> {
    try {
      // Check cache first
      const cache = getCachedExercises();
      if (cache?.all) {
        logger.info('Using cached exercises data (all)', {
          context: { count: cache.all.length },
        });
        return cache.all;
      }

      // Use direct Supabase call (more reliable than API client for now)
      return this.getAllExercisesFallback();
    } catch (error) {
      logger.error('Failed to fetch exercises', error as Error, {
        context: { operation: 'getAllExercises' },
      });
      throw error;
    }
  },

  // Fallback method using direct Supabase call
  async getAllExercisesFallback(): Promise<Exercise[]> {
    try {
      const { data, error } = await supabase.from('exercises').select('*').order('name');

      if (error) {
        logger.error('Error fetching exercises from database', error, {
          context: { operation: 'getAllExercisesFallback' },
        });
        throw error;
      }

      // Validate each exercise using individual schema validation
      const validatedExercises: Exercise[] = [];
      for (const exercise of data || []) {
        const validationResult = validationService.validateGeneralExercise(exercise);
        if (validationResult.success) {
          validatedExercises.push(validationResult.data as Exercise);
        } else {
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

      logger.info('Exercises fetched and validated successfully via fallback', {
        context: { count: validatedExercises.length },
      });

      return validatedExercises;
    } catch (error) {
      logger.error('Failed to fetch exercises via fallback', error as Error, {
        context: { operation: 'getAllExercisesFallback' },
      });
      throw error;
    }
  },

  async getExercisesByCategory(category: ExerciseCategory): Promise<Exercise[]> {
    // If 'all' is passed, fetch all exercises
    if (category === 'all') {
      return this.getAllExercises();
    }

    // Check cache first
    const cache = getCachedExercises();
    if (cache?.byCategory && cache.byCategory[category]) {
      console.log(`Using cached exercises data (${category})`);
      return cache.byCategory[category];
    }

    // If we have all exercises cached but not this category specifically
    // (this shouldn't happen with proper initialization, but just in case)
    if (cache?.all) {
      console.log(`Categorizing cached exercises for ${category}`);
      const categoryExercises = cache.all.filter((ex: Exercise) => ex.muscle_group === category);

      // Update the category in the cache
      if (categoryExercises.length > 0) {
        if (!cache.byCategory) cache.byCategory = {};
        cache.byCategory[category] = categoryExercises;
        (global as { exercisesCache?: ExerciseCache }).exercisesCache = cache;

        return categoryExercises;
      }
    }

    // Fallback to API call
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('muscle_group', category)
      .order('name');

    if (error) {
      console.error(`Error fetching ${category} exercises:`, error);
      throw error;
    }

    // Update just this category in the cache if we already have a cache
    if (data && data.length > 0 && cache) {
      if (!cache.byCategory) cache.byCategory = {};
      cache.byCategory[category] = data;
      (global as { exercisesCache?: ExerciseCache }).exercisesCache = cache;
    }

    return data || [];
  },

  // New method to preload all categories at once to prevent UI glitches
  async preloadAllCategories(): Promise<void> {
    try {
      console.log('Preloading all exercise categories...');

      // First check if we already have a complete cache
      const cache = getCachedExercises();
      if (cache?.all && cache.byCategory && Object.keys(cache.byCategory).length > 0) {
        console.log('All categories already cached');
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

      console.log(
        `Successfully preloaded ${allExercises.length} exercises in ${Object.keys(byCategory).length} categories`,
      );
    } catch (error) {
      console.error('Error preloading exercise categories:', error);
    }
  },

  async getFavoriteExercises(): Promise<Exercise[]> {
    // Get the current user ID
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) {
      throw new Error('User not authenticated');
    }

    const userId = userData.user.id;

    // Get exercises marked as favorites by the user
    const { data, error } = await supabase
      .from('user_favorite_exercises')
      .select('exercise_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching favorite exercises:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Get the actual exercise details - try cache first
    const exerciseIds = data.map((item) => item.exercise_id);
    const cache = getCachedExercises();

    if (cache?.all) {
      console.log('Using cached data for favorite exercises');
      return cache.all.filter((exercise: Exercise) => exerciseIds.includes(exercise.id));
    }

    // Fallback to API call
    const { data: exercises, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')
      .in('id', exerciseIds)
      .order('name');

    if (exercisesError) {
      console.error('Error fetching favorite exercise details:', exercisesError);
      throw exercisesError;
    }

    return exercises || [];
  },

  async toggleFavoriteExercise(exerciseId: string, isFavorite: boolean): Promise<void> {
    // Get the current user ID
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) {
      throw new Error('User not authenticated');
    }

    const userId = userData.user.id;

    if (isFavorite) {
      // Add to favorites
      const { error } = await supabase
        .from('user_favorite_exercises')
        .insert({ user_id: userId, exercise_id: exerciseId });

      if (error) {
        console.error('Error adding exercise to favorites:', error);
        throw error;
      }
    } else {
      // Remove from favorites
      const { error } = await supabase
        .from('user_favorite_exercises')
        .delete()
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId);

      if (error) {
        console.error('Error removing exercise from favorites:', error);
        throw error;
      }
    }
  },

  async getExerciseById(id: string): Promise<Exercise | null> {
    try {
      // Check cache first
      const cache = getCachedExercises();
      if (cache?.all) {
        const exercise = cache.all.find((ex: Exercise) => ex.id === id);
        if (exercise) {
          logger.info('Using cached data for exercise details', {
            context: { exerciseId: id },
          });
          return exercise;
        }
      }

      // Try API client with schema validation first
      try {
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

        logger.info('Exercise fetched and validated successfully via API client', {
          context: {
            exerciseId: id,
            fromCache: response.fromCache,
            validationPassed: response.processed,
          },
        });

        return transformedExercise;
      } catch (apiError) {
        logger.warn('API client failed for single exercise, falling back to direct Supabase call', {
          context: { exerciseId: id, error: (apiError as Error).message },
        });

        // Fallback to direct Supabase call
        const { data, error } = await supabase.from('exercises').select('*').eq('id', id).single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned
            logger.info('Exercise not found', { context: { exerciseId: id } });
            return null;
          }
          logger.error('Error fetching exercise from database', error, {
            context: { exerciseId: id },
          });
          throw error;
        }

        // Validate the response
        const validationResult = validationService.validateGeneralExercise(data);
        if (validationResult.success) {
          return validationResult.data as Exercise;
        } else {
          logger.warn('Invalid exercise data received from database', {
            context: {
              exerciseId: id,
              errors: validationResult.errors,
            },
          });
          return null;
        }
      }
    } catch (error) {
      logger.error('Failed to fetch exercise by ID', error as Error, {
        context: { exerciseId: id },
      });
      throw error;
    }
  },

  async searchExercises(query: string): Promise<Exercise[]> {
    // Try to search in cache first for better performance
    const cache = getCachedExercises();
    if (cache?.all) {
      console.log('Searching exercises in cache');
      const lowerQuery = query.toLowerCase();
      return cache.all.filter(
        (ex: Exercise) =>
          ex.name.toLowerCase().includes(lowerQuery) ||
          (ex.description && ex.description.toLowerCase().includes(lowerQuery)),
      );
    }

    // Fallback to API call
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('name');

    if (error) {
      console.error('Error searching exercises:', error);
      throw error;
    }

    return data || [];
  },

  async createExercise(
    exercise: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Exercise> {
    try {
      // Validate exercise data before database operation
      const validationResult = validationService.validateGeneralExercise({
        ...exercise,
        id: 'temp-id', // Add temporary ID for validation, will be removed by database
      });

      if (!validationResult.success) {
        const errorMessage = `Exercise validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        logger.error('Exercise validation failed', new Error(errorMessage), {
          context: { exercise, errors: validationResult.errors },
        });
        throw new Error(errorMessage);
      }

      const { data, error } = await supabase
        .from('exercises')
        .insert([validationResult.data])
        .select()
        .single();

      if (error) {
        logger.error('Error creating exercise in database', error, {
          context: { exercise: validationResult.data },
        });
        throw error;
      }

      // Invalidate cache after creating a new exercise
      const globalCache = global as { exercisesCache?: ExerciseCache };
      if (globalCache.exercisesCache) {
        globalCache.exercisesCache = undefined;
        logger.info('Exercise cache invalidated after creation');
      }

      logger.info('Exercise created successfully', {
        context: { exerciseId: data.id, name: data.name },
      });
      return data;
    } catch (error) {
      logger.error('Failed to create exercise', error as Error, {
        context: { exercise },
      });
      throw error;
    }
  },

  async updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise> {
    try {
      // Validate the ID
      if (!id || typeof id !== 'string') {
        throw new Error('Valid exercise ID is required');
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
          logger.error('Exercise update validation failed', new Error(errorMessage), {
            context: { exerciseId: id, updates, errors: validationResult.errors },
          });
          throw new Error(errorMessage);
        }
      }

      const { data, error } = await supabase
        .from('exercises')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating exercise in database', error, {
          context: { exerciseId: id, updates },
        });
        throw error;
      }

      // Invalidate cache after updating an exercise
      const globalCache = global as { exercisesCache?: ExerciseCache };
      if (globalCache.exercisesCache) {
        globalCache.exercisesCache = undefined;
        logger.info('Exercise cache invalidated after update');
      }

      logger.info('Exercise updated successfully', {
        context: { exerciseId: data.id, name: data.name },
      });
      return data;
    } catch (error) {
      logger.error('Failed to update exercise', error as Error, {
        context: { exerciseId: id, updates },
      });
      throw error;
    }
  },

  async deleteExercise(id: string): Promise<void> {
    try {
      // Validate the ID
      if (!id || typeof id !== 'string') {
        throw new Error('Valid exercise ID is required');
      }

      const { error } = await supabase.from('exercises').delete().eq('id', id);

      if (error) {
        logger.error('Error deleting exercise from database', error, {
          context: { exerciseId: id },
        });
        throw error;
      }

      // Invalidate cache after deleting an exercise
      const globalCache = global as { exercisesCache?: ExerciseCache };
      if (globalCache.exercisesCache) {
        globalCache.exercisesCache = undefined;
        logger.info('Exercise cache invalidated after deletion');
      }

      logger.info('Exercise deleted successfully', {
        context: { exerciseId: id },
      });
    } catch (error) {
      logger.error('Failed to delete exercise', error as Error, {
        context: { exerciseId: id },
      });
      throw error;
    }
  },
};

export default exerciseService;
