import { z } from 'zod';
import { logger } from '../utils/logger';
import { apiClient, ApiRequestOptions } from './apiClient';
import { commonTransformers } from './apiResponseHandler';
import { CachePriority } from './enhancedCacheManager';
// Add Sentry imports
import { captureAPIError, captureValidationError } from './sentry';
import { addBreadcrumb } from './sentry/simpleErrorHandler';

// Pre-configured API clients for different services
export class ApiIntegration {
  // Supabase API client
  static supabase = {
    // Exercise-related endpoints
    exercises: {
      async getAll(options: ApiRequestOptions = {}) {
        try {
          addBreadcrumb('Fetching all exercises', 'api_integration');

          const result = await apiClient.get('/rest/v1/exercises', {
            cache: {
              enabled: true,
              ttl: 600000, // 10 minutes
              tags: ['exercises'],
              priority: CachePriority.HIGH,
              ...options.cache,
            },
            processing: {
              transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
              ...options.processing,
            },
            ...options,
          });

          addBreadcrumb('Successfully fetched all exercises', 'api_integration', {
            count: Array.isArray(result.data) ? result.data.length : 0,
            fromCache: result.fromCache,
          });

          return result;
        } catch (error) {
          logger.error('Error fetching all exercises', error as Error);
          captureAPIError(error as Error, '/rest/v1/exercises');
          throw error;
        }
      },

      async getById(id: string, options: ApiRequestOptions = {}) {
        return apiClient.get(`/rest/v1/exercises?id=eq.${id}`, {
          cache: {
            enabled: true,
            ttl: 900000, // 15 minutes
            tags: ['exercises', `exercise:${id}`],
            priority: CachePriority.HIGH,
            ...options.cache,
          },
          processing: {
            transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
            ...options.processing,
          },
          ...options,
        });
      },

      async getByCategory(category: string, options: ApiRequestOptions = {}) {
        return apiClient.get(`/rest/v1/exercises?category=eq.${category}`, {
          cache: {
            enabled: true,
            ttl: 600000, // 10 minutes
            tags: ['exercises', `category:${category}`],
            priority: CachePriority.NORMAL,
            ...options.cache,
          },
          processing: {
            transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
            ...options.processing,
          },
          ...options,
        });
      },
    },

    // Workout plan endpoints
    workoutPlans: {
      async getUserPlans(userId: string, options: ApiRequestOptions = {}) {
        return apiClient.get(`/rest/v1/user_active_plans?user_id=eq.${userId}`, {
          cache: {
            enabled: true,
            ttl: 300000, // 5 minutes
            tags: ['workout-plans', `user:${userId}`],
            priority: CachePriority.HIGH,
            ...options.cache,
          },
          processing: {
            transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
            ...options.processing,
          },
          auth: { required: true },
          ...options,
        });
      },

      async getPlanDetails(planId: string, options: ApiRequestOptions = {}) {
        return apiClient.get(`/rest/v1/workout_plans?id=eq.${planId}`, {
          cache: {
            enabled: true,
            ttl: 600000, // 10 minutes
            tags: ['workout-plans', `plan:${planId}`],
            priority: CachePriority.NORMAL,
            ...options.cache,
          },
          processing: {
            transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
            ...options.processing,
          },
          auth: { required: true },
          ...options,
        });
      },

      async createPlan(planData: unknown, options: ApiRequestOptions = {}) {
        try {
          addBreadcrumb('Creating workout plan', 'api_integration');

          const response = await apiClient.post('/rest/v1/workout_plans', planData, {
            cache: { enabled: false },
            processing: {
              transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
              ...options.processing,
            },
            auth: { required: true },
            ...options,
          });

          // Invalidate related cache
          await apiClient.invalidateCache(['workout-plans']);

          addBreadcrumb('Successfully created workout plan', 'api_integration', {
            planId: (response.data as { id?: string })?.id,
          });

          return response;
        } catch (error) {
          logger.error('Error creating workout plan', error as Error);
          captureAPIError(error as Error, '/rest/v1/workout_plans');
          throw error;
        }
      },
    },

    // User progress endpoints
    progress: {
      async getExerciseRecords(
        userId: string,
        exerciseId: string,
        options: ApiRequestOptions = {},
      ) {
        return apiClient.get(
          `/rest/v1/user_exercise_records?user_id=eq.${userId}&exercise_id=eq.${exerciseId}`,
          {
            cache: {
              enabled: true,
              ttl: 180000, // 3 minutes
              tags: ['progress', `user:${userId}`, `exercise:${exerciseId}`],
              priority: CachePriority.NORMAL,
              ...options.cache,
            },
            processing: {
              transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
              ...options.processing,
            },
            auth: { required: true },
            ...options,
          },
        );
      },

      async saveWorkoutSession(sessionData: unknown, options: ApiRequestOptions = {}) {
        const response = await apiClient.post('/rest/v1/workout_sessions', sessionData, {
          cache: { enabled: false },
          processing: {
            transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
            ...options.processing,
          },
          auth: { required: true },
          ...options,
        });

        // Invalidate related cache
        await apiClient.invalidateCache(['progress', 'workout-sessions']);

        return response;
      },
    },

    // Measurements endpoints
    measurements: {
      async getUserMeasurements(userId: string, options: ApiRequestOptions = {}) {
        return apiClient.get(`/rest/v1/user_measurements?user_id=eq.${userId}`, {
          cache: {
            enabled: true,
            ttl: 300000, // 5 minutes
            tags: ['measurements', `user:${userId}`],
            priority: CachePriority.NORMAL,
            ...options.cache,
          },
          processing: {
            transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
            ...options.processing,
          },
          auth: { required: true },
          ...options,
        });
      },

      async saveMeasurement(measurementData: unknown, options: ApiRequestOptions = {}) {
        const response = await apiClient.post('/rest/v1/user_measurements', measurementData, {
          cache: { enabled: false },
          processing: {
            transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
            ...options.processing,
          },
          auth: { required: true },
          ...options,
        });

        // Invalidate related cache
        await apiClient.invalidateCache(['measurements']);

        return response;
      },
    },
  };

