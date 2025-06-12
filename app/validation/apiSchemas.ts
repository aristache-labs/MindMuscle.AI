import { z } from 'zod';
import { logger } from '../utils/logger';
import {
  SentryDataCollection,
  SentryLogger,
  addBreadcrumb,
  setContext,
  setTag,
} from '../services/sentry';

// Initialize Sentry context for API schemas
const initializeSentryContext = () => {
  setContext('api_schemas', {
    service: 'ApiSchemas',
    version: '1.0.0',
    capabilities: [
      'api_validation',
      'response_validation',
      'error_standardization',
      'pagination_handling',
      'rate_limit_tracking',
      'authentication_validation',
      'batch_operation_support',
      'search_validation',
      'health_check_monitoring',
    ],
    monitoring: {
      performance_tracking: true,
      validation_metrics: true,
      error_categorization: true,
      breadcrumb_tracking: true,
    },
  });
  setTag('service.type', 'api_validation');
  setTag('validation.framework', 'zod');

  addBreadcrumb({
    message: 'API Schemas service initialized with Sentry monitoring',
    category: 'api_schemas.init',
    level: 'info',
    data: {
      timestamp: new Date().toISOString(),
      capabilities_count: 9,
    },
  });

  SentryLogger.info('API Schemas service with Sentry monitoring initialized', {
    service: 'ApiSchemas',
    capabilities: [
      'api_validation',
      'response_validation',
      'error_standardization',
      'pagination_handling',
      'rate_limit_tracking',
      'authentication_validation',
      'batch_operation_support',
      'search_validation',
      'health_check_monitoring',
    ],
    monitoring_features: [
      'performance_tracking',
      'validation_metrics',
      'error_categorization',
      'breadcrumb_tracking',
    ],
  });
};

// Initialize Sentry context
initializeSentryContext();

// Enhanced validation utilities with Sentry integration
export const validateApiResponse = <T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  operation: string,
): { success: true; data: T } | { success: false; errors: string[] } => {
  const startTime = Date.now();

  addBreadcrumb({
    message: `Starting API response validation: ${operation}`,
    category: 'api_schemas.validation',
    level: 'debug',
    data: {
      operation,
      has_data: !!data,
      data_type: typeof data,
    },
  });

  try {
    const result = schema.safeParse(data);
    const duration = Date.now() - startTime;

    if (!result.success) {
      const errors = result.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);

      SentryDataCollection.captureException(
        new Error(`API response validation failed for ${operation}`),
        {
          operation: 'api_response_validation',
          validation_operation: operation,
          validation_errors: errors,
          duration,
          error_count: errors.length,
        },
      );

      addBreadcrumb({
        message: `API response validation failed: ${operation}`,
        category: 'api_schemas.validation.error',
        level: 'warning',
        data: {
          operation,
          error_count: errors.length,
          duration,
          errors: errors.slice(0, 3), // Limit to first 3 errors for brevity
        },
      });

      SentryLogger.warn(`API response validation failed for ${operation}`, {
        operation,
        validation_errors: errors,
        duration,
        error_count: errors.length,
      });

      logger.warn(`API response validation failed for ${operation}`, {
        context: { operation, errors, duration },
      });

      return { success: false, errors };
    }

    addBreadcrumb({
      message: `API response validation successful: ${operation}`,
      category: 'api_schemas.validation.success',
      level: 'info',
      data: {
        operation,
        duration,
      },
    });

    // Track successful validation metrics
    SentryDataCollection.setContext('validation_metrics', {
      last_successful_operation: operation,
      last_validation_duration: duration,
      timestamp: new Date().toISOString(),
    });

    return { success: true, data: result.data };
  } catch (error) {
    const duration = Date.now() - startTime;

    SentryDataCollection.captureException(error as Error, {
      operation: 'api_response_validation_exception',
      validation_operation: operation,
      duration,
    });

    SentryLogger.error(`Unexpected error during API response validation for ${operation}`, {
      error: error as Error,
      operation,
      duration,
    });

    logger.error(
      `Unexpected error during API response validation for ${operation}`,
      error as Error,
      {
        context: { operation, duration },
      },
    );

    return { success: false, errors: ['Validation failed due to unexpected error'] };
  }
};