  // OpenAI API client
  static openai = {
    async generateCoachingResponse(
      prompt: string,
      context: unknown,
      options: ApiRequestOptions = {},
    ) {
      try {
        addBreadcrumb('Generating AI coaching response', 'api_integration', {
          promptLength: prompt.length,
        });

        if (!prompt || typeof prompt !== 'string') {
          const error = new Error('Valid prompt is required for AI coaching');
          captureValidationError(error, 'prompt');
          throw error;
        }

        const result = await apiClient.post(
          '/ai/coaching',
          { prompt, context },
          {
            cache: {
              enabled: true,
              ttl: 1800000, // 30 minutes
              tags: ['ai-coaching'],
              priority: CachePriority.LOW,
              ...options.cache,
            },
            processing: {
              transformers: [commonTransformers.removeNulls],
              ...options.processing,
            },
            auth: { required: true },
            ...options,
          },
        );

        addBreadcrumb('Successfully generated AI coaching response', 'api_integration', {
          promptLength: prompt.length,
          fromCache: result.fromCache,
        });

        return result;
      } catch (error) {
        logger.error('Error generating AI coaching response', error as Error, {
          context: { promptLength: prompt.length },
        });
        captureAPIError(error as Error, '/ai/coaching');
        throw error;
      }
    },

    async generateWorkoutPlan(preferences: unknown, options: ApiRequestOptions = {}) {
      return apiClient.post('/ai/workout-plan', preferences, {
        cache: {
          enabled: false, // Don't cache personalized plans
        },
        processing: {
          transformers: [commonTransformers.snakeToCamel, commonTransformers.removeNulls],
          ...options.processing,
        },
        auth: { required: true },
        ...options,
      });
    },
  };

  // Firebase Storage API client
  static storage = {
    async uploadProgressPhoto(file: Blob, userId: string, options: ApiRequestOptions = {}) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);

      return apiClient.post('/storage/progress-photos', formData, {
        cache: { enabled: false },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        auth: { required: true },
        ...options,
      });
    },

    async getProgressPhotos(userId: string, options: ApiRequestOptions = {}) {
      return apiClient.get(`/storage/progress-photos?userId=${userId}`, {
        cache: {
          enabled: true,
          ttl: 300000, // 5 minutes
          tags: ['progress-photos', `user:${userId}`],
          priority: CachePriority.NORMAL,
          ...options.cache,
        },
        auth: { required: true },
        ...options,
      });
    },
  };
}

// Common API response patterns
export class ApiPatterns {
  // Paginated requests
  static async getPaginated<T>(
    endpoint: string,
    page: number = 1,
    limit: number = 20,
    options: ApiRequestOptions = {},
  ) {
    const url = `${endpoint}?page=${page}&limit=${limit}`;

    return apiClient.get<{
      data: T[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(url, {
      cache: {
        enabled: true,
        ttl: 300000, // 5 minutes
        tags: ['paginated', endpoint.replace('/', '')],
        ...options.cache,
      },
      processing: {
        transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
        ...options.processing,
      },
      ...options,
    });
  }

  // Search requests
  static async search<T>(
    endpoint: string,
    query: string,
    filters: Record<string, unknown> = {},
    options: ApiRequestOptions = {},
  ) {
    const searchParams = new URLSearchParams({
      q: query,
      ...Object.entries(filters).reduce(
        (acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        },
        {} as Record<string, string>,
      ),
    });

    const url = `${endpoint}?${searchParams.toString()}`;

    return apiClient.get<T[]>(url, {
      cache: {
        enabled: true,
        ttl: 180000, // 3 minutes
        tags: ['search', endpoint.replace('/', ''), `query:${query}`],
        ...options.cache,
      },
      processing: {
        transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
        ...options.processing,
      },
      ...options,
    });
  }

  // Bulk operations
  static async bulkOperation<T>(
    endpoint: string,
    operation: 'create' | 'update' | 'delete',
    data: T[],
    options: ApiRequestOptions = {},
  ) {
    const response = await apiClient.post(
      `${endpoint}/bulk/${operation}`,
      { items: data },
      {
        cache: { enabled: false },
        processing: {
          transformers: [commonTransformers.snakeToCamel, commonTransformers.parseDates],
          ...options.processing,
        },
        auth: { required: true },
        ...options,
      },
    );

    // Invalidate related cache
    await apiClient.invalidateCache([endpoint.replace('/', '')]);

    return response;
  }

  // Real-time subscriptions (placeholder for future implementation)
  static async subscribe<T>(
    endpoint: string,
    callback: (data: T) => void,
    options: ApiRequestOptions = {},
  ) {
    // This would implement WebSocket or Server-Sent Events
    logger.info('Real-time subscription requested', {
      context: { endpoint, hasCallback: typeof callback === 'function', hasOptions: !!options },
    });

    // For now, return a mock subscription
    return {
      unsubscribe: () => {
        logger.info('Subscription cancelled', { context: { endpoint } });
      },
    };
  }
}

// API response validation schemas
export const ApiValidationSchemas = {
  // Standard API response wrapper
  apiResponse: z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  }),

  // Paginated response
  paginatedResponse: z.object({
    data: z.array(z.unknown()),
    pagination: z.object({
      page: z.number().positive(),
      limit: z.number().positive(),
      total: z.number().nonnegative(),
      totalPages: z.number().positive(),
    }),
  }),

  // Exercise response
  exerciseResponse: z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    equipment: z.string(),
    difficulty: z.string(),
    description: z.string(),
    instructions: z.array(z.string()),
    muscles: z.array(z.string()),
    imageUrl: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),

  // Workout plan response
  workoutPlanResponse: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    difficulty: z.string(),
    duration: z.number(),
    exercises: z.array(z.unknown()),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),

  // User progress response
  progressResponse: z.object({
    id: z.string(),
    userId: z.string(),
    exerciseId: z.string(),
    weight: z.number(),
    reps: z.number(),
    sets: z.number(),
    date: z.string(),
    notes: z.string().optional(),
  }),
};

// Cache warming strategies
export const CacheWarmingStrategies = {
  // Warm popular exercises
  async warmPopularExercises() {
    logger.info('Warming popular exercises cache');

    try {
      await ApiIntegration.supabase.exercises.getAll({
        cache: { priority: CachePriority.HIGH },
      });

      // Warm specific categories
      const popularCategories = ['strength', 'cardio', 'flexibility'];
      for (const category of popularCategories) {
        await ApiIntegration.supabase.exercises.getByCategory(category, {
          cache: { priority: CachePriority.HIGH },
        });
      }
    } catch (error) {
      logger.error('Failed to warm popular exercises cache', error as Error);
    }
  },

  // Warm user-specific data
  async warmUserData(userId: string) {
    logger.info('Warming user-specific cache', { context: { userId } });

    try {
      await Promise.all([
        ApiIntegration.supabase.workoutPlans.getUserPlans(userId, {
          cache: { priority: CachePriority.HIGH },
        }),
        ApiIntegration.supabase.measurements.getUserMeasurements(userId, {
          cache: { priority: CachePriority.NORMAL },
        }),
      ]);
    } catch (error) {
      logger.error('Failed to warm user cache', error as Error, {
        context: { userId },
      });
    }
  },

  // Warm recent content
  async warmRecentContent() {
    logger.info('Warming recent content cache');

    try {
      // This would warm recently accessed or trending content
      // Implementation depends on analytics data
    } catch (error) {
      logger.error('Failed to warm recent content cache', error as Error);
    }
  },
};

// Initialize cache warming
export function initializeCacheWarming() {
  apiClient.configureCacheWarming(['warmPopularExercises', 'warmRecentContent']);

  logger.info('Cache warming initialized');
}

// Classes and objects are already exported above with their declarations

// Default export to satisfy Expo Router (this file should not be a route)
export default function ApiIntegrationRouterPlaceholder() {
  return null;
}