// Performance monitoring utility for API schema operations
export const trackApiSchemaPerformance = (
  operation: string,
  startTime: number,
  metadata?: Record<string, unknown>,
) => {
  const duration = Date.now() - startTime;

  SentryDataCollection.addBreadcrumb({
    message: `API schema operation completed: ${operation}`,
    category: 'api_schemas.performance',
    level: 'info',
    data: {
      operation,
      duration,
      ...metadata,
    },
  });

  // Track performance metrics
  if (duration > 100) {
    SentryLogger.warn(`Slow API schema operation: ${operation}`, {
      operation,
      duration,
      threshold: 100,
      ...metadata,
    });
  }

  return duration;
};

// Base API response schemas
export const BaseApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
  requestId: z.string().optional(),
});

export const ErrorApiResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

export const SuccessApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Pagination schemas
export const PaginationMetaSchema = z.object({
  page: z.number().positive(),
  limit: z.number().positive(),
  total: z.number().nonnegative(),
  totalPages: z.number().positive(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export const PaginatedApiResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(z.unknown()),
  pagination: PaginationMetaSchema,
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Rate limiting schemas
export const RateLimitInfoSchema = z.object({
  limit: z.number().positive(),
  remaining: z.number().nonnegative(),
  reset: z.number().positive(),
  retryAfter: z.number().positive().optional(),
});

export const RateLimitResponseSchema = z.object({
  success: z.literal(false),
  error: z.literal('Rate limit exceeded'),
  rateLimit: RateLimitInfoSchema,
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Authentication schemas
export const AuthErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.enum(['Authentication required', 'Invalid token', 'Token expired']),
  code: z.enum(['AUTH_REQUIRED', 'INVALID_TOKEN', 'TOKEN_EXPIRED']),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

export const AuthSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    user: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string().optional(),
    }),
    token: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.string(),
  }),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Validation error schemas
export const ValidationErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string(),
  value: z.unknown().optional(),
});

export const ValidationErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.literal('Validation failed'),
  code: z.literal('VALIDATION_ERROR'),
  details: z.array(ValidationErrorDetailSchema),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Exercise API schemas
export const ExerciseApiSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  equipment: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  description: z.string(),
  instructions: z.array(z.string()),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Direct Supabase exercise schema (matches actual table structure)
export const SupabaseExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  muscle_group: z.string(),
  equipment: z.string(),
  difficulty: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  image_url: z.string().optional().nullable(),
  video_url: z.string().optional().nullable(),
  primary_muscles: z.array(z.string()).optional().nullable(),
  secondary_muscles: z.array(z.string()).optional().nullable(),
  instructions: z.array(z.string()).optional().nullable(),
});

// Schema for direct Supabase response (array of exercises)
export const SupabaseExerciseListSchema = z.array(SupabaseExerciseSchema);

export const ExerciseListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ExerciseApiSchema),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

export const ExerciseDetailResponseSchema = z.object({
  success: z.literal(true),
  data: ExerciseApiSchema,
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Workout plan API schemas
export const WorkoutPlanApiSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  duration: z.number().positive(),
  frequency: z.number().positive(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      sets: z.number().positive(),
      reps: z.string(),
      weight: z.number().optional(),
      restTime: z.number().positive(),
      notes: z.string().optional(),
    }),
  ),
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WorkoutPlanListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(WorkoutPlanApiSchema),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

export const WorkoutPlanDetailResponseSchema = z.object({
  success: z.literal(true),
  data: WorkoutPlanApiSchema,
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// User progress API schemas
export const ExerciseRecordApiSchema = z.object({
  id: z.string(),
  userId: z.string(),
  exerciseId: z.string(),
  workoutSessionId: z.string().optional(),
  weight: z.number().nonnegative(),
  reps: z.number().positive(),
  sets: z.number().positive(),
  duration: z.number().positive().optional(),
  restTime: z.number().positive().optional(),
  notes: z.string().optional(),
  completedAt: z.string(),
  createdAt: z.string(),
});

export const ProgressResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(ExerciseRecordApiSchema),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

export const WorkoutSessionApiSchema = z.object({
  id: z.string(),
  userId: z.string(),
  planId: z.string().optional(),
  name: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  duration: z.number().positive().optional(),
  exercises: z.array(ExerciseRecordApiSchema),
  notes: z.string().optional(),
  caloriesBurned: z.number().nonnegative().optional(),
  totalVolume: z.number().nonnegative().optional(),
});

export const WorkoutSessionResponseSchema = z.object({
  success: z.literal(true),
  data: WorkoutSessionApiSchema,
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Measurements API schemas
export const MeasurementApiSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(['weight', 'height', 'body_fat', 'muscle_mass', 'waist', 'chest', 'arms', 'thighs']),
  value: z.number().positive(),
  unit: z.enum(['kg', 'lbs', 'cm', 'inches', 'percentage']),
  date: z.string(),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export const MeasurementsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(MeasurementApiSchema),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// AI Coaching API schemas
export const CoachingRequestSchema = z.object({
  prompt: z.string().min(1),
  context: z.object({
    userId: z.string(),
    fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    goals: z.array(z.string()),
    preferences: z.array(z.string()),
    recentWorkouts: z.array(z.string()),
    userProfile: z.object({
      age: z.number().positive(),
      gender: z.enum(['male', 'female', 'other']),
      weight: z.number().positive(),
      height: z.number().positive(),
      medicalConditions: z.array(z.string()).optional(),
    }),
  }),
  type: z.enum(['workout', 'nutrition', 'mindset']),
});

export const CoachingResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    suggestions: z.array(z.string()).optional(),
    exerciseRecommendations: z.array(z.string()).optional(),
    motivationalTips: z.array(z.string()).optional(),
    followUpQuestions: z.array(z.string()).optional(),
  }),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// File upload schemas
export const FileUploadResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string(),
    filename: z.string(),
    url: z.string().url(),
    size: z.number().positive(),
    mimeType: z.string(),
    uploadedAt: z.string(),
  }),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Health check schemas
export const HealthCheckResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    version: z.string(),
    uptime: z.number().nonnegative(),
    services: z.record(
      z.object({
        status: z.enum(['up', 'down', 'degraded']),
        responseTime: z.number().nonnegative().optional(),
        lastCheck: z.string(),
      }),
    ),
  }),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Search schemas
export const SearchRequestSchema = z.object({
  query: z.string().min(1),
  filters: z.record(z.unknown()).optional(),
  sort: z
    .object({
      field: z.string(),
      direction: z.enum(['asc', 'desc']),
    })
    .optional(),
  pagination: z
    .object({
      page: z.number().positive(),
      limit: z.number().positive().max(100),
    })
    .optional(),
});

export const SearchResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    results: z.array(z.unknown()),
    total: z.number().nonnegative(),
    query: z.string(),
    filters: z.record(z.unknown()).optional(),
    suggestions: z.array(z.string()).optional(),
  }),
  pagination: PaginationMetaSchema.optional(),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Batch operation schemas
export const BatchRequestSchema = z.object({
  operations: z.array(
    z.object({
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      url: z.string(),
      body: z.unknown().optional(),
      headers: z.record(z.string()).optional(),
    }),
  ),
});

export const BatchResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      status: z.number(),
      data: z.unknown().optional(),
      error: z.string().optional(),
    }),
  ),
  timestamp: z.string(),
  requestId: z.string().optional(),
});

// Enhanced error handling utilities
export const createApiError = (
  message: string,
  code?: string,
  details?: Record<string, unknown>,
  requestId?: string,
): z.infer<typeof ErrorApiResponseSchema> => {
  const errorResponse = {
    success: false as const,
    error: message,
    code,
    details,
    timestamp: new Date().toISOString(),
    requestId,
  };

  addBreadcrumb({
    message: `API error created: ${message}`,
    category: 'api_schemas.error',
    level: 'warning',
    data: {
      error_message: message,
      error_code: code,
      has_details: !!details,
      request_id: requestId,
    },
  });

  SentryLogger.warn('API error response created', {
    error_message: message,
    error_code: code,
    details,
    request_id: requestId,
  });

  return errorResponse;
};

export const createApiSuccess = <T>(
  data: T,
  message?: string,
  requestId?: string,
): { success: true; data: T; message?: string; timestamp: string; requestId?: string } => {
  const successResponse = {
    success: true as const,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId,
  };

  addBreadcrumb({
    message: 'API success response created',
    category: 'api_schemas.success',
    level: 'info',
    data: {
      has_message: !!message,
      request_id: requestId,
      data_type: typeof data,
    },
  });

  return successResponse;
};

// Pagination utilities with monitoring
export const createPaginatedResponse = <T>(
  data: T[],
  pagination: z.infer<typeof PaginationMetaSchema>,
  requestId?: string,
): z.infer<typeof PaginatedApiResponseSchema> => {
  const response = {
    success: true as const,
    data,
    pagination,
    timestamp: new Date().toISOString(),
    requestId,
  };

  addBreadcrumb({
    message: 'Paginated API response created',
    category: 'api_schemas.pagination',
    level: 'info',
    data: {
      items_count: data.length,
      current_page: pagination.page,
      total_pages: pagination.totalPages,
      total_items: pagination.total,
      request_id: requestId,
    },
  });

  SentryLogger.info('Paginated response created', {
    items_count: data.length,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
    request_id: requestId,
  });

  return response;
};

// Rate limiting utilities
export const trackRateLimit = (rateLimitInfo: z.infer<typeof RateLimitInfoSchema>) => {
  addBreadcrumb({
    message: 'Rate limit information tracked',
    category: 'api_schemas.rate_limit',
    level: 'info',
    data: {
      limit: rateLimitInfo.limit,
      remaining: rateLimitInfo.remaining,
      reset: rateLimitInfo.reset,
      retry_after: rateLimitInfo.retryAfter,
    },
  });

  // Alert if rate limit is getting close
  const usagePercentage =
    ((rateLimitInfo.limit - rateLimitInfo.remaining) / rateLimitInfo.limit) * 100;

  if (usagePercentage > 80) {
    SentryLogger.warn('High rate limit usage detected', {
      usage_percentage: usagePercentage,
      remaining: rateLimitInfo.remaining,
      limit: rateLimitInfo.limit,
      reset: rateLimitInfo.reset,
    });
  }

  return rateLimitInfo;
};

// Export all schemas as a collection
export const ApiSchemas = {
  // Base schemas
  BaseApiResponse: BaseApiResponseSchema,
  ErrorApiResponse: ErrorApiResponseSchema,
  SuccessApiResponse: SuccessApiResponseSchema,

  // Pagination
  PaginationMeta: PaginationMetaSchema,
  PaginatedApiResponse: PaginatedApiResponseSchema,

  // Rate limiting
  RateLimitInfo: RateLimitInfoSchema,
  RateLimitResponse: RateLimitResponseSchema,

  // Authentication
  AuthErrorResponse: AuthErrorResponseSchema,
  AuthSuccessResponse: AuthSuccessResponseSchema,

  // Validation
  ValidationErrorDetail: ValidationErrorDetailSchema,
  ValidationErrorResponse: ValidationErrorResponseSchema,

  // Exercises
  ExerciseApi: ExerciseApiSchema,
  ExerciseListResponse: ExerciseListResponseSchema,
  ExerciseDetailResponse: ExerciseDetailResponseSchema,

  // Workout plans
  WorkoutPlanApi: WorkoutPlanApiSchema,
  WorkoutPlanListResponse: WorkoutPlanListResponseSchema,
  WorkoutPlanDetailResponse: WorkoutPlanDetailResponseSchema,

  // Progress
  ExerciseRecordApi: ExerciseRecordApiSchema,
  ProgressResponse: ProgressResponseSchema,
  WorkoutSessionApi: WorkoutSessionApiSchema,
  WorkoutSessionResponse: WorkoutSessionResponseSchema,

  // Measurements
  MeasurementApi: MeasurementApiSchema,
  MeasurementsResponse: MeasurementsResponseSchema,

  // AI Coaching
  CoachingRequest: CoachingRequestSchema,
  CoachingResponse: CoachingResponseSchema,

  // File upload
  FileUploadResponse: FileUploadResponseSchema,

  // Health check
  HealthCheckResponse: HealthCheckResponseSchema,

  // Search
  SearchRequest: SearchRequestSchema,
  SearchResponse: SearchResponseSchema,

  // Batch operations
  BatchRequest: BatchRequestSchema,
  BatchResponse: BatchResponseSchema,
};

// Type exports
export type BaseApiResponse = z.infer<typeof BaseApiResponseSchema>;
export type ErrorApiResponse = z.infer<typeof ErrorApiResponseSchema>;
export type SuccessApiResponse = z.infer<typeof SuccessApiResponseSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type PaginatedApiResponse = z.infer<typeof PaginatedApiResponseSchema>;
export type RateLimitInfo = z.infer<typeof RateLimitInfoSchema>;
export type RateLimitResponse = z.infer<typeof RateLimitResponseSchema>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>;
export type AuthSuccessResponse = z.infer<typeof AuthSuccessResponseSchema>;
export type ValidationErrorDetail = z.infer<typeof ValidationErrorDetailSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type ExerciseApi = z.infer<typeof ExerciseApiSchema>;
export type ExerciseListResponse = z.infer<typeof ExerciseListResponseSchema>;
export type ExerciseDetailResponse = z.infer<typeof ExerciseDetailResponseSchema>;
export type WorkoutPlanApi = z.infer<typeof WorkoutPlanApiSchema>;
export type WorkoutPlanListResponse = z.infer<typeof WorkoutPlanListResponseSchema>;
export type WorkoutPlanDetailResponse = z.infer<typeof WorkoutPlanDetailResponseSchema>;
export type ExerciseRecordApi = z.infer<typeof ExerciseRecordApiSchema>;
export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;
export type WorkoutSessionApi = z.infer<typeof WorkoutSessionApiSchema>;
export type WorkoutSessionResponse = z.infer<typeof WorkoutSessionResponseSchema>;
export type MeasurementApi = z.infer<typeof MeasurementApiSchema>;
export type MeasurementsResponse = z.infer<typeof MeasurementsResponseSchema>;
export type CoachingRequest = z.infer<typeof CoachingRequestSchema>;
export type CoachingResponse = z.infer<typeof CoachingResponseSchema>;
export type FileUploadResponse = z.infer<typeof FileUploadResponseSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type BatchRequest = z.infer<typeof BatchRequestSchema>;
export type BatchResponse = z.infer<typeof BatchResponseSchema>;

// Enhanced validation results type
export interface ApiValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  duration?: number;
  operation?: string;
}

// Performance metrics type
export interface ApiSchemaMetrics {
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  slowValidations: number;
  errorsByOperation: Record<string, number>;
}

// Metrics tracking
let metrics: ApiSchemaMetrics = {
  totalValidations: 0,
  successfulValidations: 0,
  failedValidations: 0,
  averageValidationTime: 0,
  slowValidations: 0,
  errorsByOperation: {},
};

export const getApiSchemaMetrics = (): ApiSchemaMetrics => {
  addBreadcrumb({
    message: 'API schema metrics retrieved',
    category: 'api_schemas.metrics',
    level: 'info',
    data: metrics,
  });

  return { ...metrics };
};

export const resetApiSchemaMetrics = (): void => {
  const previousMetrics = { ...metrics };

  metrics = {
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    averageValidationTime: 0,
    slowValidations: 0,
    errorsByOperation: {},
  };

  addBreadcrumb({
    message: 'API schema metrics reset',
    category: 'api_schemas.metrics',
    level: 'info',
    data: {
      previous_metrics: previousMetrics,
      reset_timestamp: new Date().toISOString(),
    },
  });

  SentryLogger.info('API schema metrics reset', {
    previous_metrics: previousMetrics,
    reset_timestamp: new Date().toISOString(),
  });
};

// Default export to satisfy Expo Router (this file should not be a route)
export default function ApiSchemasRouterPlaceholder() {
  return null;
}
